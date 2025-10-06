import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Paperclip, PlugZap, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChannelFile,
  createChannel,
  fetchChannel,
  updateChannel,
} from "@/lib/api";
import { base64ToBlob, formatBytes } from "@/lib/utils";

const POLL_INTERVAL_MS = 2000;
const MAX_CHANNEL_BYTES = 100 * 1024 * 1024; // keep in sync with backend limit

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

export function App() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelInput, setChannelInput] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localFiles, setLocalFiles] = useState<ChannelFile[]>([]);
  const [remoteContent, setRemoteContent] = useState("");
  const [remoteFiles, setRemoteFiles] = useState<ChannelFile[]>([]);
  const [ttlSeconds, setTtlSeconds] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("not linked");
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textEncoder = useMemo(() => new TextEncoder(), []);
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
      if (total > MAX_CHANNEL_BYTES) {
        setError(
          `channel payload too large (${formatBytes(total)} / ${formatBytes(MAX_CHANNEL_BYTES)}). remove files or shrink text.`
        );
        return false;
      }
      return true;
    },
    [computeBytes]
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

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await fetchChannel(channelId);
        if (cancelled) return;
        setRemoteContent(data.text ?? "");
        setRemoteFiles(data.files ?? []);
        setTtlSeconds(data.ttl_seconds ?? null);
        setStatus("linked");
        setError(null);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setStatus("channel glitch?");
        setError((err as Error).message);
      } finally {
        if (!cancelled) {
          timeout = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [channelId]);

  const updateUrl = useCallback((id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("channel", id);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", next);
  }, []);

  const handleCreateChannel = useCallback(async () => {
    setError(null);
    if (!enforceLimit(localContent, localFiles)) {
      return;
    }

    setIsCreating(true);
    try {
      const channel = await createChannel(localContent || undefined, localFiles);
      setChannelId(channel.id);
      setChannelInput(channel.id);
      setRemoteContent(localContent);
      setRemoteFiles(localFiles);
      setTtlSeconds(channel.ttl_seconds ?? null);
      setStatus("linked");
      updateUrl(channel.id);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }, [enforceLimit, localContent, localFiles, updateUrl]);

  const handleJoinChannel = useCallback(async () => {
    if (!channelInput.trim()) {
      setError("channel id required");
      return;
    }

    setError(null);
    try {
      const channel = await fetchChannel(channelInput.trim());
      setChannelId(channel.id);
      setRemoteContent(channel.text ?? "");
      setRemoteFiles(channel.files ?? []);
      setTtlSeconds(channel.ttl_seconds ?? null);
      setStatus("linked");
      updateUrl(channel.id);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    }
  }, [channelInput, updateUrl]);

  const handleSync = useCallback(async () => {
    if (!channelId) {
      setError("no channel yet");
      return;
    }

    setError(null);
    if (!enforceLimit(localContent, localFiles)) {
      return;
    }

    setIsSyncing(true);
    try {
      await updateChannel(channelId, localContent, localFiles);
      setStatus("synced just now");
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, [channelId, enforceLimit, localContent, localFiles]);

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

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }

    try {
      setError(null);
      const processed = await Promise.all(files.map(readFileAsChannelFile));
      const nextFiles = [...localFiles, ...processed];
      if (!enforceLimit(localContent, nextFiles)) {
        return;
      }
      setLocalFiles(nextFiles);
    } catch (err) {
      console.error(err);
      setError("failed to read file");
    } finally {
      event.target.value = "";
    }
  }, [enforceLimit, localContent, localFiles]);

  const handleRemoveLocalFile = useCallback((id: string) => {
    setLocalFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const ttlLabel = useMemo(() => {
    if (ttlSeconds === null) return "--";
    if (ttlSeconds <= 0) return "expiring";
    if (ttlSeconds < 60) return `${ttlSeconds}s`;
    const minutes = Math.floor(ttlSeconds / 60);
    const seconds = ttlSeconds % 60;
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }, [ttlSeconds]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-10 md:px-10">
      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-muted-foreground">
          <PlugZap className="h-4 w-4 text-primary" />
          lynkc
        </div>
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
          Clipboard tunnels for cursed infra moments
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Spawn a temporary channel and paste text through the browser when SSH forbids your clipboard. No disks, just Redis fog.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Channel control</CardTitle>
            <CardDescription>
              Create fresh or hook into an existing tunnel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channel-id">Channel ID</Label>
              <Input
                id="channel-id"
                placeholder="ghost-id"
                value={channelInput}
                onChange={(event) => setChannelInput(event.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
              />
              <Button onClick={handleJoinChannel} className="w-full" variant="secondary">
                Attach to channel
              </Button>
            </div>
            <div className="space-y-2 pt-2">
              <Button onClick={handleCreateChannel} disabled={isCreating} className="w-full">
                {isCreating ? "booting..." : "Generate brand new"}
              </Button>
            </div>
            <div className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between font-mono text-[0.75rem] uppercase">
                <span>Status</span>
                <span className="text-primary">{status}</span>
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[0.75rem] uppercase">
                <span>TTL</span>
                <span>{ttlLabel}</span>
              </div>
            </div>
            {error ? (
              <p className="text-xs font-semibold text-destructive">{error}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
            <div>
              <CardTitle>Paste pad</CardTitle>
              <CardDescription>
                Type or paste locally, then blast it through the tunnel. Remote view refreshes every {POLL_INTERVAL_MS / 1000}s.
              </CardDescription>
            </div>
            {channelId ? (
              <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-mono text-muted-foreground">
                {channelId}
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                <Label htmlFor="local">Local draft</Label>
                <Textarea
                  id="local"
                  spellCheck={false}
                  placeholder="paste from your real clipboard"
                  value={localContent}
                  onChange={(event) => setLocalContent(event.target.value)}
                  className="min-h-[220px] bg-background/60 backdrop-blur"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Attachments
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Add files
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 rounded-md border border-dashed border-border/60 p-3 text-xs">
                  {localFiles.length === 0 ? (
                    <p className="text-muted-foreground">No local files yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {localFiles.map((file) => (
                        <li key={file.id} className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{file.name}</span>
                            <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveLocalFile(file.id)}
                            title="Remove file"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[0.7rem] text-muted-foreground">
                    Payload: {formatBytes(bytesUsed)} / {formatBytes(MAX_CHANNEL_BYTES)}
                  </p>
                </div>
              </div>
              <Button onClick={handleSync} disabled={isSyncing || !channelId}>
                {isSyncing ? "syncing..." : "Sync up"}
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="remote" className="flex items-center gap-2">
                  Remote view
                </Label>
                <Button type="button" size="sm" variant="ghost" onClick={handleCopyRemote} disabled={!remoteContent}>
                  <Copy className="mr-2 h-4 w-4" /> copy text
                </Button>
              </div>
              <Textarea
                id="remote"
                spellCheck={false}
                readOnly
                value={remoteContent}
                className="min-h-[220px] bg-background/40 font-mono"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Paperclip className="h-4 w-4 text-primary" /> Remote attachments
                </div>
                <div className="space-y-1 rounded-md border border-dashed border-border/60 p-3 text-xs">
                  {remoteFiles.length === 0 ? (
                    <p className="text-muted-foreground">No remote files in this channel.</p>
                  ) : (
                    <ul className="space-y-2">
                      {remoteFiles.map((file) => (
                        <li key={file.id} className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{file.name}</span>
                          <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                          <div className="ml-auto flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleCopyFile(file)}
                              title="Copy to clipboard"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownloadFile(file)}
                              title="Download file"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default App;
