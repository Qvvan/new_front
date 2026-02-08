import type { ScreenName } from '../../app/routes';

/* ────────────────────────────────────────────────────────────
 * Deep Link System for Telegram Mini App
 * ────────────────────────────────────────────────────────────
 *
 * Format:  t.me/<bot>/<app>?startapp=<payload>
 *
 * Telegram constraints:
 *   - Only [A-Za-z0-9_-] allowed
 *   - Max 64 characters
 *
 * Payload encoding:
 *   <action>            — simple action  (e.g. "gift", "support")
 *   <action>__<param>   — with parameter (e.g. "activate-code__ABC123")
 *
 * Backward compatibility:
 *   - Pure digits (e.g. "123456")  → referral ID
 *   - "ref_<id>"                    → referral ID
 *
 * ──────────────────────────────────────────────────────────── */

const SEPARATOR = '__';

/** All possible deep link actions the app can handle. */
export type DeepLinkAction =
  | { type: 'navigate'; screen: ScreenName }
  | { type: 'activate-code'; code?: string }
  | { type: 'services'; mode?: 'buy' | 'renew' | 'gift' }
  | { type: 'gift' }
  | { type: 'daily-bonus' }
  | { type: 'instructions' }
  | { type: 'support' }
  | { type: 'news' };

/* ── Parsing ──────────────────────────────────────────────── */

const VALID_SCREENS: ScreenName[] = [
  'subscription', 'keys', 'referrals', 'payments', 'instructions', 'support',
];

const SERVICE_MODES = ['buy', 'renew', 'gift'] as const;
type ServiceMode = (typeof SERVICE_MODES)[number];

/**
 * Parse a Telegram `startapp` / `start_param` string into a DeepLinkAction.
 *
 * Returns `null` if the string doesn't match any known action
 * (e.g. it's a referral ID — handle those separately with `isReferralParam`).
 */
export function parseStartParam(raw: string): DeepLinkAction | null {
  if (!raw) return null;

  const sepIdx = raw.indexOf(SEPARATOR);
  const action = sepIdx === -1 ? raw : raw.slice(0, sepIdx);
  const param  = sepIdx === -1 ? ''  : raw.slice(sepIdx + SEPARATOR.length);

  switch (action) {
    case 'activate-code':
    case 'activate_code':
      return { type: 'activate-code', ...(param ? { code: param } : {}) };

    case 'services':
    case 'service':
      return {
        type: 'services',
        mode: (SERVICE_MODES as readonly string[]).includes(param)
          ? (param as ServiceMode)
          : 'buy',
      };

    case 'gift':
      return { type: 'gift' };

    case 'daily-bonus':
    case 'daily_bonus':
    case 'bonus':
      return { type: 'daily-bonus' };

    case 'instructions':
      return { type: 'instructions' };

    case 'support':
      return { type: 'support' };

    case 'news':
      return { type: 'news' };

    case 'screen': {
      if (param && VALID_SCREENS.includes(param as ScreenName)) {
        return { type: 'navigate', screen: param as ScreenName };
      }
      return null;
    }

    default:
      return null;
  }
}

/* ── Screen resolution ────────────────────────────────────── */

/** Determine which screen a deep link action should land on. */
export function getScreenForAction(action: DeepLinkAction): ScreenName {
  if (action.type === 'navigate') return action.screen;
  // Modal-based actions all live on the subscription screen
  return 'subscription';
}

/* ── Encoding ─────────────────────────────────────────────── */

/** Encode a DeepLinkAction into a startapp-compatible payload string. */
export function encodeDeepLink(action: DeepLinkAction): string {
  switch (action.type) {
    case 'navigate':
      return `screen${SEPARATOR}${action.screen}`;
    case 'activate-code':
      return action.code
        ? `activate-code${SEPARATOR}${action.code}`
        : 'activate-code';
    case 'services':
      return action.mode
        ? `services${SEPARATOR}${action.mode}`
        : 'services';
    case 'gift':
      return 'gift';
    case 'daily-bonus':
      return 'daily-bonus';
    case 'instructions':
      return 'instructions';
    case 'support':
      return 'support';
    case 'news':
      return 'news';
  }
}

/** Build a full Telegram deep link URL. */
export function buildDeepLinkUrl(
  bot: string,
  app: string,
  action: DeepLinkAction,
): string {
  return `https://t.me/${bot}/${app}?startapp=${encodeDeepLink(action)}`;
}

/* ── Helpers ──────────────────────────────────────────────── */

/** Check whether a start_param is a referral ID (handled separately). */
export function isReferralParam(raw: string): boolean {
  return /^\d+$/.test(raw) || raw.startsWith('ref_');
}

/**
 * Extract the raw startapp value from all available sources.
 * Priority: Telegram start_param > URL ?startapp= > URL ?start= > hash params
 */
export function extractStartParam(): string {
  // 1. Telegram WebApp start_param (most reliable)
  const tgParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (tgParam) return tgParam;

  // 2. URL query params (?startapp= or ?start=)
  const urlParams = new URLSearchParams(window.location.search);
  const urlValue = urlParams.get('startapp') ?? urlParams.get('start');
  if (urlValue) return urlValue;

  // 3. Hash-based params (HashRouter fallback)
  if (window.location.hash) {
    const hashQuery = window.location.hash.includes('?')
      ? window.location.hash.slice(window.location.hash.indexOf('?'))
      : '';
    if (hashQuery) {
      const hashParams = new URLSearchParams(hashQuery);
      const hashValue = hashParams.get('startapp') ?? hashParams.get('start');
      if (hashValue) return hashValue;
    }
  }

  return '';
}
