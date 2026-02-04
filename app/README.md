# Dragon VPN — React (Vite)

Фронтенд Telegram Mini App на **React 19**, **TypeScript**, **Vite 7**.

## Стек

- **React 19** + **TypeScript**
- **Vite 7** — сборка и dev-сервер
- **React Router** (HashRouter) — экраны и deep links
- **TanStack Query** — запросы к API, кеш
- **Zustand** — баннер оплаты, модалки инструкций/поддержки
- **Framer Motion** — анимации переходов

## Структура

- `src/core` — API-клиент, эндпоинты, Telegram-контекст, storage, утилиты
- `src/features` — экраны (Subscription, Keys, Referrals, Payments) и модалки (Instructions, Support, ServiceSelector, Gift, ActivateCode)
- `src/shared/ui` — Toast, Modal, Loading, PaymentBanner, BottomNav
- `src/app` — роуты, разметка (AppLayout), парсинг deep link

## Запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:5173`. Для проверки в Telegram подставьте URL в BotFather (Web App URL) или используйте туннель (ngrok и т.п.).

## Сборка

```bash
npm run build
```

Результат в `dist/`. Для продакшена раздавайте `dist` через nginx или другой сервер; проксируйте `/api` на бэкенд.

## API

Базовый URL: `/api/v1`. Авторизация через заголовок `X-Telegram-Init-Data` (берётся из Telegram Web App в контексте). Прокси в dev настроен в `vite.config.ts` на `http://localhost:3000`.

Эндпоинты соответствуют прежнему статическому фронту: user, subscription, payments, keys, referral, services, gift, servers, currency.
