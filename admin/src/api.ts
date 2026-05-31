const BASE = '/admin/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers:
      init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json', ...(init.headers || {}) }
        : init.headers,
    ...init,
  });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'Unauthorized');
  }
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: <T>(p: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>(p, { method: 'POST', body: fd });
  },
  // Returns the raw URL for downloads (cookie sent by the browser).
  rawUrl: (p: string) => `${BASE}${p}`,
};
