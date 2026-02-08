import { useState, useRef, useEffect } from 'react';
import { giftApi } from '../../core/api/endpoints';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';

interface ActivateCodeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-filled code from deep link (e.g. startapp=activate-code__ABC123) */
  initialCode?: string;
}

export function ActivateCodeModal({ open, onClose, onSuccess, initialCode }: ActivateCodeModalProps) {
  const toast = useToast();
  const tg = useTelegram();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCode(initialCode ?? '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialCode]);

  const handleActivate = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.warning('Введите код');
      return;
    }
    tg?.haptic.light();
    setLoading(true);
    try {
      await giftApi.activateByCode(trimmed);
      toast.success('Подарок активирован!');
      tg?.haptic.success();
      onSuccess();
      onClose();
      setCode('');
    } catch (err: unknown) {
      const e = err as Error & { data?: { comment?: string } };
      toast.error(e.data?.comment ?? e.message ?? 'Ошибка активации');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase());
  };

  if (!open) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Активировать код подарка</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть"><i className="fas fa-times" /></button>
        </div>
        <div className="modal-body">
          <div className="code-activation-content">
            <div className="code-activation-header">
              <div className="code-activation-icon-wrapper">
                <div className="code-activation-icon-glow" />
                <TgsPlayer src={`${ASSETS_GIFS}/gift-animate.tgs`} fallbackIcon="fas fa-gift" width={48} height={48} className="code-activation-icon" />
              </div>
              <h3 className="code-activation-title">Введите код активации</h3>
              <p className="code-activation-description">
                Получили подарок? Введите код и активируйте подписку
              </p>
            </div>
            <div className="code-input-container">
              <div className={`code-input-wrapper ${focused ? 'focused' : ''}`}>
                <div className="code-input-border" />
                <input
                  ref={inputRef}
                  type="text"
                  id="giftCodeInput"
                  className={`code-input ${code.trim() ? 'has-value' : ''}`}
                  placeholder="Введите код активации"
                  value={code}
                  onChange={handleChange}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && handleActivate()}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="code-input-focus-line" />
              </div>
              <div className="code-input-hint">
                <i className="fas fa-info-circle" />
                <span>Код может быть любой длины</span>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary" disabled={loading || !code.trim()} onClick={handleActivate}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> Активация...</> : 'Активировать'}
          </button>
        </div>
      </div>
    </div>
  );
}
