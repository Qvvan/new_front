import { createHashRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';

export type ScreenName = 'subscription' | 'keys' | 'referrals' | 'payments' | 'instructions' | 'support';

export function parseDeepLink(search: string, hash: string): { screen: ScreenName; params: Record<string, string> } | null {
  const params = new URLSearchParams(search);
  const hashParams = hash ? new URLSearchParams(hash.slice(1)) : null;
  const all: Record<string, string> = {};
  hashParams?.forEach((v, k) => { all[k] = v; });
  params.forEach((v, k) => { all[k] = v; });

  const has = (k: string) => k in all;

  if (has('activate-code') || has('activate_code')) {
    return { screen: 'subscription', params: { action: 'activate-code', ...(all['activate-code'] || all['activate_code'] ? { code: all['activate-code'] || all['activate_code'] } : {}) } };
  }
  if (has('services') || has('service')) {
    return { screen: 'subscription', params: { action: 'services', mode: all.mode || 'buy', ...all } };
  }
  if (has('gift')) return { screen: 'subscription', params: { action: 'gift', ...all } };
  if (has('daily-bonus') || has('daily_bonus') || has('bonus')) return { screen: 'subscription', params: { action: 'daily-bonus', ...all } };
  if (has('news')) return { screen: 'subscription', params: { action: 'news', ...all } };

  const screen = all.screen as ScreenName | undefined;
  const valid: ScreenName[] = ['subscription', 'keys', 'referrals', 'payments', 'instructions', 'support'];
  if (screen && valid.includes(screen)) return { screen, params: all };

  const hashScreen = hash.slice(1).split('?')[0] as ScreenName;
  if (hashScreen && valid.includes(hashScreen)) return { screen: hashScreen, params: all };

  if (all.activate || all.code) return { screen: 'instructions', params: all };
  return null;
}

function Home() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const screen = (() => {
    const deep = parseDeepLink(search, hash);
    if (deep) return deep.screen;
    const p = new URLSearchParams(search);
    const s = p.get('screen') as ScreenName | null;
    if (s && ['subscription', 'keys', 'referrals', 'payments'].includes(s)) return s;
    return 'subscription';
  })();
  return <AppLayout defaultScreen={screen} />;
}

export const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
