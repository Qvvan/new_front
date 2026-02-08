import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useModalsStore } from '../../app/modalsStore';
import { subscriptionApi, type ImportLinksMap } from '../../core/api/endpoints';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { useNavigate } from 'react-router-dom';
import { daysBetween } from '../../core/utils';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';

const SUPPORT_URL = 'https://t.me/SkyDragonSupport';
const DEVICES = [
  { id: 'android', icon: 'fab fa-android', label: 'Android' },
  { id: 'ios', icon: 'fab fa-apple', label: 'iOS' },
  { id: 'windows', icon: 'fab fa-windows', label: 'Windows' },
  { id: 'macos', icon: 'fab fa-apple', label: 'macOS' },
] as const;

const PLATFORM_MAP: Record<string, string> = { android: 'android', ios: 'iphone', windows: 'windows', macos: 'macos' };

function getAppIcon(appName: string, deviceType: string): string {
  const lower = (appName || '').toLowerCase();
  if (lower.includes('v2ray') || lower.includes('tun')) return 'fas fa-shield-alt';
  if (lower.includes('happ') || lower.includes('proxy')) return 'fas fa-network-wired';
  if (lower.includes('streisand')) return 'fas fa-lock';
  if (deviceType === 'android') return 'fab fa-android';
  if (deviceType === 'ios') return 'fab fa-apple';
  if (deviceType === 'windows') return 'fab fa-windows';
  if (deviceType === 'macos') return 'fab fa-apple';
  return 'fas fa-mobile-alt';
}

type Sub = { subscription_id?: number; id?: string; end_date?: string; status?: string; service_name?: string; sub_url?: string };

export function InstructionsModal() {
  const { instructions, closeInstructions, openServiceSelector } = useModalsStore();
  const toast = useToast();
  const tg = useTelegram();
  const navigate = useNavigate();

  const [view, setView] = useState<'subscription' | 'steps'>('subscription');
  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [deviceType, setDeviceType] = useState<string | null>(null);
  const [selectedAppIndex, setSelectedAppIndex] = useState<number | null>(null);
  const [selectedImportUrl, setSelectedImportUrl] = useState<string | null>(null);

  const { data: subsRes } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
    enabled: instructions,
  });
  const subscriptions = (Array.isArray(subsRes) ? subsRes : (subsRes as { subscriptions?: Sub[] })?.subscriptions ?? []) as Sub[];

  const { data: importLinks, refetch: refetchImportLinks } = useQuery({
    queryKey: ['importLinks', subscriptionId],
    queryFn: () => subscriptionApi.getImportLinks(subscriptionId!),
    enabled: instructions && !!subscriptionId && view === 'steps',
  });
  const links = (importLinks ?? {}) as ImportLinksMap;

  useEffect(() => {
    if (!instructions) return;
    setView('subscription');
    setSubscriptionId(null);
    setStep(0);
    setDeviceType(null);
    setSelectedAppIndex(null);
    setSelectedImportUrl(null);
  }, [instructions]);

  useEffect(() => {
    if (!instructions || subscriptions.length === 0) return;
    if (subscriptions.length === 1) {
      const sub = subscriptions[0];
      const days = daysBetween(sub.end_date ?? '');
      const isActive = days > 0 && (sub.status === 'active' || sub.status === 'trial');
      if (isActive) {
        setSubscriptionId(sub.subscription_id ?? Number(sub.id));
        setView('steps');
      }
    }
  }, [instructions, subscriptions]);

  const apps = deviceType ? links[PLATFORM_MAP[deviceType] || deviceType] ?? [] : [];
  const canGoNextFromStep0 = !!deviceType;
  const canGoNextFromStep1 = apps.length === 0 || selectedAppIndex !== null || !!selectedImportUrl;

  const handleClose = useCallback(() => {
    closeInstructions();
  }, [closeInstructions]);

  const handleBuySubscription = useCallback(() => {
    handleClose();
    navigate('/subscription');
    openServiceSelector('buy');
    tg?.haptic.light();
  }, [handleClose, navigate, openServiceSelector, tg]);

  const handleRenewSubscription = useCallback((subId: number) => {
    handleClose();
    navigate('/subscription');
    openServiceSelector('renew', subId);
    tg?.haptic.light();
  }, [handleClose, navigate, openServiceSelector, tg]);

  const handleSelectSubscription = useCallback((subId: number) => {
    const sub = subscriptions.find(s => (s.subscription_id ?? s.id) === subId);
    const days = sub ? daysBetween(sub.end_date ?? '') : 0;
    const isActive = days > 0 && sub && (sub.status === 'active' || sub.status === 'trial');
    if (!isActive) {
      handleRenewSubscription(subId);
      return;
    }
    setSubscriptionId(subId);
    setView('steps');
    refetchImportLinks();
    tg?.haptic.selection?.();
  }, [subscriptions, handleRenewSubscription, refetchImportLinks, tg]);

  const selectDevice = useCallback((device: string) => {
    setDeviceType(device);
    setSelectedAppIndex(null);
    setSelectedImportUrl(null);
    tg?.haptic.selection?.();
  }, [tg]);

  const nextStep = useCallback(() => {
    if (step === 0 && !deviceType) {
      toast.warning('Выберите устройство');
      return;
    }
    if (step === 1 && apps.length > 0 && selectedAppIndex === null && !selectedImportUrl) {
      toast.warning('Выберите приложение или нажмите Скачать');
      return;
    }
    if (step >= 2) {
      handleClose();
      return;
    }
    setStep(s => s + 1);
    tg?.haptic.light();
  }, [step, deviceType, apps.length, selectedAppIndex, selectedImportUrl, toast, handleClose, tg]);

  const prevStep = useCallback(() => {
    if (step > 0) {
      setStep(s => s - 1);
      if (step === 1) {
        setSelectedAppIndex(null);
        setSelectedImportUrl(null);
      }
      tg?.haptic.light();
    }
  }, [step, tg]);

  const downloadApp = useCallback((url: string) => {
    tg?.openLink?.(url) ?? window.open(url, '_blank');
    tg?.haptic.light();
  }, [tg]);

  const activateProfile = useCallback(() => {
    const url = selectedImportUrl || (apps[0]?.import_url);
    if (!url) {
      toast.error('Не найдена ссылка для активации профиля');
      return;
    }
    tg?.openLink?.(url) ?? window.open(url, '_blank');
    toast.success('Профиль отправлен в приложение!');
    tg?.haptic.success?.();
  }, [selectedImportUrl, apps, toast, tg]);

  const openSubUrl = useCallback(() => {
    const currentSub = subscriptions.find(s => (s.subscription_id ?? Number(s.id)) === subscriptionId);
    if (currentSub?.sub_url) {
      const url = currentSub.sub_url.startsWith('/') 
        ? `${window.location.origin}${currentSub.sub_url}`
        : currentSub.sub_url;
      tg?.openLink?.(url) ?? window.open(url, '_blank');
      tg?.haptic.light();
    } else {
      toast.error('Ссылка на подписку недоступна');
    }
  }, [subscriptions, subscriptionId, tg, toast]);

  const contactSupport = useCallback(() => {
    handleClose();
    tg?.openTelegramLink?.(SUPPORT_URL) ?? tg?.openLink?.(SUPPORT_URL) ?? window.open(SUPPORT_URL, '_blank');
  }, [handleClose, tg]);

  const content = (
    <AnimatePresence>
      {instructions && (
      <motion.div className="modal-overlay active" {...modalBackdrop} onClick={handleClose}>
        <motion.div className="modal modal-instructions" {...modalPanel} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="fas fa-book" />
              {view === 'subscription' ? 'Выберите подписку' : `Инструкции (Шаг ${step + 1}/3)`}
            </div>
            <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            {view === 'subscription' ? (
              <div className="subscription-selection-content">
                {subscriptions.length === 0 && (
                  <div className="subscription-empty-state">
                    <div className="empty-state-icon">
                      <i className="fas fa-box-open" />
                    </div>
                    <h3 className="empty-state-title">Нет активной подписки</h3>
                    <p className="empty-state-description">
                      Для просмотра инструкций по настройке VPN необходимо приобрести подписку
                    </p>
                    <button type="button" className="btn btn-activation btn-empty-state" onClick={handleBuySubscription}>
                      <i className="fas fa-rocket" /> Купить подписку
                    </button>
                  </div>
                )}
                {subscriptions.length === 1 && (() => {
                  const sub = subscriptions[0];
                  const subId = sub.subscription_id ?? Number(sub.id);
                  const days = daysBetween(sub.end_date ?? '');
                  const isActive = days > 0 && (sub.status === 'active' || sub.status === 'trial');
                  if (!isActive) {
                    return (
                      <div className="subscription-empty-state subscription-empty-state--expired">
                        <div className="empty-state-icon empty-state-icon--warning">
                          <i className="fas fa-clock" />
                        </div>
                        <h3 className="empty-state-title">
                          {days <= 0 ? 'Подписка истекла' : 'Подписка заканчивается'}
                        </h3>
                        <p className="empty-state-description">
                          Продлите подписку, чтобы продолжить пользоваться VPN и просматривать инструкции
                        </p>
                        <button type="button" className="btn btn-activation btn-empty-state" onClick={() => handleRenewSubscription(subId)}>
                          <i className="fas fa-sync-alt" /> Продлить подписку
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="subscription-empty-state subscription-empty-state--active">
                      <div className="empty-state-icon empty-state-icon--success">
                        <i className="fas fa-check-circle" />
                      </div>
                      <h3 className="empty-state-title">Подписка активна</h3>
                      <p className="empty-state-description">
                        Нажмите кнопку ниже, чтобы перейти к инструкциям по настройке
                      </p>
                      <button type="button" className="btn btn-activation btn-empty-state" onClick={() => handleSelectSubscription(subId)}>
                        <i className="fas fa-arrow-right" /> К инструкциям
                      </button>
                    </div>
                  );
                })()}
                {subscriptions.length > 1 && (
                  <>
                    <div className="subscription-selection-message">
                      <p>У вас несколько подписок. Выберите подписку, для которой хотите посмотреть инструкции:</p>
                    </div>
                    <div className="subscriptions-list">
                      {subscriptions.map(s => {
                        const subId = s.subscription_id ?? Number(s.id);
                        const d = daysBetween(s.end_date ?? '');
                        const active = d > 0 && (s.status === 'active' || s.status === 'trial');
                        return (
                          <div key={subId} className={`subscription-option ${active ? 'subscription-active' : 'subscription-expired'}`}>
                            <div className="subscription-option-info">
                              <h4>{s.service_name ?? `Подписка ${subId}`}</h4>
                              <p className={`subscription-status ${active ? 'status-active' : 'status-expired'}`}>
                                {active ? 'Активна' : d <= 0 ? 'Просрочена' : `Истекает через ${d} дн.`}
                              </p>
                            </div>
                            <button
                              type="button"
                              className={`btn ${active ? 'btn-primary' : 'btn-secondary'} btn-select-subscription`}
                              onClick={() => handleSelectSubscription(subId)}
                            >
                              {active ? 'Выбрать' : 'Продлить'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="steps-indicator">
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      <div className={`step-dot ${i === step ? 'active' : i < step ? 'completed' : ''}`} />
                      {i < 2 && <div className={`step-line ${i < step ? 'completed' : ''}`} />}
                    </span>
                  ))}
                </div>
                <div className="step-content">
                  {step === 0 && (
                    <>
                      <div className="step-header">
                        <h3>Выберите ваше устройство</h3>
                      </div>
                      <div className="device-grid">
                        {DEVICES.map(d => (
                          <div
                            key={d.id}
                            className={`device-card ${deviceType === d.id ? 'selected' : ''}`}
                            onClick={() => selectDevice(d.id)}
                            role="button"
                            tabIndex={0}
                            data-device={d.id}
                          >
                            <i className={d.icon} />
                            <span>{d.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <div className="step-header">
                        <h3>Скачайте приложение</h3>
                      </div>
                      {apps.length === 0 ? (
                        <div className="app-download">
                          <div className="app-icon"><i className={deviceType === 'android' ? 'fab fa-android' : deviceType === 'ios' ? 'fab fa-apple' : 'fab fa-windows'} /></div>
                          <div className="app-info">
                            <h4>Приложение для {DEVICES.find(d => d.id === deviceType)?.label ?? deviceType}</h4>
                            <p>Ссылка на скачивание будет доступна после выбора подписки.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="apps-list">
                          <div className="apps-list-hint">
                            <i className="fas fa-hand-pointer" />
                            <span>Нажмите на приложение, чтобы выбрать</span>
                          </div>
                          {apps.map((app, idx) => (
                            <div
                              key={idx}
                              className={`app-card ${selectedAppIndex === idx ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedAppIndex(idx);
                                if (app.import_url) setSelectedImportUrl(app.import_url);
                                tg?.haptic.selection?.();
                              }}
                              role="button"
                              tabIndex={0}
                              data-app-index={idx}
                            >
                              <div className="app-card-radio">
                                <div className="app-card-radio-dot" />
                              </div>
                              <div className="app-icon">
                                <i className={getAppIcon(app.app_name ?? '', deviceType ?? '')} />
                              </div>
                              <div className="app-info">
                                <h4>{app.app_name ?? 'Приложение'}</h4>
                                {selectedAppIndex !== idx && (
                                  <div className="app-tap-hint">Нажмите для выбора</div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="btn btn-primary btn-download-app"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (app.store_url) downloadApp(app.store_url!);
                                  setSelectedAppIndex(idx);
                                  if (app.import_url) setSelectedImportUrl(app.import_url);
                                  setStep(2);
                                }}
                              >
                                <i className="fas fa-download" /> <span className="btn-download-label">Скачать</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="download-note">
                        <i className="fas fa-info-circle" />
                        <span>После установки требуется настройка профиля</span>
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <div className="step-header">
                        <h3>Настройка профиля</h3>
                        <p>Активируйте VPN профиль для вашего приложения</p>
                      </div>
                      <div className="profile-setup">
                        <div className="profile-activation">
                          <div className="profile-actions">
                            <button type="button" className="btn btn-activation" onClick={activateProfile}>
                              <i className="fas fa-magic" /> Активировать профиль
                            </button>
                            <button type="button" className="btn btn-outline" onClick={openSubUrl}>
                              <i className="fas fa-key" /> Получить ключи вручную
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="support-note">
                        <i className="fas fa-question-circle" />
                        <span>Возникли проблемы? </span>
                        <button type="button" className="btn-link" onClick={contactSupport}>
                          Обратитесь в поддержку
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-actions">
            {view === 'subscription' && (
              <button type="button" className="btn btn-secondary" onClick={handleClose}>Отмена</button>
            )}
            {view === 'steps' && (
              <>
                {step > 0 ? (
                  <button type="button" className="btn btn-secondary" onClick={prevStep}>Назад</button>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={handleClose}>Пропустить</button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={(step === 0 && !canGoNextFromStep0) || (step === 1 && !canGoNextFromStep1)}
                  onClick={nextStep}
                >
                  {step === 2 ? 'Завершить' : 'Далее'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
