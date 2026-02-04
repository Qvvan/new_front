import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './app/routes';
import { TelegramProvider } from './core/telegram/context';
import { ToastProvider } from './shared/ui/Toast';
import { ModalProvider } from './shared/ui/Modal';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TelegramProvider>
        <ToastProvider>
          <ModalProvider>
            <RouterProvider router={router} />
          </ModalProvider>
        </ToastProvider>
      </TelegramProvider>
    </QueryClientProvider>
  </StrictMode>,
);
