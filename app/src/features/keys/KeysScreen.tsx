import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi, keysApi, serversApi } from '../../core/api/endpoints';
import { userApi } from '../../core/api/endpoints';
import { useAppNavigate } from '../../app/AppLayout';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { daysBetween, copyToClipboard } from '../../core/utils';
import { staggerContainer, staggerItem } from '../../shared/motion/variants';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';

function getCountryFlag(name: string): string {
  const m: Record<string, string> = {
    nl: '🇳🇱', de: '🇩🇪', fr: '🇫🇷', us: '🇺🇸', gb: '🇬🇧', uk: '🇬🇧',
    ru: '🇷🇺', jp: '🇯🇵', ca: '🇨🇦', se: '🇸🇪', ch: '🇨🇭', fi: '🇫🇮',
  };
  const lower = (name ?? '').toLowerCase();
  return m[lower] ?? '🌐';
}

function parseServerFromKey(key: string): { name: string; flag: string } {
  const hash = key.lastIndexOf('#');
  const name = hash !== -1 ? decodeURIComponent(key.slice(hash + 1)) : 'VPN сервер';
  return { name, flag: getCountryFlag(name) };
}

export function KeysScreen() {
  const { navigate } = useAppNavigate();
  const toast = useToast();
  const tg = useTelegram();
  const [activeTab, setActiveTab] = useState<'servers' | 'keys'>('servers');

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

  const { data: keysBySub } = useQuery({
    queryKey: ['keys', userId, subscriptions.map((s: unknown) => (s as { subscription_id?: string; id?: string }).subscription_id ?? (s as { id?: string }).id)],
    queryFn: async () => {
      const all: { key: string; subscription?: unknown; subscription_id?: string }[] = [];
      for (const sub of subscriptions) {
        const subId = (sub as { subscription_id?: string; id?: string }).subscription_id ?? (sub as { id?: string }).id;
        if (!subId) continue;
        try {
          let keys: string[] = [];
          if (userId && subId) {
            const r = await keysApi.getUserKeys(userId, subId);
            keys = r.keys ?? [];
          } else {
            const r = await keysApi.getKeys(String(subId));
            keys = (r.keys ?? []).map((k: unknown) => typeof k === 'string' ? k : (k as { key?: string }).key ?? '');
          }
          keys.forEach(k => all.push({ key: typeof k === 'string' ? k : (k as { key?: string }).key ?? '', subscription: sub, subscription_id: String(subId) }));
        } catch {}
      }
      return all;
    },
    enabled: !!userId && subscriptions.length > 0,
  });

  const { data: serversRes } = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list(),
  });
  const servers = Array.isArray(serversRes) ? serversRes : (serversRes as { servers?: unknown[] })?.servers ?? [];

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
      <motion.div className="content-wrapper" variants={staggerContainer} initial="initial" animate="animate">
        <motion.div className="section" variants={staggerItem}>
          <h2 className="section-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}><TgsPlayer src={`${ASSETS_GIFS}/vpn-access.tgs`} fallbackIcon="fas fa-shield-alt" width={32} height={32} /></span>
            VPN Доступ
          </h2>
        </motion.div>
        <motion.div className="tabs" variants={staggerItem}>
          <div className="tabs-nav">
            <button type="button" className={`tab-button ${activeTab === 'servers' ? 'active' : ''}`} onClick={() => setActiveTab('servers')}>
              <i className="fas fa-server" /> Сервера
            </button>
            <button type="button" className={`tab-button ${activeTab === 'keys' ? 'active' : ''}`} onClick={() => setActiveTab('keys')}>
              <i className="fas fa-key" /> Ключи
            </button>
          </div>
        </motion.div>

        {activeTab === 'servers' && (
          <motion.div className="tab-content-container" variants={staggerItem}>
            {servers.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-content">
                  <div className="empty-state-icon-gif">
                    <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-server" width={80} height={80} />
                  </div>
                  <h3 className="empty-state-title">Серверы временно недоступны</h3>
                </div>
              </div>
            ) : (
              <div className="servers-list">
                {(servers as { server_id?: string; id?: string; name?: string; country?: string; current_users?: number; max_users?: number }[]).map((server, i) => {
                  const load = server.current_users != null && server.max_users ? Math.round((server.current_users / server.max_users) * 100) : 0;
                  const flag = getCountryFlag(server.country ?? server.name ?? '');
                  return (
                    <div key={server.server_id ?? server.id ?? i} className="server-card">
                      <div className="server-card-content">
                        <div className="server-card-header">
                          <div className="server-flag-large">{flag}</div>
                          <h3 className="server-card-name">{server.name ?? server.country ?? 'VPN'}</h3>
                        </div>
                        <div className="server-card-body">
                          <div className="server-load-info">
                            <span className="server-load-text">Нагрузка: {server.current_users ?? 0} из {server.max_users ?? '?'}</span>
                            <div className="server-load-bar-container">
                              <div className="server-load-bar">
                                <div className={`server-load-fill ${load >= 80 ? 'high' : load >= 50 ? 'medium' : 'low'}`} style={{ width: `${load}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'keys' && (
          <motion.div className="tab-content-container" variants={staggerItem}>
            {!hasActive ? (
              <div className="empty-state-card">
                <div className="empty-state-content">
                  <div className="empty-state-icon-gif">
                    <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-key" width={80} height={80} />
                  </div>
                  <h3 className="empty-state-title">Доступно с подпиской</h3>
                  <p className="empty-state-text">Оформите подписку чтобы получить VPN ключи</p>
                  <div className="empty-state-actions">
                    <button type="button" className="btn-subscription-purchase" onClick={() => navigate('subscription')}>
                      <div className="btn-purchase-bg" />
                      <div className="btn-purchase-content">
                        <i className="fas fa-bolt" />
                        <span>Оформить подписку</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : keysBySub?.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-content">
                  <div className="empty-state-icon-gif">
                    <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-key" width={80} height={80} />
                  </div>
                  <h3 className="empty-state-title">Нет ключей</h3>
                  <p className="empty-state-text">Ключи появятся после активации подписки</p>
                </div>
              </div>
            ) : (
              <div className="keys-content">
                {profileUrl && (
                  <div className="main-profile-card">
                    <div className="main-profile-header">
                      <h4>Основной профиль VPN</h4>
                      <span className="profile-status active">Активен</span>
                    </div>
                    <div className="main-profile-content">
                      <div className="profile-url-display"><code>{profileUrl.length > 50 ? profileUrl.slice(0, 45) + '...' : profileUrl}</code></div>
                      <div className="profile-actions">
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => copyProfile(profileUrl)}><i className="fas fa-copy" /> Скопировать</button>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => installProfile(profileUrl)}><i className="fas fa-download" /> Установить</button>
                      </div>
                    </div>
                  </div>
                )}
                {(keysBySub ?? []).map((item, i) => {
                  const keyStr = typeof item.key === 'string' ? item.key : (item as { key?: string }).key ?? '';
                  const { name, flag } = parseServerFromKey(keyStr);
                  return (
                    <div key={i} className="key-row" onClick={() => copyKey(keyStr)} role="button" tabIndex={0}>
                      <div className="key-info">
                        <div className="key-name"><span className="server-flag">{flag}</span> <span className="key-label">{name}</span></div>
                        <div className="key-preview">{keyStr.length > 60 ? keyStr.slice(0, 50) + '…' : keyStr}</div>
                      </div>
                      <button type="button" className="copy-btn key-copy-btn" onClick={e => { e.stopPropagation(); copyKey(keyStr); }}><i className="fas fa-copy" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
