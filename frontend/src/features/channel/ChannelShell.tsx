import { PlugZap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
          lynkc
        </div>
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
          Clipboard tunnels for cursed infra moments
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Spawn a temporary channel and paste bytes through the browser when SSH forbids your clipboard. No disks, just
          Redis fog.
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
              <CardTitle>Paste pad</CardTitle>
              <CardDescription>
                Type or paste locally, then blast it through the tunnel. Remote view refreshes every 2s.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.5fr)] lg:gap-8">
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
              onSync={controller.handleSync}
              isSyncing={controller.isSyncing}
              channelId={controller.channelId}
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <RemotePanel
                remoteContent={controller.remoteContent}
                remoteFiles={controller.remoteFiles}
                isLocked={controller.requiresPassword}
                onCopyRemote={controller.handleCopyRemote}
                onCopyFile={controller.handleCopyFile}
                onDownloadFile={controller.handleDownloadFile}
              />
              <HistoryPanel
                entries={controller.history}
                isLocked={controller.requiresPassword}
                onSelectEntry={controller.handleApplyHistoryEntry}
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
