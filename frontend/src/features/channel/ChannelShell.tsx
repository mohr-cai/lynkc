import { PlugZap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useChannelController } from "./hooks";
import { ChannelPad } from "./ChannelPad";
import { ChannelSidebar } from "./ChannelSidebar";
import { RemotePanel } from "./RemotePanel";
import { HistoryPanel } from "./HistoryPanel";

export function ChannelShell() {
  const controller = useChannelController();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-10 md:px-10">
      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-muted-foreground">
          <PlugZap className="h-4 w-4 text-primary" />
          LYNKC
        </div>
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">copy:paste via https</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          rust based secure clipboard. near-time sync, short time memory.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-[320px_1fr]">
        <ChannelSidebar
          channelInput={controller.channelInput}
          onChannelInputChange={controller.setChannelInput}
          channelPassword={controller.channelPassword}
          channelPasswordInput={controller.channelPasswordInput}
          onChannelPasswordChange={controller.setChannelPasswordInput}
          onJoinChannel={controller.handleJoinChannel}
          onCreateChannel={controller.handleCreateChannel}
          onCopyLink={controller.handleCopyChannelLink}
          onCopyPassword={controller.handleCopyChannelPassword}
          channelLink={controller.channelLink}
          status={controller.status}
          ttlLabel={controller.ttlLabel}
          error={controller.error}
          isCreating={controller.isCreating}
        />

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
            <div>
              <CardTitle>Clipboard pad</CardTitle>
              <CardDescription>Draft locally; encrypted sync ticks every 2s.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.85fr)] lg:gap-10">
            <div className="flex flex-col gap-6">
              <ChannelPad
                localContent={controller.localContent}
                onLocalContentChange={controller.setLocalContent}
                localFiles={controller.localFiles}
                bytesUsed={controller.bytesUsed}
                byteLimit={controller.channelByteLimit}
                isDragging={controller.isDragging}
                onDragOver={controller.handleDragOver}
                onDragLeave={controller.handleDragLeave}
                onDrop={controller.handleDrop}
                onFileSelect={controller.handleFileSelect}
                fileInputRef={controller.fileInputRef}
                onRemoveFile={controller.handleRemoveLocalFile}
                onCopyFile={controller.handleCopyFile}
                onDownloadFile={controller.handleDownloadFile}
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <RemotePanel
                remoteContent={controller.remoteContent}
                remoteFiles={controller.remoteFiles}
                isLocked={controller.requiresPassword}
                onCopyRemote={controller.handleCopyRemote}
                onCopyFile={controller.handleCopyFile}
                onDownloadFile={controller.handleDownloadFile}
                onDeleteFile={controller.handleDeleteRemoteFile}
              />
              <HistoryPanel
                entries={controller.history}
                isLocked={controller.requiresPassword}
                onSelectEntry={controller.handleApplyHistoryEntry}
                onDeleteEntry={controller.handleDeleteHistoryEntry}
              />
            </div>
            <div className="md:col-span-2">
              <Button
                className="w-full"
                onClick={controller.handleSync}
                disabled={controller.isSyncing || !controller.channelId}
              >
                {controller.isSyncing ? "syncing..." : "Resync channel"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
