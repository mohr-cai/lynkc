import { Copy, Download, Paperclip, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChannelFile } from "@/lib/api";
import { formatBytes } from "@/lib/files";

interface RemotePanelProps {
  remoteContent: string;
  remoteFiles: ChannelFile[];
  isLocked: boolean;
  onCopyRemote: () => void;
  onCopyFile: (file: ChannelFile) => Promise<void>;
  onDownloadFile: (file: ChannelFile) => void;
  onDeleteFile: (file: ChannelFile) => Promise<void> | void;
}

export function RemotePanel({
  remoteContent,
  remoteFiles,
  isLocked,
  onCopyRemote,
  onCopyFile,
  onDownloadFile,
  onDeleteFile,
}: RemotePanelProps) {
  const placeholderContent = "████████████████\nchannel locked (PSK)";

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="remote" className="flex items-center gap-2">
            Remote buffer
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCopyRemote}
            disabled={isLocked || !remoteContent}
          >
            <Copy className="mr-2 h-4 w-4" /> copy payload
          </Button>
        </div>
        <div className="relative">
          <Textarea
            id="remote"
            spellCheck={false}
            readOnly
            value={isLocked ? placeholderContent : remoteContent}
            className="min-h-[160px] md:min-h-[220px] bg-background/40 font-mono"
          />
          {isLocked ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-background/80 text-sm font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
              Unlock with channel PSK
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4 text-primary" /> Remote artifacts
        </div>
        <div className="relative space-y-1 rounded-md border border-dashed border-border/60 p-3 text-xs">
          {isLocked ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">redacted.txt</span>
                <span className="text-muted-foreground">••• KB</span>
                <div className="ml-auto flex items-center gap-1 opacity-50">
                  <Button type="button" size="icon" variant="ghost" disabled title="Copy disabled">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" disabled title="Download disabled">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" disabled title="Delete disabled">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground">Unlock with the channel PSK to see real artifacts.</p>
            </div>
          ) : remoteFiles.length === 0 ? (
            <p className="text-muted-foreground">No remote artifacts in this channel.</p>
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
                      onClick={() => {
                        void onCopyFile(file);
                      }}
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onDownloadFile(file)}
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        void onDeleteFile(file);
                      }}
                      title="Delete file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
