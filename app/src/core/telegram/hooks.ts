import { useContext } from 'react';
import { TelegramContext } from './context';

export function useTelegram() {
  return useContext(TelegramContext);
}
