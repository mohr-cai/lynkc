import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChannelSidebarProps {
  channelInput: string;
  onChannelInputChange: (value: string) => void;
  channelPassword: string | null;
  channelPasswordInput: string;
  onChannelPasswordChange: (value: string) => void;
  onJoinChannel: () => void;
  onCreateChannel: () => void;
  onCopyLink: () => void;
  onCopyPassword: () => void;
  channelLink: string | null;
  status: string;
  ttlLabel: string;
  error: string | null;
  isCreating: boolean;
}

export function ChannelSidebar({
  channelInput,
  onChannelInputChange,
  channelPassword,
  channelPasswordInput,
  onChannelPasswordChange,
  onJoinChannel,
  onCreateChannel,
  onCopyLink,
  onCopyPassword,
  channelLink,
  status,
  ttlLabel,
  error,
  isCreating,
}: ChannelSidebarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel control</CardTitle>
        <CardDescription>Create fresh or hook into an existing tunnel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="channel-id">Channel ID</Label>
          <Input
            id="channel-id"
            placeholder="ghost-id"
            value={channelInput}
            onChange={(event) => onChannelInputChange(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
          />
          <Label htmlFor="channel-password">Channel password</Label>
          <Input
            id="channel-password"
            placeholder="top-secret"
            value={channelPasswordInput}
            onChange={(event) => onChannelPasswordChange(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">Required once per session to access a channel.</p>
          <Button onClick={onJoinChannel} className="w-full" variant="secondary">
            Attach to channel
          </Button>
          {channelLink ? (
            <Button type="button" variant="ghost" className="w-full" onClick={onCopyLink}>
              Copy shareable link
            </Button>
          ) : null}
          {channelPassword ? (
            <Button type="button" variant="ghost" className="w-full" onClick={onCopyPassword}>
              Copy channel password
            </Button>
          ) : null}
        </div>
        <div className="space-y-2 pt-2">
          <Button onClick={onCreateChannel} disabled={isCreating} className="w-full">
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
          <div className="mt-2 flex items-center justify-between font-mono text-[0.75rem] uppercase">
            <span>Password</span>
            <span className="truncate" title={channelPassword ?? undefined}>
              {channelPassword ?? "--"}
            </span>
          </div>
        </div>
        {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
