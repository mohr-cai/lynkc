import { ChangeEvent, DragEvent } from "react";
import { Copy, Download, Paperclip, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChannelFile } from "@/lib/api";
import { formatBytes } from "@/lib/files";

interface ChannelPadProps {
  localContent: string;
  onLocalContentChange: (value: string) => void;
  localFiles: ChannelFile[];
  bytesUsed: number;
  byteLimit: number;
  isDragging: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onRemoveFile: (id: string) => void;
  onCopyFile: (file: ChannelFile) => Promise<void>;
  onDownloadFile: (file: ChannelFile) => void;
  onCopyLocal: () => Promise<void> | void;
  onAddFilesHint?: string;
}

export function ChannelPad({
  localContent,
  onLocalContentChange,
  localFiles,
  bytesUsed,
  byteLimit,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  fileInputRef,
  onRemoveFile,
  onCopyFile,
  onDownloadFile,
  onCopyLocal,
}: ChannelPadProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="local">Local buffer</Label>
        </div>
        <Textarea
          id="local"
          spellCheck={false}
          placeholder="Paste logs, configs, or hex dumps"
          value={localContent}
          onChange={(event) => onLocalContentChange(event.target.value)}
          className="min-h-[180px] md:min-h-[220px] bg-background/60 backdrop-blur"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              void onCopyLocal();
            }}
            aria-label="Copy local buffer"
            disabled={!localContent}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Artifacts
          </Label>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileSelect} />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              Add artifacts
            </Button>
          </div>
        </div>
        <div
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "space-y-1 rounded-md border border-dashed border-border/60 p-3 text-xs transition-colors",
            isDragging && "border-primary bg-primary/10 text-primary"
          )}
        >
          {localFiles.length === 0 ? (
            <p className="text-muted-foreground">Drop files or paste payloads, or use the button.</p>
          ) : (
            <ul className="space-y-2">
              {localFiles.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        void onCopyFile(file);
                      }}
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDownloadFile(file)}
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveFile(file.id)}
                      title="Remove file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Payload budget: {formatBytes(bytesUsed)} / {formatBytes(byteLimit)}
          </p>
        </div>
      </div>
    </div>
  );
}
