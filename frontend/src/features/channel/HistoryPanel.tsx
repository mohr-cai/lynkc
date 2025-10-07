import { useEffect, useMemo, useState } from "react";
import { Clock, History as HistoryIcon, Paperclip, Trash2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/files";
import { cn } from "@/lib/utils";

import { ChannelHistoryEntry } from "./hooks";

interface HistoryPanelProps {
  entries: ChannelHistoryEntry[];
  isLocked: boolean;
  onSelectEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "expired";
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes === 0 ? `${hours}h` : `${hours}h ${remainderMinutes}m`;
}

export function HistoryPanel({ entries, isLocked, onSelectEntry, onDeleteEntry }: HistoryPanelProps) {
  const [now, setNow] = useState(() => Date.now());

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!entries.length) {
      return;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1">
        <Label className="flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-primary" /> Channel history
        </Label>
        <p className="text-xs text-muted-foreground">Snapshots mirror via Redis Streams and vanish with the TTL.</p>
      </div>
      <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3 text-sm md:max-h-[28rem] md:overflow-y-auto">
        {isLocked ? (
          <p className="text-muted-foreground">Unlock with the PSK to resume history.</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground">No snapshots yet. We pin payloads the moment they stream in.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const trimmed = entry.text.trim();
              const hasText = trimmed.length > 0;
              const preview = hasText ? (trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed) : null;
              const totalSize = entry.files.reduce((sum, file) => sum + (file.size || 0), 0);
              const attachmentsSummary = entry.files.length
                ? `${entry.files.length} file${entry.files.length > 1 ? "s" : ""} · ${formatBytes(totalSize)}`
                : "No files";
              const secondsRemaining = entry.expiresAt ? Math.max(0, Math.round((entry.expiresAt - now) / 1000)) : null;
              const expiresLabel = secondsRemaining === null ? null : formatDuration(secondsRemaining);
              const isExpiringSoon = typeof secondsRemaining === "number" && secondsRemaining > 0 && secondsRemaining <= 30;
              const ttlClasses = cn(
                "inline-flex items-center justify-center rounded-full bg-primary/5 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-primary/80",
                isExpiringSoon && "text-destructive"
              );

              return (
                <li key={entry.id}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectEntry(entry.id)}
                      className="flex-1 break-words rounded-md border border-border/60 bg-background/70 p-3 text-left transition hover:border-primary/70 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/60"
                    >
                      <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeFormatter.format(entry.createdAt)}
                        </span>
                        {expiresLabel ? <span className={ttlClasses}>{expiresLabel}</span> : <span>no ttl</span>}
                      </div>
                      <div className="mt-3 text-sm">
                        {preview ? (
                          <p className="max-h-24 overflow-hidden break-words text-foreground">{preview}</p>
                        ) : (
                          <p className="text-muted-foreground">Remote payload was empty.</p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {attachmentsSummary}
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteEntry(entry.id);
                      }}
                      title="Delete snapshot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
