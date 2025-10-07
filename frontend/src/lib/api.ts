export type ChannelFile = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  data_base64: string;
};

export type CreateChannelResponse = {
  id: string;
  password: string;
  ttl_seconds: number;
};

export type ChannelPayload = {
  id: string;
  text: string;
  files: ChannelFile[];
  ttl_seconds: number;
};

const CHANNEL_PASSWORD_HEADER = "x-channel-password";

function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:8080";
}

function buildUrl(path: string) {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export async function createChannel({
  text,
  files = [],
  password,
}: {
  text?: string;
  files?: ChannelFile[];
  password?: string;
}) {
  const response = await fetch(buildUrl("/api/channels"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: text ?? null, files, password: password ?? null }),
  });

  if (!response.ok) {
    throw new Error(`failed to create channel: ${response.statusText}`);
  }

  return (await response.json()) as CreateChannelResponse;
}

export async function fetchChannel(id: string, password: string) {
  const response = await fetch(buildUrl(`/api/channels/${id}`), {
    cache: "no-store",
    headers: {
      [CHANNEL_PASSWORD_HEADER]: password,
    },
  });

  if (response.status === 404) {
    throw new Error("channel not found");
  }

  if (response.status === 401) {
    throw new Error("invalid channel password");
  }

  if (!response.ok) {
    throw new Error(`failed to fetch channel: ${response.statusText}`);
  }

  return (await response.json()) as ChannelPayload;
}

export async function updateChannel(id: string, password: string, text: string, files: ChannelFile[] = []) {
  const response = await fetch(buildUrl(`/api/channels/${id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      [CHANNEL_PASSWORD_HEADER]: password,
    },
    body: JSON.stringify({ text, files }),
  });

  if (response.status === 404) {
    throw new Error("channel not found");
  }

  if (response.status === 401) {
    throw new Error("invalid channel password");
  }

  if (!response.ok) {
    throw new Error(`failed to update channel: ${response.statusText}`);
  }
}

export async function deleteChannelFile(id: string, password: string, fileId: string) {
  const response = await fetch(buildUrl(`/api/channels/${id}/files/${fileId}`), {
    method: "DELETE",
    headers: {
      [CHANNEL_PASSWORD_HEADER]: password,
    },
  });

  if (response.status === 404) {
    let message = "channel file not found";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // ignored: fall back to default message
    }
    throw new Error(message);
  }

  if (response.status === 401) {
    throw new Error("invalid channel password");
  }

  if (!response.ok) {
    throw new Error(`failed to delete channel file: ${response.statusText}`);
  }
}
