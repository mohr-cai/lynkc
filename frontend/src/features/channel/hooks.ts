import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ChannelFile, ChannelPayload, createChannel, fetchChannel, updateChannel } from "@/lib/api";
import { base64ToBlob, CHANNEL_BYTE_LIMIT, formatBytes } from "@/lib/files";

const POLL_INTERVAL_MS = 2000;
const SESSION_STORAGE_KEY_PREFIX = "lynkc-channel-password:";
const HISTORY_RETENTION_CHECK_INTERVAL_MS = 1000;
const MAX_HISTORY_ENTRIES = 20;

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type ChannelHistoryEntry = {
  id: string;
  text: string;
  files: ChannelFile[];
  createdAt: number;
  expiresAt: number | null;
};

async function readFileAsChannelFile(file: File): Promise<ChannelFile> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : dataUrl;

  return {
    id: generateId(),
    name: file.name,
    mime_type: file.type || "application/octet-stream",
    size: file.size,
    data_base64: base64,
  };
}

export function useChannelController() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelInput, setChannelInput] = useState("");
  const [channelPassword, setChannelPassword] = useState<string | null>(null);
  const [channelPasswordInput, setChannelPasswordInput] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localFiles, setLocalFiles] = useState<ChannelFile[]>([]);
  const [history, setHistory] = useState<ChannelHistoryEntry[]>([]);
  const [status, setStatus] = useState<string>("channel detached");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textEncoder = useMemo(() => new TextEncoder(), []);
  const lastSnapshotRef = useRef<string | null>(null);
  const channelExpiresAtRef = useRef<number | null>(null);

  const queryClient = useQueryClient();

  const storageKeyForChannel = useCallback((id: string) => `${SESSION_STORAGE_KEY_PREFIX}${id}`, []);

  const readStoredPassword = useCallback(
    (id: string) => {
      if (typeof window === "undefined") {
        return null;
      }
      try {
        return window.sessionStorage.getItem(storageKeyForChannel(id));
      } catch (err) {
        console.error(err);
        return null;
      }
    },
    [storageKeyForChannel]
  );

  const persistStoredPassword = useCallback(
    (id: string, password: string) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.sessionStorage.setItem(storageKeyForChannel(id), password);
      } catch (err) {
        console.error(err);
      }
    },
    [storageKeyForChannel]
  );

  const removeStoredPassword = useCallback(
    (id: string) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.sessionStorage.removeItem(storageKeyForChannel(id));
      } catch (err) {
        console.error(err);
      }
    },
    [storageKeyForChannel]
  );

  const clearChannelState = useCallback(
    ({ channelId: id, status: nextStatus, error: nextError }: { channelId?: string; status?: string; error?: string }) => {
      if (id) {
        removeStoredPassword(id);
        queryClient.removeQueries({ queryKey: ["channel", id], exact: false });
      }

      setChannelId(null);
      setChannelInput("");
      setChannelPassword(null);
      setChannelPasswordInput("");
      setLocalContent("");
      setLocalFiles([]);
      setHistory([]);
      setStatus(nextStatus ?? "channel detached");
      setError(nextError ?? null);
      lastSnapshotRef.current = null;
      channelExpiresAtRef.current = null;

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.delete("channel");
        const queryString = params.toString();
        const next = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        window.history.replaceState(null, "", next);
      }
    },
    [queryClient, removeStoredPassword]
  );

  const channelQuery = useQuery<ChannelPayload>({
    queryKey: ["channel", channelId, channelPassword],
    queryFn: async () => {
      if (!channelId) {
        throw new Error("channel id missing");
      }
      if (!channelPassword) {
        throw new Error("channel password missing");
      }
      return fetchChannel(channelId, channelPassword);
    },
    enabled: !!channelId && !!channelPassword,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: (failureCount, error) => {
      const message = (error as Error).message;
      if (message === "invalid channel password") {
        return false;
      }
      return failureCount < 3;
    },
  });

  const remoteContent = channelQuery.data?.text ?? "";
  const remoteFiles = channelQuery.data?.files ?? [];
  const ttlSeconds = channelQuery.data?.ttl_seconds ?? null;

  useEffect(() => {
    if (ttlSeconds === null) {
      channelExpiresAtRef.current = null;
      setHistory((prev) => {
        if (prev.length === 0) {
          return prev;
        }
        return prev.map((entry) => (entry.expiresAt === null ? entry : { ...entry, expiresAt: null }));
      });
      return;
    }

    const nextExpiresAt = Date.now() + ttlSeconds * 1000;
    const previousExpiresAt = channelExpiresAtRef.current;
    channelExpiresAtRef.current = nextExpiresAt;

    if (previousExpiresAt === null || nextExpiresAt > previousExpiresAt) {
      setHistory((prev) => {
        if (prev.length === 0) {
          return prev;
        }
        return prev.map((entry) => ({ ...entry, expiresAt: nextExpiresAt }));
      });
    }
  }, [ttlSeconds]);

  useEffect(() => {
    if (!channelId || !channelPassword) {
      return;
    }

    if (!channelQuery.data) {
      return;
    }

    const now = Date.now();
    const normalizedText = channelQuery.data.text ?? "";
    const rawFiles = channelQuery.data.files ?? [];
    const signature = JSON.stringify({
      text: normalizedText,
      files: rawFiles.map((file) => `${file.id}:${file.size}:${file.data_base64}`),
    });

    if (lastSnapshotRef.current === signature) {
      return;
    }

    lastSnapshotRef.current = signature;

    const expiresAt = channelExpiresAtRef.current ?? (ttlSeconds !== null ? now + ttlSeconds * 1000 : null);

    setHistory((prev) => {
      const pruned = prev.filter((entry) => entry.expiresAt === null || entry.expiresAt > now);
      const latest = pruned[0];
      if (
        latest &&
        latest.text === normalizedText &&
        latest.files.length === rawFiles.length &&
        latest.files.every((file, index) => {
          const counterpart = rawFiles[index];
          return (
            file.id === counterpart.id &&
            file.size === counterpart.size &&
            file.data_base64 === counterpart.data_base64 &&
            file.name === counterpart.name &&
            file.mime_type === counterpart.mime_type
          );
        })
      ) {
        return pruned;
      }

      const nextEntry: ChannelHistoryEntry = {
        id: generateId(),
        text: normalizedText,
        files: rawFiles.map((file) => ({ ...file })),
        createdAt: now,
        expiresAt,
      };

      const nextHistory = [nextEntry, ...pruned];
      if (nextHistory.length > MAX_HISTORY_ENTRIES) {
        return nextHistory.slice(0, MAX_HISTORY_ENTRIES);
      }
      return nextHistory;
    });
  }, [channelId, channelPassword, channelQuery.data, ttlSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setHistory((prev) => {
        const next = prev.filter((entry) => entry.expiresAt === null || entry.expiresAt > now);
        return next.length === prev.length ? prev : next;
      });
    }, HISTORY_RETENTION_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const computeBytes = useCallback(
    (textValue: string, filesValue: ChannelFile[]) => {
      const textBytes = textEncoder.encode(textValue).length;
      const filesBytes = filesValue.reduce((sum, file) => sum + file.size, 0);
      return textBytes + filesBytes;
    },
    [textEncoder]
  );

  const enforceLimit = useCallback(
    (textValue: string, filesValue: ChannelFile[]) => {
      const total = computeBytes(textValue, filesValue);
      if (total > CHANNEL_BYTE_LIMIT) {
        setError(
          `channel payload too large (${formatBytes(total)} / ${formatBytes(CHANNEL_BYTE_LIMIT)}). remove files or shrink text.`
        );
        return false;
      }
      return true;
    },
    [computeBytes]
  );

  const processIncomingFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) {
        return;
      }

      try {
        setError(null);
        const processed = await Promise.all(files.map(readFileAsChannelFile));
        let accepted = false;
        setLocalFiles((prev) => {
          const next = [...prev, ...processed];
          if (!enforceLimit(localContent, next)) {
            return prev;
          }
          accepted = true;
          return next;
        });

        if (accepted) {
          setStatus(
            processed.length === 1
              ? `attached ${processed[0].name}`
              : `attached ${processed.length} files`
          );
        }
      } catch (err) {
        console.error(err);
        setError("failed to read file");
      }
    },
    [enforceLimit, localContent]
  );

  const bytesUsed = useMemo(() => computeBytes(localContent, localFiles), [computeBytes, localContent, localFiles]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("channel");
    if (fromQuery) {
      setChannelId(fromQuery);
      setChannelInput(fromQuery);
    }
  }, []);

  useEffect(() => {
    if (!channelId) {
      setHistory([]);
      lastSnapshotRef.current = null;
      channelExpiresAtRef.current = null;
      return;
    }

    setHistory([]);
    lastSnapshotRef.current = null;
  }, [channelId]);

  useEffect(() => {
    if (!channelId) {
      setChannelPassword(null);
      setChannelPasswordInput("");
      return;
    }

    if (channelPassword) {
      return;
    }

    const stored = readStoredPassword(channelId);
    if (stored) {
      setChannelPassword(stored);
      setChannelPasswordInput(stored);
    }
  }, [channelId, channelPassword, readStoredPassword]);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    if (channelPassword) {
      return;
    }

    setHistory([]);
    lastSnapshotRef.current = null;
  }, [channelId, channelPassword]);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    if (channelQuery.isError) {
      const err = channelQuery.error as Error;
      console.error(err);
      const message = err.message;
      if (message === "channel password missing") {
        setStatus("channel locked");
        setError("channel password required");
        return;
      }
      if (message === "invalid channel password") {
        setStatus("channel locked");
        setError(message);
        setChannelPassword(null);
        setChannelPasswordInput("");
        removeStoredPassword(channelId);
        return;
      }
      if (message === "channel not found") {
        clearChannelState({ channelId: channelId ?? undefined, status: "channel expired", error: message });
        return;
      }
      setStatus("channel glitch?");
      setError(message);
      return;
    }

    if (channelQuery.isSuccess) {
      setStatus("channel linked");
      setError(null);
    }
  }, [
    channelId,
    channelQuery.error,
    channelQuery.isError,
    channelQuery.isSuccess,
    removeStoredPassword,
    clearChannelState,
  ]);

  const channelLink = useMemo(() => {
    if (!channelId || typeof window === "undefined") {
      return null;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("channel", channelId);
    return url.toString();
  }, [channelId]);

  const createChannelMutation = useMutation({
    mutationFn: ({
      text,
      files,
      password,
    }: {
      text?: string;
      files: ChannelFile[];
      password: string;
    }) => createChannel({ text, files, password }),
  });

  const updateChannelMutation = useMutation({
    mutationFn: ({
      id,
      password,
      text,
      files,
    }: {
      id: string;
      password: string;
      text: string;
      files: ChannelFile[];
    }) => updateChannel(id, password, text, files),
  });

  const handleCreateChannel = useCallback(async () => {
    setError(null);
    if (!enforceLimit(localContent, localFiles)) {
      return;
    }

    try {
      const trimmedPassword = channelPasswordInput.trim();
      if (!trimmedPassword) {
        setStatus("channel locked");
        setError("channel password required");
        return;
      }

      const channel = await createChannelMutation.mutateAsync({
        text: localContent || undefined,
        files: localFiles,
        password: trimmedPassword,
      });

      setChannelPassword(channel.password);
      setChannelPasswordInput(channel.password);
      persistStoredPassword(channel.id, channel.password);
      setChannelId(channel.id);
      setChannelInput(channel.id);
      setStatus("channel linked");

      queryClient.setQueryData<ChannelPayload>(["channel", channel.id, channel.password], {
        id: channel.id,
        text: localContent,
        files: localFiles,
        ttl_seconds: channel.ttl_seconds ?? null,
      });

      const params = new URLSearchParams(window.location.search);
      params.set("channel", channel.id);
      const next = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", next);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }, [
    createChannelMutation,
    channelPasswordInput,
    enforceLimit,
    localContent,
    localFiles,
    persistStoredPassword,
    queryClient,
  ]);

  const handleJoinChannel = useCallback(async () => {
    if (!channelInput.trim()) {
      setError("channel id required");
      return;
    }

    setError(null);
    try {
      const trimmed = channelInput.trim();
      let passwordToUse = channelPasswordInput.trim();
      if (!passwordToUse) {
        const stored = readStoredPassword(trimmed);
        if (stored) {
          passwordToUse = stored;
          setChannelPasswordInput(stored);
        }
      }

      if (!passwordToUse) {
        setStatus("channel locked");
        setError("channel password required");
        return;
      }

      const channel = await fetchChannel(trimmed, passwordToUse);
      setChannelPassword(passwordToUse);
      persistStoredPassword(channel.id, passwordToUse);
      setChannelId(channel.id);
      setChannelInput(channel.id);
      setStatus("channel linked");

      queryClient.setQueryData<ChannelPayload>(["channel", channel.id, passwordToUse], channel);

      const params = new URLSearchParams(window.location.search);
      params.set("channel", channel.id);
      const next = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", next);
    } catch (err) {
      console.error(err);
      const message = (err as Error).message;
      setError(message);
      const trimmed = channelInput.trim();
      if (message === "invalid channel password") {
        setStatus("channel locked");
        setChannelPassword(null);
        setChannelPasswordInput("");
        removeStoredPassword(trimmed);
        return;
      }
      if (message === "channel not found") {
        clearChannelState({ channelId: trimmed, status: "channel not found", error: message });
      }
    }
  }, [
    channelInput,
    channelPasswordInput,
    persistStoredPassword,
    queryClient,
    readStoredPassword,
    removeStoredPassword,
    clearChannelState,
  ]);

  const handleSync = useCallback(async () => {
    if (!channelId) {
      setError("no channel yet");
      return;
    }

    if (!channelPassword) {
      setStatus("channel locked");
      setError("channel password required");
      return;
    }

    setError(null);
    if (!enforceLimit(localContent, localFiles)) {
      return;
    }

    try {
      await updateChannelMutation.mutateAsync({
        id: channelId,
        password: channelPassword,
        text: localContent,
        files: localFiles,
      });
      setStatus("channel synced");

      queryClient.setQueryData<ChannelPayload | undefined>(
        ["channel", channelId, channelPassword],
        (previous) => {
          if (!previous) {
            return {
              id: channelId,
              text: localContent,
              files: localFiles,
              ttl_seconds: ttlSeconds,
            } as ChannelPayload;
          }

          return {
            ...previous,
            text: localContent,
            files: localFiles,
          };
        }
      );
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }, [
    channelId,
    channelPassword,
    enforceLimit,
    localContent,
    localFiles,
    queryClient,
    ttlSeconds,
    updateChannelMutation,
  ]);

  const handleApplyHistoryEntry = useCallback(
    (entryId: string) => {
      const entry = history.find((item) => item.id === entryId);
      if (!entry) {
        return;
      }

      setError(null);
      setLocalContent(entry.text);
      setLocalFiles(entry.files.map((file) => ({ ...file })));
      setStatus("replayed history snapshot");
    },
    [history, setError, setLocalContent, setLocalFiles, setStatus]
  );

  const handleCopyRemote = useCallback(async () => {
    if (!remoteContent || !channelPassword) return;
    try {
      await navigator.clipboard.writeText(remoteContent);
      setStatus("copied remote payload");
    } catch (err) {
      console.error(err);
      setError("could not touch clipboard (needs HTTPS)");
    }
  }, [channelPassword, remoteContent]);

  const handleCopyFile = useCallback(async (file: ChannelFile) => {
    try {
      const blob = base64ToBlob(file.data_base64, file.mime_type || "application/octet-stream");
      if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        const clipboardItem = new ClipboardItem({ [blob.type || "application/octet-stream"]: blob });
        await navigator.clipboard.write([clipboardItem]);
        setStatus(`copied ${file.name}`);
      } else {
        throw new Error("clipboard unavailable");
      }
    } catch (err) {
      console.error(err);
      setError("clipboard blocked: initiated download instead");
      const blob = base64ToBlob(file.data_base64, file.mime_type || "application/octet-stream");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name || "attachment";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleDownloadFile = useCallback((file: ChannelFile) => {
    const blob = base64ToBlob(file.data_base64, file.mime_type || "application/octet-stream");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name || "attachment";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus(`downloaded ${file.name}`);
  }, []);

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (!files.length) {
        return;
      }

      await processIncomingFiles(files);
      event.target.value = "";
    },
    [processIncomingFiles]
  );

  const handleRemoveLocalFile = useCallback((id: string) => {
    setLocalFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
      if (!files.length) {
        return;
      }

      await processIncomingFiles(files);
    },
    [processIncomingFiles]
  );

  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData ? Array.from(event.clipboardData.files) : [];
      if (files.length) {
        processIncomingFiles(files);
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [processIncomingFiles]);

  const handleCopyChannelLink = useCallback(async () => {
    if (!channelLink) {
      setError("no channel yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(channelLink);
      setStatus("channel link copied");
    } catch (err) {
      console.error(err);
      setError("could not copy link (needs HTTPS)");
    }
  }, [channelLink]);

  const handleCopyChannelPassword = useCallback(async () => {
    if (!channelPassword) {
      setError("no channel password yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(channelPassword);
      setStatus("channel secret copied");
    } catch (err) {
      console.error(err);
      setError("could not copy password (needs HTTPS)");
    }
  }, [channelPassword]);

  const ttlLabel = useMemo(() => {
    if (ttlSeconds === null) return "--";
    if (ttlSeconds <= 0) return "expiring";
    if (ttlSeconds < 60) return `${ttlSeconds}s`;
    const minutes = Math.floor(ttlSeconds / 60);
    const seconds = ttlSeconds % 60;
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }, [ttlSeconds]);

  const isCreating = createChannelMutation.isPending;
  const isSyncing = updateChannelMutation.isPending;

  return {
    channelId,
    channelInput,
    setChannelInput,
    channelPassword,
    channelPasswordInput,
    setChannelPasswordInput,
    channelLink,
    status,
    error,
    ttlLabel,
    isCreating,
    isSyncing,
    isDragging,
    fileInputRef,
    localContent,
    setLocalContent,
    localFiles,
    remoteContent,
    remoteFiles,
    history,
    requiresPassword: !!channelId && !channelPassword,
    bytesUsed,
    channelByteLimit: CHANNEL_BYTE_LIMIT,
    handleCreateChannel,
    handleJoinChannel,
    handleSync,
    handleApplyHistoryEntry,
    handleCopyRemote,
    handleCopyFile,
    handleDownloadFile,
    handleFileSelect,
    handleRemoveLocalFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCopyChannelLink,
    handleCopyChannelPassword,
  };
}
