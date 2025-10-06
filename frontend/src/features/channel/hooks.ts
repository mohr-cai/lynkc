import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ChannelFile, ChannelPayload, createChannel, fetchChannel, updateChannel } from "@/lib/api";
import { base64ToBlob, CHANNEL_BYTE_LIMIT, formatBytes } from "@/lib/files";

const POLL_INTERVAL_MS = 2000;

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  const [localContent, setLocalContent] = useState("");
  const [localFiles, setLocalFiles] = useState<ChannelFile[]>([]);
  const [status, setStatus] = useState<string>("not linked");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textEncoder = useMemo(() => new TextEncoder(), []);

  const queryClient = useQueryClient();

  const channelQuery = useQuery<ChannelPayload>({
    queryKey: ["channel", channelId],
    queryFn: async () => {
      if (!channelId) {
        throw new Error("channel id missing");
      }
      return fetchChannel(channelId);
    },
    enabled: !!channelId,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const remoteContent = channelQuery.data?.text ?? "";
  const remoteFiles = channelQuery.data?.files ?? [];
  const ttlSeconds = channelQuery.data?.ttl_seconds ?? null;

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
      return;
    }

    if (channelQuery.isError) {
      console.error(channelQuery.error);
      setStatus("channel glitch?");
      setError((channelQuery.error as Error).message);
      return;
    }

    if (channelQuery.isSuccess) {
      setStatus("linked");
      setError(null);
    }
  }, [channelId, channelQuery.error, channelQuery.isError, channelQuery.isSuccess]);

  const channelLink = useMemo(() => {
    if (!channelId || typeof window === "undefined") {
      return null;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("channel", channelId);
    return url.toString();
  }, [channelId]);

  const createChannelMutation = useMutation({
    mutationFn: ({ text, files }: { text?: string; files: ChannelFile[] }) => createChannel(text, files),
  });

  const updateChannelMutation = useMutation({
    mutationFn: ({ id, text, files }: { id: string; text: string; files: ChannelFile[] }) => updateChannel(id, text, files),
  });

  const handleCreateChannel = useCallback(async () => {
    setError(null);
    if (!enforceLimit(localContent, localFiles)) {
      return;
    }

    try {
      const channel = await createChannelMutation.mutateAsync({
        text: localContent || undefined,
        files: localFiles,
      });

      setChannelId(channel.id);
      setChannelInput(channel.id);
      setStatus("linked");

      queryClient.setQueryData<ChannelPayload>(["channel", channel.id], {
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
  }, [createChannelMutation, enforceLimit, localContent, localFiles, queryClient]);

  const handleJoinChannel = useCallback(async () => {
    if (!channelInput.trim()) {
      setError("channel id required");
      return;
    }

    setError(null);
    try {
      const trimmed = channelInput.trim();
      const channel = await fetchChannel(trimmed);
      setChannelId(channel.id);
      setChannelInput(channel.id);
      setStatus("linked");

      queryClient.setQueryData<ChannelPayload>(["channel", channel.id], channel);

      const params = new URLSearchParams(window.location.search);
      params.set("channel", channel.id);
      const next = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", next);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }, [channelInput, queryClient]);

  const handleSync = useCallback(async () => {
    if (!channelId) {
      setError("no channel yet");
      return;
    }

    setError(null);
    if (!enforceLimit(localContent, localFiles)) {
      return;
    }

    try {
      await updateChannelMutation.mutateAsync({
        id: channelId,
        text: localContent,
        files: localFiles,
      });
      setStatus("synced just now");

      queryClient.setQueryData<ChannelPayload | undefined>(["channel", channelId], (previous) => {
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
      });
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }, [channelId, enforceLimit, localContent, localFiles, queryClient, ttlSeconds, updateChannelMutation]);

  const handleCopyRemote = useCallback(async () => {
    if (!remoteContent) return;
    try {
      await navigator.clipboard.writeText(remoteContent);
      setStatus("copied remote text");
    } catch (err) {
      console.error(err);
      setError("could not touch clipboard (needs HTTPS)");
    }
  }, [remoteContent]);

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
    bytesUsed,
    channelByteLimit: CHANNEL_BYTE_LIMIT,
    handleCreateChannel,
    handleJoinChannel,
    handleSync,
    handleCopyRemote,
    handleCopyFile,
    handleDownloadFile,
    handleFileSelect,
    handleRemoveLocalFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCopyChannelLink,
  };
}
