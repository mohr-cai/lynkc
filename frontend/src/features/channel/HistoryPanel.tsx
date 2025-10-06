import { useEffect, useMemo, useState } from "react";
import { Clock, History as HistoryIcon, Paperclip } from "lucide-react";

import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/files";

import { ChannelHistoryEntry } from "./hooks";

interface HistoryPanelProps {
  entries: ChannelHistoryEntry[];
  isLocked: boolean;
  onSelectEntry: (entryId: string) => void;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "expired";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainderSeconds.toString().padStart(2, "0")}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return `${hours}h ${remainderMinutes}m`;
}

export function HistoryPanel({ entries, isLocked, onSelectEntry }: HistoryPanelProps) {
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
        <p className="text-xs text-muted-foreground">Snapshots sync to your session and vanish when the channel expires.</p>
      </div>
      <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3 text-sm max-h-[28rem] overflow-y-auto">
        {isLocked ? (
          <p className="text-muted-foreground">Unlock the channel with its password to capture history again.</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground">No snapshots yet. Once remote content arrives we will keep it here.</p>
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

              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(entry.id)}
                    className="w-full rounded-md border border-border/60 bg-background/70 p-3 text-left transition hover:border-primary/70 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeFormatter.format(entry.createdAt)}
                      </span>
                      {expiresLabel ? (
                        <span className={isExpiringSoon ? "text-destructive" : undefined}>{expiresLabel}</span>
                      ) : (
                        <span>no ttl</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm">
                      {preview ? (
                        <p className="text-foreground">{preview}</p>
                      ) : (
                        <p className="text-muted-foreground">Remote text was empty.</p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {attachmentsSummary}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
