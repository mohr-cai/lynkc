import { Copy, Download, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChannelFile } from "@/lib/api";
import { formatBytes } from "@/lib/files";

interface RemotePanelProps {
  remoteContent: string;
  remoteFiles: ChannelFile[];
  onCopyRemote: () => void;
  onCopyFile: (file: ChannelFile) => Promise<void>;
  onDownloadFile: (file: ChannelFile) => void;
}

export function RemotePanel({ remoteContent, remoteFiles, onCopyRemote, onCopyFile, onDownloadFile }: RemotePanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="remote" className="flex items-center gap-2">
          Remote view
        </Label>
        <Button type="button" size="sm" variant="ghost" onClick={onCopyRemote} disabled={!remoteContent}>
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
