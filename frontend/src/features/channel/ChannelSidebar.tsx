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
        <CardTitle>Tunnel ops</CardTitle>
        <CardDescription>Provision a fresh Rust tunnel or hook into one mid-flight.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="channel-id">Channel ID</Label>
              <Input
                id="channel-id"
                placeholder="tunnel-hash"
                value={channelInput}
                onChange={(event) => onChannelInputChange(event.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="channel-password">Channel password</Label>
              <Input
                id="channel-password"
                placeholder="handshake-secret"
                value={channelPasswordInput}
                onChange={(event) => onChannelPasswordChange(event.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              We handshake once per session to decrypt the tunnel.
            </p>
          </div>
          <Button onClick={onJoinChannel} className="w-full" variant="secondary">
            Attach to tunnel
          </Button>
          {channelLink ? (
            <Button type="button" variant="ghost" className="w-full" onClick={onCopyLink}>
              Copy tunnel link
            </Button>
          ) : null}
          {channelPassword ? (
            <Button type="button" variant="ghost" className="w-full" onClick={onCopyPassword}>
              Copy tunnel secret
            </Button>
          ) : null}
        </div>
        <div className="space-y-2 pt-2">
          <Button onClick={onCreateChannel} disabled={isCreating} className="w-full">
            {isCreating ? "forging..." : "Forge new tunnel"}
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
