let csrfToken = null;

export function setCsrf(token) {
  csrfToken = token;
}

async function ensureCsrf() {
  if (csrfToken) return;
  const res = await fetch('/api/auth/csrf', { credentials: 'include' });
  csrfToken = (await res.json()).csrfToken;
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (!['GET', 'HEAD'].includes(method)) {
    await ensureCsrf();
    headers['x-csrf-token'] = csrfToken;
  }
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}
