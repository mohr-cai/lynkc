import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, PlugZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createChannel, fetchChannel, updateChannel } from "@/lib/api";

const POLL_INTERVAL_MS = 2000;

export function App() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelInput, setChannelInput] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [remoteContent, setRemoteContent] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("not linked");
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
        setRemoteContent(data.content ?? "");
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
    setIsCreating(true);
    setError(null);
    try {
      const channel = await createChannel(localContent || undefined);
      setChannelId(channel.id);
      setChannelInput(channel.id);
      setRemoteContent(localContent);
      setTtlSeconds(channel.ttl_seconds ?? null);
      setStatus("linked");
      updateUrl(channel.id);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }, [localContent, updateUrl]);

  const handleJoinChannel = useCallback(async () => {
    if (!channelInput.trim()) {
      setError("channel id required");
      return;
    }

    setError(null);
    try {
      const channel = await fetchChannel(channelInput.trim());
      setChannelId(channel.id);
      setRemoteContent(channel.content ?? "");
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

    setIsSyncing(true);
    setError(null);
    try {
      await updateChannel(channelId, localContent);
      setStatus("synced just now");
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, [channelId, localContent]);

  const handleCopyRemote = useCallback(async () => {
    if (!remoteContent) return;
    try {
      await navigator.clipboard.writeText(remoteContent);
      setStatus("copied remote");
    } catch (err) {
      console.error(err);
      setError("could not touch clipboard");
    }
  }, [remoteContent]);

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

      <section className="grid gap-6 md:grid-cols-[280px_1fr]">
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="local">Local draft</Label>
              <Textarea
                id="local"
                spellCheck={false}
                placeholder="paste from your real clipboard"
                value={localContent}
                onChange={(event) => setLocalContent(event.target.value)}
                className="min-h-[220px] bg-background/60 backdrop-blur"
              />
              <Button onClick={handleSync} disabled={isSyncing || !channelId}>
                {isSyncing ? "syncing..." : "Sync up"}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="remote" className="flex items-center justify-between">
                Remote view
                <Button type="button" size="sm" variant="ghost" onClick={handleCopyRemote} disabled={!remoteContent}>
                  <Copy className="mr-2 h-4 w-4" /> tap
                </Button>
              </Label>
              <Textarea
                id="remote"
                spellCheck={false}
                readOnly
                value={remoteContent}
                className="min-h-[220px] bg-background/40 font-mono"
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default App;
