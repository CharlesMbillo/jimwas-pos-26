const baseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const callback = process.env.KCB_BUNI_CALLBACK_URL || '';
const checks = [];
const check = async (name, url, required = true) => {
  if (!url) { checks.push({ name, ok: !required, skipped: true }); return; }
  try { const response = await fetch(url, { method: 'GET', redirect: 'manual' }); checks.push({ name, ok: response.status < 500, status: response.status }); }
  catch (error) { checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) }); }
};
await check('Supabase REST', baseUrl ? `${baseUrl}/rest/v1/` : '', true);
await check('Supabase functions gateway', baseUrl ? `${baseUrl}/functions/v1/` : '', true);
checks.push({ name: 'KCB callback configured', ok: callback.startsWith('https://'), configured: Boolean(callback) });
const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
process.exit(failed.length ? 1 : 0);
