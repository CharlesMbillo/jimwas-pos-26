import { createClient } from "npm:@supabase/supabase-js@2.39.3";

interface TokenCache { access_token: string; expires_at: number }
let tokenCache: TokenCache | null = null;
let ongoingTokenPromise: Promise<string> | null = null;

function now() { return Date.now(); }

export async function getAccessToken(params: { tokenUrl: string; clientId: string; clientSecret: string; }): Promise<string> {
  const { tokenUrl, clientId, clientSecret } = params;
  if (!tokenUrl || !clientId || !clientSecret) throw new Error('Missing KCB token config');

  if (tokenCache && now() < tokenCache.expires_at - 5000) {
    return tokenCache.access_token;
  }

  if (ongoingTokenPromise) return ongoingTokenPromise;

  ongoingTokenPromise = (async () => {
    // KCB expects a POST with application/x-www-form-urlencoded and Basic auth per docs
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: body.toString(),
    });

    const text = await resp.text();
    if (!resp.ok) {
      let msg = `Auth failed (${resp.status})`;
      try { const json = JSON.parse(text); msg = json.error_description || json.errorMessage || json.error || msg; } catch {}
      throw new Error(msg);
    }
    const data = JSON.parse(text);
    if (!data.access_token) throw new Error('No access token in response');
    const expiresIn = data.expires_in ? Number(data.expires_in) : 300;
    tokenCache = { access_token: data.access_token, expires_at: Date.now() + expiresIn * 1000 };
    ongoingTokenPromise = null;
    return tokenCache.access_token;
  })();

  return ongoingTokenPromise;
}

export async function stkPush(params: { baseUrl: string; token: string; body: Record<string, any>; timeoutMs?: number; headers?: Record<string,string> }) {
  const { baseUrl, token, body, timeoutMs = 30000, headers = {} } = params;
  // Use KCB STK push path per their spec
  const url = `${baseUrl.replace(/\/$/, '')}/mm/api/request/1.0.0/stkpush`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await resp.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!resp.ok) throw new Error(`STK push failed: ${resp.status} ${JSON.stringify(data)}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function queryStatus(params: { baseUrl: string; token: string; checkoutRequestId: string; timeoutMs?: number; }) {
  const { baseUrl, token, checkoutRequestId, timeoutMs = 15000 } = params;
  // KCB status query path as per spec
  const url = `${baseUrl.replace(/\/$/, '')}/mm/api/request/1.0.0/stkquery/${encodeURIComponent(checkoutRequestId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' }, signal: controller.signal });
    const text = await resp.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!resp.ok) throw new Error(`Status query failed: ${resp.status} ${JSON.stringify(data)}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}
