import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi, keysApi, serversApi, type UserKeyItem, type ServerOnlineItem } from '../../core/api/endpoints';
import { userApi } from '../../core/api/endpoints';
import { useAppNavigate } from '../../app/AppLayout';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { daysBetween, copyToClipboard } from '../../core/utils';
import { staggerContainer, staggerItem } from '../../shared/motion/variants';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';

function getCountryFlag(name: string): string {
  const m: Record<string, string> = {
    nl: '🇳🇱', 'нидерланды': '🇳🇱', de: '🇩🇪', 'германия': '🇩🇪',
    fr: '🇫🇷', 'франция': '🇫🇷', us: '🇺🇸', 'сша': '🇺🇸',
    gb: '🇬🇧', uk: '🇬🇧', 'великобритания': '🇬🇧',
    ru: '🇷🇺', 'россия': '🇷🇺', jp: '🇯🇵', 'япония': '🇯🇵',
    ca: '🇨🇦', 'канада': '🇨🇦', se: '🇸🇪', 'швеция': '🇸🇪',
    ch: '🇨🇭', 'швейцария': '🇨🇭', fi: '🇫🇮', 'финляндия': '🇫🇮',
    'турция': '🇹🇷', tr: '🇹🇷', 'казахстан': '🇰🇿', kz: '🇰🇿',
  };
  const lower = (name ?? '').toLowerCase();
  return m[lower] ?? '🌐';
}

const MAX_USERS = 100;

function getLoadColor(percent: number): string {
  const p = Math.min(100, Math.max(0, percent)) / 100;
  let r: number, g: number, b: number;
  if (p < 0.5) {
    const t = p * 2;
    r = Math.round(73 + (255 - 73) * t);
    g = Math.round(190 + (175 - 190) * t);
    b = Math.round(77 + (55 - 77) * t);
  } else {
    const t = (p - 0.5) * 2;
    r = Math.round(255 + (255 - 255) * t);
    g = Math.round(175 - 175 * t);
    b = Math.round(55 - 20 * t);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function getLoadLabel(percent: number): string {
  if (percent <= 20) return 'Свободно';
  if (percent <= 50) return 'Умеренно';
  if (percent <= 80) return 'Загружен';
  return 'Перегружен';
}

function getStatusDotClass(percent: number): string {
  if (percent <= 20) return 'nx-dot-free';
  if (percent <= 50) return 'nx-dot-moderate';
  if (percent <= 80) return 'nx-dot-loaded';
  return 'nx-dot-overloaded';
}

function parseKeyName(key: string): string {
  const hash = key.lastIndexOf('#');
  return hash !== -1 ? decodeURIComponent(key.slice(hash + 1)) : 'VPN ключ';
}

type KeyRowItem = { key: string; keyName: string; serverName: string; serverId: number; port: number };

type SubKeyGroup = {
  subscriptionId: string | number;
  subscriptionName: string;
  keys: KeyRowItem[];
};

export function KeysScreen() {
  const { navigate } = useAppNavigate();
  const toast = useToast();
  const tg = useTelegram();
  const [activeTab, setActiveTab] = useState<'servers' | 'keys'>('keys');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => userApi.getCurrentUser(),
  });
  const userId = (user as { telegram_id?: number })?.telegram_id ?? (user as { user_id?: number })?.user_id;

  const { data: subsRes } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  });
  const subscriptions = Array.isArray(subsRes) ? subsRes : (subsRes as { subscriptions?: unknown[] })?.subscriptions ?? [];

  const { data: keyGroups } = useQuery({
    queryKey: ['keys', userId, subscriptions.map((s: unknown) => (s as { subscription_id?: string; id?: string }).subscription_id ?? (s as { id?: string }).id)],
    queryFn: async (): Promise<SubKeyGroup[]> => {
      const groups: SubKeyGroup[] = [];
      for (const sub of subscriptions) {
        const typedSub = sub as { subscription_id?: string; id?: string; custom_name?: string; service_name?: string };
        const subId = typedSub.subscription_id ?? typedSub.id;
        if (!subId) continue;
        const subName = typedSub.custom_name || typedSub.service_name || `Подписка #${String(subId).slice(0, 8)}`;
        const keys: KeyRowItem[] = [];
        try {
          if (userId && subId) {
            const r = await keysApi.getUserKeys(userId, subId);
            const keyItems = (r.keys ?? []) as UserKeyItem[];
            keyItems.forEach((item) => {
              keys.push({
                key: item.key,
                keyName: parseKeyName(item.key),
                serverName: item.server_name,
                serverId: item.server_id,
                port: item.port,
              });
            });
          } else {
            const r = await keysApi.getKeys(String(subId));
            const rawKeys = (r.keys ?? []) as { key?: string }[];
            rawKeys.forEach((k) => {
              const keyStr = typeof k === 'string' ? k : (k?.key ?? '');
              if (keyStr) {
                keys.push({
                  key: keyStr,
                  keyName: parseKeyName(keyStr),
                  serverName: 'VPN',
                  serverId: 0,
                  port: 0,
                });
              }
            });
          }
        } catch {
          // skip failed subscription
        }
        if (keys.length > 0) {
          groups.push({ subscriptionId: subId, subscriptionName: subName, keys });
        }
      }
      return groups;
    },
    enabled: !!userId && subscriptions.length > 0,
  });

  const totalKeys = (keyGroups ?? []).reduce((sum, g) => sum + g.keys.length, 0);
  const multipleSubscriptions = subscriptions.length > 1;

  const { data: serversRes } = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list(),
    refetchInterval: 30000,
  });
  const servers: ServerOnlineItem[] = (serversRes as { servers?: ServerOnlineItem[] })?.servers ?? [];

  const hasActive = (subscriptions as { end_date?: string; status?: string; is_active?: boolean }[]).some(s => {
    const days = daysBetween(s.end_date ?? '');
    return days > 0 && (s.status === 'active' || s.is_active);
  });

  const copyKey = async (key: string) => {
    tg?.haptic.light();
    const ok = await copyToClipboard(key);
    if (ok) toast.copied('Ключ скопирован');
  };

  const copyProfile = async (url: string) => {
    if (!url) { toast.warning('Профиль недоступен'); return; }
    tg?.haptic.light();
    const ok = await copyToClipboard(url);
    if (ok) toast.copied('Профиль скопирован');
  };

  const installProfile = (url: string) => {
    tg?.openLink?.(url) ?? window.open(url, '_blank');
    toast.success('Открываем установку профиля...');
  };

  const mainProfile = (subscriptions as { end_date?: string; status?: string; config_link?: string }[]).find(s => {
    const days = daysBetween(s.end_date ?? '');
    return days > 0 && (s.status === 'active' || (s as { is_active?: boolean }).is_active) && s.config_link;
  });
  const profileUrl = mainProfile?.config_link
    ? `https://skydragonvpn.ru/sub/${mainProfile.config_link}`
    : null;

  return (
    <div className="screen active" id="keysScreen">
      <motion.div variants={staggerContainer} initial="initial" animate="animate">

        {/* Heading */}
        <motion.div className="nexus-screen-heading" variants={staggerItem}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <TgsPlayer src={`${ASSETS_GIFS}/vpn-access.tgs`} fallbackIcon="fas fa-shield-alt" width={28} height={28} />
          </span>
          <h2>VPN Доступ</h2>
        </motion.div>

        {/* Profile card — above tabs when active */}
        {hasActive && profileUrl && (
          <motion.div variants={staggerItem}>
            <div className="nexus-profile-card">
              <div className="nexus-profile-header">
                <span className="nexus-profile-label">Основной профиль VPN</span>
                <span className="nexus-profile-status">
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--nx-green)', display: 'inline-block' }} />
                  Активен
                </span>
              </div>
              <div className="nexus-profile-url">
                {profileUrl.length > 55 ? profileUrl.slice(0, 50) + '…' : profileUrl}
              </div>
              <div className="nexus-profile-actions">
                <button type="button" className="nexus-btn-sm nexus-btn-sm--secondary" onClick={() => copyProfile(profileUrl)}>
                  <i className="fas fa-copy" /> Скопировать
                </button>
                <button type="button" className="nexus-btn-sm nexus-btn-sm--primary" onClick={() => installProfile(profileUrl)}>
                  <i className="fas fa-download" /> Установить
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pill Tab Switcher */}
        <motion.div className="nexus-pill-tabs" variants={staggerItem}>
          <button
            type="button"
            className={`nexus-pill-tab${activeTab === 'servers' ? ' active' : ''}`}
            onClick={() => setActiveTab('servers')}
          >
            <i className="fas fa-server" /> Сервера
          </button>
          <button
            type="button"
            className={`nexus-pill-tab${activeTab === 'keys' ? ' active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            <i className="fas fa-key" /> Ключи
          </button>
        </motion.div>

        {/* ── Servers Tab ── */}
        {activeTab === 'servers' && (
          <motion.div variants={staggerItem} initial={false}>
            {servers.length === 0 ? (
              <div className="nexus-empty">
                <div className="nexus-empty-icon">
                  <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-server" width={50} height={50} />
                </div>
                <h3 className="nexus-empty-title">Серверы временно недоступны</h3>
              </div>
            ) : (
              <div className="nexus-server-list">
                {servers.map((server, i) => {
                  const online = server.online ?? 0;
                  const percent = Math.min(100, Math.round((online / MAX_USERS) * 100));
                  const barColor = getLoadColor(percent);
                  const flag = getCountryFlag(server.server_name ?? '');
                  const label = getLoadLabel(percent);
                  const dotClass = getStatusDotClass(percent);
                  return (
                    <div key={server.server_id ?? i} className="nexus-server-card">
                      <div className="nexus-server-header">
                        <span className="nexus-server-flag">{flag}</span>
                        <div className="nexus-server-info">
                          <div className="nexus-server-name">{server.server_name ?? 'VPN'}</div>
                          <div className="nexus-server-status">
                            <span className={`nexus-server-status-dot ${dotClass}`} />
                            <span style={{ color: barColor }}>{label}</span>
                          </div>
                        </div>
                        <div className="nexus-server-percent" style={{ color: barColor }}>
                          {percent}<span style={{ fontSize: 12, opacity: 0.7 }}>%</span>
                        </div>
                      </div>
                      <div className="nexus-load-bar-wrap">
                        <div
                          className="nexus-load-bar"
                          style={{
                            width: `${percent}%`,
                            background: `linear-gradient(90deg, #49be6a, ${barColor})`,
                            boxShadow: `0 0 8px ${barColor}40`,
                          }}
                        />
                      </div>
                      <div className="nexus-server-meta">
                        <span>Онлайн: {online} / {MAX_USERS}</span>
                        <span style={{ display: 'flex', gap: 8 }}>
                          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Keys Tab ── */}
        {activeTab === 'keys' && (
          <motion.div variants={staggerItem} initial={false}>
            {!hasActive ? (
              <div className="nexus-empty">
                <div className="nexus-empty-icon">
                  <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-key" width={50} height={50} />
                </div>
                <h3 className="nexus-empty-title">Доступно с подпиской</h3>
                <p className="nexus-empty-text">Оформите подписку чтобы получить VPN ключи</p>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="nexus-purchase-btn"
                    onClick={() => navigate('subscription')}
                  >
                    <i className="fas fa-bolt" />
                    <span>Оформить подписку</span>
                  </button>
                </div>
              </div>
            ) : totalKeys === 0 ? (
              <div className="nexus-empty">
                <div className="nexus-empty-icon">
                  <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-key" width={50} height={50} />
                </div>
                <h3 className="nexus-empty-title">Нет ключей</h3>
                <p className="nexus-empty-text">Ключи появятся после активации подписки</p>
              </div>
            ) : (
              <div>
                {/* Key groups */}
                {(keyGroups ?? []).map((group) => (
                  <div key={group.subscriptionId} className="nexus-key-group">
                    {multipleSubscriptions && (
                      <div className="nexus-key-group-header">
                        <i className="fas fa-shield-alt" />
                        <span>{group.subscriptionName}</span>
                      </div>
                    )}
                    {group.keys.map((item, i) => {
                      const flag = getCountryFlag(item.serverName);
                      return (
                        <div
                          key={`key-${group.subscriptionId}-${i}`}
                          className="nexus-key-card"
                          onClick={() => copyKey(item.key)}
                          role="button"
                          tabIndex={0}
                        >
                          <span className="nexus-key-flag">{flag}</span>
                          <div className="nexus-key-info">
                            <div className="nexus-key-name">{item.keyName}</div>
                            <div className="nexus-key-preview">
                              {item.key.length > 55 ? item.key.slice(0, 48) + '…' : item.key}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="nexus-copy-btn"
                            onClick={e => { e.stopPropagation(); copyKey(item.key); }}
                            title="Скопировать ключ"
                          >
                            <i className="fas fa-copy" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
