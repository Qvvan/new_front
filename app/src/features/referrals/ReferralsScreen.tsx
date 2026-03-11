import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { referralApi } from '../../core/api/endpoints';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { copyToClipboard, formatDate } from '../../core/utils';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';
import { staggerContainer, staggerItem } from '../../shared/motion/variants';

function useReferralLink(): string {
  const tg = useTelegram();
  const userId = tg?.user?.id;
  const bot = 'SuperSummaryBot';
  return userId ? `https://t.me/${bot}/sky?startapp=ref_${userId}` : '';
}

export function ReferralsScreen() {
  const toast = useToast();
  const tg = useTelegram();
  const link = useReferralLink();

  const { data: refsRes } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => referralApi.list(),
  });
  const referrals = Array.isArray(refsRes) ? refsRes : (refsRes as { referrals?: unknown[] })?.referrals ?? [];

  const typedRefs = referrals as { user?: Record<string, unknown>; bonus_granted?: boolean; bonus_days?: number }[];
  const stats = {
    total_count: referrals.length,
    partners: typedRefs.filter(r => r.bonus_granted === true).length,
  };
  const bonusDays = typedRefs.reduce((sum, r) => sum + (r.bonus_days ?? 0), 0);

  const shareToTelegram = () => {
    const name = tg?.user?.first_name ?? 'Друг';
    const text = `🚀 ${name} приглашает в Dragon VPN!\n🎁 Получи бонусы при регистрации\n🔒 Безлимитный VPN доступ`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    tg?.openTelegramLink?.(url) ?? window.open(url, '_blank');
  };

  const copyLink = async () => {
    const ok = await copyToClipboard(link);
    if (ok) toast.copied('Реферальная ссылка скопирована');
  };

  return (
    <div className="screen active" id="referralsScreen">
      <motion.div variants={staggerContainer} initial="initial" animate="animate">

        {/* Hero */}
        <motion.div className="nexus-ref-hero" variants={staggerItem}>
          <div className="nexus-ref-hero-icon">
            <TgsPlayer src={`${ASSETS_GIFS}/referral-invite.tgs`} fallbackIcon="fas fa-users" width={36} height={36} />
          </div>
          <div className="nexus-ref-title">Приглашай друзей</div>
          <div className="nexus-ref-subtitle">Получай бонусы за каждого друга</div>
        </motion.div>

        {/* Stats */}
        <motion.div className="nexus-stats-row" variants={staggerItem}>
          <div className="nexus-stat-card">
            <div className="nexus-stat-value">{stats.total_count}</div>
            <div className="nexus-stat-label">Приглашено рефералов</div>
          </div>
          <div className="nexus-stat-card">
            <div className="nexus-stat-value" style={{ color: 'var(--nx-cyan)' }}>{bonusDays}</div>
            <div className="nexus-stat-label">Бонусных дней</div>
          </div>
          <div className="nexus-stat-card">
            <div className="nexus-stat-value" style={{ color: 'var(--nx-green)' }}>{stats.partners}</div>
            <div className="nexus-stat-label">Активных</div>
          </div>
        </motion.div>

        {/* Share Buttons */}
        <motion.div variants={staggerItem}>
          <div className="nexus-section-label">Поделиться</div>
          <div className="nexus-share-grid">
            <div className="nexus-share-card" onClick={shareToTelegram} role="button" tabIndex={0}>
              <div className="nexus-share-icon nexus-share-icon--tg">
                <TgsPlayer src={`${ASSETS_GIFS}/telegram-share.tgs`} fallbackIcon="fab fa-telegram-plane" width={32} height={32} />
              </div>
              <div className="nexus-share-title">Telegram</div>
              <div className="nexus-share-subtitle">Нескольким друзьям</div>
            </div>

            <div className="nexus-share-card" onClick={shareToTelegram} role="button" tabIndex={0}>
              <div className="nexus-share-icon nexus-share-icon--stories">
                <TgsPlayer src={`${ASSETS_GIFS}/story-share.tgs`} fallbackIcon="fas fa-bolt" width={32} height={32} />
              </div>
              <div className="nexus-share-title">Stories</div>
              <div className="nexus-share-subtitle">В свою историю</div>
            </div>

            <div
              className="nexus-share-card"
              onClick={async () => {
                if (navigator.share) await navigator.share({ title: 'Dragon VPN', text: 'Присоединяйся!', url: link });
                else shareToTelegram();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nexus-share-icon nexus-share-icon--other">
                <TgsPlayer src={`${ASSETS_GIFS}/multiple-share.tgs`} fallbackIcon="fas fa-share-alt" width={32} height={32} />
              </div>
              <div className="nexus-share-title">Другие</div>
              <div className="nexus-share-subtitle">WhatsApp, VK...</div>
            </div>
          </div>
        </motion.div>

        {/* Referral Link */}
        <motion.div variants={staggerItem}>
          <div className="nexus-ref-link-card">
            <div className="nexus-ref-link-icon">
              <i className="fas fa-link" />
            </div>
            <div className="nexus-ref-link-info">
              <div className="nexus-ref-link-title">Твоя ссылка-приглашение</div>
              <div className="nexus-ref-link-code">Код: {tg?.user?.id ?? '—'}</div>
            </div>
            <button
              type="button"
              className="nexus-btn-sm nexus-btn-sm--primary"
              onClick={copyLink}
            >
              <i className="fas fa-copy" /> Копировать
            </button>
          </div>
        </motion.div>

        {/* Friends List */}
        <motion.div variants={staggerItem}>
          <div className="nexus-section-label">Твои друзья</div>
          {referrals.length === 0 ? (
            <div className="nexus-empty">
              <div className="nexus-empty-icon">
                <TgsPlayer src={`${ASSETS_GIFS}/empty-referrals.tgs`} fallbackIcon="fas fa-users" width={50} height={50} />
              </div>
              <h3 className="nexus-empty-title">Пока нет друзей</h3>
              <p className="nexus-empty-text">Поделись ссылкой и начни зарабатывать бонусы</p>
            </div>
          ) : (
            <div className="nexus-friends-list">
              {(referrals as {
                user?: { name?: string; username?: string; photo_url?: string };
                bonus_granted?: boolean;
                bonus_days?: number;
                created_at?: string;
              }[]).map((ref, i) => {
                const u = ref.user ?? ref;
                const name = (u as { name?: string }).name ?? (u as { username?: string }).username ?? 'Пользователь';
                const photoUrl = (u as { photo_url?: string }).photo_url;
                const isActive = ref.bonus_granted === true;
                return (
                  <div key={i} className="nexus-friend-card">
                    <div className="nexus-friend-avatar">
                      {photoUrl ? (
                        <>
                          <img
                            src={photoUrl}
                            alt={name}
                            className="nexus-friend-avatar-img"
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="nexus-friend-avatar-fallback">
                            <i className={`fas ${isActive ? 'fa-crown' : 'fa-user'}`}
                               style={{ color: isActive ? 'var(--nx-amber)' : 'var(--nx-violet)' }} />
                          </div>
                        </>
                      ) : (
                        <i className={`fas ${isActive ? 'fa-crown' : 'fa-user-plus'}`}
                           style={{ color: isActive ? 'var(--nx-amber)' : 'var(--nx-violet)' }} />
                      )}
                    </div>
                    <div className="nexus-friend-info">
                      <div className="nexus-friend-name">{name}</div>
                      <div className={`nexus-friend-status nexus-friend-status--${isActive ? 'active' : 'pending'}`}>
                        {isActive ? `+${ref.bonus_days ?? 0} дн. бонус` : 'Приглашён'}
                      </div>
                    </div>
                    <div className="nexus-friend-date">
                      {ref.created_at ? formatDate(ref.created_at, 'relative') : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
}
