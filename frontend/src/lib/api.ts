export type ChannelFile = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  data_base64: string;
};

export type CreateChannelResponse = {
  id: string;
  ttl_seconds: number;
};

export type ChannelPayload = {
  id: string;
  text: string;
  files: ChannelFile[];
  ttl_seconds: number;
};

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

export async function createChannel(text?: string, files: ChannelFile[] = []) {
  const response = await fetch(buildUrl("/api/channels"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: text ?? null, files }),
  });

  if (!response.ok) {
    throw new Error(`failed to create channel: ${response.statusText}`);
  }

  return (await response.json()) as CreateChannelResponse;
}

export async function fetchChannel(id: string) {
  const response = await fetch(buildUrl(`/api/channels/${id}`), {
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("channel not found");
  }

  if (!response.ok) {
    throw new Error(`failed to fetch channel: ${response.statusText}`);
  }

  return (await response.json()) as ChannelPayload;
}

export async function updateChannel(id: string, text: string, files: ChannelFile[] = []) {
  const response = await fetch(buildUrl(`/api/channels/${id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, files }),
  });

  if (response.status === 404) {
    throw new Error("channel not found");
  }

  if (!response.ok) {
    throw new Error(`failed to update channel: ${response.statusText}`);
  }
}
