import { useQuery } from '@tanstack/react-query';
import { referralApi } from '../../core/api/endpoints';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { copyToClipboard, formatDate } from '../../core/utils';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';

function useReferralLink(): string {
  const tg = useTelegram();
  const userId = tg?.user?.id;
  const bot = 'SuperSummaryBot';
  return userId ? `https://t.me/${bot}/sky?startapp=${userId}` : '';
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

  const stats = {
    total_count: referrals.length,
    partners: (referrals as { user?: { trial_activated?: boolean }; bonus_granted?: boolean }[]).filter(r =>
      r.user?.trial_activated === true || r.bonus_granted === true
    ).length,
  };
  const bonusDays = stats.partners * 15;

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
      <div className="content-wrapper">
        <div className="section">
          <h2 className="section-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}><TgsPlayer src={`${ASSETS_GIFS}/referral-invite.tgs`} fallbackIcon="fas fa-users" width={32} height={32} /></span>
            Приглашай друзей
          </h2>
          <p className="section-subtitle">Получай бонусы за каждого друга</p>
        </div>
        <div className="referral-stats-grid">
          <div className="stat-card"><div className="stat-number">{stats.total_count}</div><div className="stat-label">Приглашено рефералов</div></div>
          <div className="stat-card"><div className="stat-number">{bonusDays}</div><div className="stat-label">Бонусных дней</div></div>
          <div className="stat-card"><div className="stat-number">{stats.partners}</div><div className="stat-label">Активных</div></div>
        </div>
        <div className="section">
          <div className="share-actions-grid">
            <div className="share-action-card" onClick={shareToTelegram} role="button" tabIndex={0}>
              <div className="share-action-icon"><TgsPlayer src={`${ASSETS_GIFS}/telegram-share.tgs`} fallbackIcon="fab fa-telegram-plane" width={40} height={40} /></div>
              <div className="share-action-title">Telegram</div>
              <div className="share-action-subtitle">Нескольким друзьям</div>
            </div>
            <div className="share-action-card" onClick={shareToTelegram} role="button" tabIndex={0}>
              <div className="share-action-icon"><TgsPlayer src={`${ASSETS_GIFS}/story-share.tgs`} fallbackIcon="fas fa-bolt" width={40} height={40} /></div>
              <div className="share-action-title">Stories</div>
              <div className="share-action-subtitle">В свою историю</div>
            </div>
            <div className="share-action-card" onClick={async () => { if (navigator.share) await navigator.share({ title: 'Dragon VPN', text: 'Присоединяйся!', url: link }); else shareToTelegram(); }} role="button" tabIndex={0}>
              <div className="share-action-icon"><TgsPlayer src={`${ASSETS_GIFS}/multiple-share.tgs`} fallbackIcon="fas fa-share-alt" width={40} height={40} /></div>
              <div className="share-action-title">Другие</div>
              <div className="share-action-subtitle">WhatsApp, VK...</div>
            </div>
          </div>
        </div>
        <div className="section">
          <div className="referral-link-card">
            <div className="referral-link-header">
              <i className="fas fa-link" />
              <div className="referral-link-info">
                <h4>Твоя ссылка-приглашение</h4>
                <p>Код: {tg?.user?.id ?? ''}</p>
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-primary" onClick={copyLink}><i className="fas fa-copy" /> Копировать</button>
          </div>
        </div>
        <div className="section">
          <h3 className="section-title"><i className="fas fa-users" /> Твои друзья</h3>
          {referrals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <TgsPlayer src={`${ASSETS_GIFS}/empty-referrals.tgs`} fallbackIcon="fas fa-users" width={80} height={80} />
              </div>
              <h3 className="empty-state-title">Пока нет друзей</h3>
              <p className="empty-state-text">Поделись ссылкой и начни зарабатывать бонусы</p>
            </div>
          ) : (
            <div className="referrals-list">
              {(referrals as { user?: { name?: string; username?: string }; bonus_granted?: boolean; created_at?: string }[]).map((ref, i) => {
                const u = ref.user ?? ref;
                const name = (u as { name?: string }).name ?? (u as { username?: string }).username ?? 'Пользователь';
                const isActive = (u as { trial_activated?: boolean }).trial_activated === true || ref.bonus_granted === true;
                return (
                  <div key={i} className="referral-item">
                    <div className="referral-item-avatar">
                      <i className={`fas ${isActive ? 'fa-crown text-green' : 'fa-user-plus'}`} />
                    </div>
                    <div className="referral-item-info">
                      <div className="referral-item-name">{name}</div>
                      <div className={`referral-item-status ${isActive ? 'text-green' : 'text-secondary'}`}>{isActive ? 'Активен' : 'Приглашен'}</div>
                    </div>
                    <div className="referral-item-date">{ref.created_at ? formatDate(ref.created_at, 'relative') : ''}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
