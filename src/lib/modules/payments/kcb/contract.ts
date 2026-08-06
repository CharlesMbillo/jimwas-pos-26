import { validateAmount, normalizePhoneNumber } from './utils';

export type KCBEnvironment = 'sandbox' | 'production';
export type KCBLocalStatus = 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance' | 'unknown';

export const KCB_FUNCTION_NAMES = {
  stk: 'kcb-stk-push',
  callback: 'kcb-ipn-notification',
  status: 'mpesa-status',
  timeout: 'mpesa-timeout',
} as const;

export function getKCBCallbackUrl(supabaseUrl: string, override?: string | null): string {
  if (override?.trim()) return override.trim();
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${KCB_FUNCTION_NAMES.callback}`;
}

export function normalizeKenyanPhone(phone: string): string | null {
  const normalized = normalizePhoneNumber(phone);
  return /^254(?:7|1)\d{8}$/.test(normalized) ? normalized : null;
}

export function isValidKCBAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && validateAmount(amount);
}

export function mapKCBResultCode(code: unknown): KCBLocalStatus {
  const value = String(code ?? '').trim();
  if (value === '0' || value === '00000000') return 'success';
  if (value === '1032' || value.toLowerCase().includes('cancel')) return 'cancelled';
  if (value === '1001' || value === '20') return 'timeout';
  if (value === '1' || value === '14') return 'insufficient_balance';
  if (!value || value === 'pending' || value === 'processing') return 'pending';
  return 'failed';
}

export function isTerminalKCBStatus(status: string | null | undefined): boolean {
  return ['success', 'failed', 'cancelled', 'timeout', 'insufficient_balance'].includes(String(status));
}

export function maskKCBPhone(phone: string | null | undefined): string {
  const value = String(phone ?? '');
  return value.length >= 7 ? `${value.slice(0, 5)}••••${value.slice(-3)}` : '••••';
}

export function redactKCBText(value: unknown): string {
  return String(value ?? '')
    .replace(/(authorization|client_secret|access_token|passkey|password)\s*[:=]\s*[^,} ]+/gi, '$1=[REDACTED]')
    .replace(/254(?:7|1)\d{8}/g, (phone) => maskKCBPhone(phone));
}
