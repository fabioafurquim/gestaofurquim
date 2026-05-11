'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_WINDOW_MS = 60 * 1000;
const STORAGE_KEY = 'plantaofisio:last-activity';
const CHANNEL_NAME = 'plantaofisio-session';

function broadcastActivity(channel: BroadcastChannel | null, timestamp: number) {
  if (!channel) {
    return false;
  }

  try {
    channel.postMessage({ type: 'activity', timestamp });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'InvalidStateError') {
      return false;
    }

    console.error('Erro ao sincronizar atividade entre abas:', error);
    return false;
  }
}

export default function IdleSessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const [warningOpen, setWarningOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(WARNING_WINDOW_MS);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const logoutUser = useCallback(async (callbackUrl = '/login') => {
    await fetch('/api/auth/logout', {
      method: 'POST',
    }).catch(() => null);
    router.push(callbackUrl);
    router.refresh();
  }, [router]);

  useEffect(() => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, String(now));
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const syncActivity = (timestamp: number) => {
      localStorage.setItem(STORAGE_KEY, String(timestamp));
      const sent = broadcastActivity(channelRef.current, timestamp);
      if (!sent && channelRef.current === channel) {
        channelRef.current = null;
      }
    };

    const handleActivity = () => {
      const timestamp = Date.now();
      syncActivity(timestamp);
      setWarningOpen(false);
      setRemainingMs(WARNING_WINDOW_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        setWarningOpen(false);
      }
    };

    const handleChannelMessage = (event: MessageEvent) => {
      if (event.data?.type === 'activity') {
        setWarningOpen(false);
      }
    };

    const checkIdle = async () => {
      const rawValue = localStorage.getItem(STORAGE_KEY);
      const lastActivity = rawValue ? Number(rawValue) : Date.now();
      const elapsed = Date.now() - lastActivity;
      const remaining = IDLE_TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        localStorage.removeItem(STORAGE_KEY);
        setWarningOpen(false);
        await logoutUser(`/login?reason=expired&redirect=${encodeURIComponent(pathname || '/')}`);
        return;
      }

      if (remaining <= WARNING_WINDOW_MS) {
        setWarningOpen(true);
        setRemainingMs(remaining);
      } else {
        setWarningOpen(false);
      }
    };

    const events: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'scroll', 'touchstart', 'focus'];

    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);
    channel?.addEventListener('message', handleChannelMessage);

    const interval = window.setInterval(() => {
      void checkIdle();
    }, 15000);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
      channel?.removeEventListener('message', handleChannelMessage);
      channel?.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      window.clearInterval(interval);
    };
  }, [logoutUser, pathname]);

  if (!warningOpen) {
    return null;
  }

  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Sessão inativa</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">Você ainda está usando o sistema?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Sua sessão será encerrada automaticamente em {remainingSeconds} segundo{remainingSeconds !== 1 ? 's' : ''} por inatividade.
        </p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => logoutUser('/login')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Sair agora
          </button>
          <button
            type="button"
            onClick={() => {
              const timestamp = Date.now();
              localStorage.setItem(STORAGE_KEY, String(timestamp));
              const sent = broadcastActivity(channelRef.current, timestamp);
              if (!sent) {
                channelRef.current = null;
              }
              setWarningOpen(false);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Continuar conectado
          </button>
        </div>
      </div>
    </div>
  );
}
