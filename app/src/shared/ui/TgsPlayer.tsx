/**
 * TGS / Lottie player for Telegram sticker animations and static images.
 * Uses the same logic as the old TGSLoader: fetch .tgs → decompress with pako → play with lottie.
 *
 * Loop mode automatically trims trailing "hold" frames from TGS data so that
 * looping animations restart seamlessly without the visible stall at the end.
 *
 * Paths are relative to public: use /assets/images/gifs/...
 */

import { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web';
import pako from 'pako';

/* ── caches ────────────────────────────────────────────────── */

const lottieDataCache = new Map<string, object>();
const loopEndCache = new Map<string, number | null>();

async function loadTgsData(path: string): Promise<object> {
  if (lottieDataCache.has(path)) return lottieDataCache.get(path)!;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  const decompressed = pako.ungzip(new Uint8Array(buf), { to: 'string' });
  const data = JSON.parse(decompressed) as object;
  lottieDataCache.set(path, data);
  return data;
}

/* ── trim trailing hold-frames for seamless loops ──────────── */

/**
 * Scan every animated property in the Lottie JSON and find the last
 * keyframe time. TGS stickers are designed for single playback, so
 * they often pad 10-30 % of total duration with static "hold" frames
 * at the end.  For looping we trim that tail so the animation restarts
 * right after the last real movement.
 *
 * Returns the trimmed `op` value, or `null` if no trimming is needed.
 * Result is cached per path, so the scan runs only once per asset.
 */
function getTrimmedEnd(
  path: string,
  data: Record<string, unknown>,
): number | null {
  if (loopEndCache.has(path)) return loopEndCache.get(path)!;

  const ip = (data.ip as number) ?? 0;
  const op = (data.op as number) ?? 0;
  let lastKf = ip;

  const scan = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(scan);
      return;
    }
    const rec = obj as Record<string, unknown>;
    // Animated property: { a: 1, k: [{ t: <frame>, … }, …] }
    if (rec.a === 1 && Array.isArray(rec.k)) {
      for (const kf of rec.k as Record<string, unknown>[]) {
        const t = kf?.t;
        if (typeof t === 'number' && t > lastKf) lastKf = t;
      }
    }
    for (const v of Object.values(rec)) {
      if (v && typeof v === 'object') scan(v);
    }
  };

  for (const layer of (data.layers as unknown[]) ?? []) scan(layer);

  // +2 frames of buffer so the last keyframe fully renders
  const end = Math.min(lastKf + 2, op);

  // Only trim if there are real keyframes found and tail is > 8 % of duration
  const trimmed =
    lastKf > ip && (op - end) / (op - ip) > 0.08 ? end : null;

  loopEndCache.set(path, trimmed);
  return trimmed;
}

/* ── component ─────────────────────────────────────────────── */

interface TgsPlayerProps {
  /** Path to .tgs or .png (from public root, e.g. /assets/images/gifs/gift-animate.tgs) */
  src: string;
  /** Font Awesome icon class for fallback (e.g. 'fas fa-gift') */
  fallbackIcon?: string;
  width?: number;
  height?: number;
  className?: string;
  loop?: boolean;
}

export function TgsPlayer({
  src,
  fallbackIcon = 'fas fa-gift',
  width = 80,
  height = 80,
  className = '',
  loop = true,
}: TgsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || error) return;

    /* ── static images ─────────────────────────────────────── */
    const isImage = /\.(png|jpg|jpeg|gif)$/i.test(src);
    if (isImage) {
      const img = document.createElement('img');
      img.src = src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.onload = () => {};
      img.onerror = () => setError(true);
      el.appendChild(img);
      return () => {
        img.remove();
      };
    }

    if (!src.endsWith('.tgs')) {
      setError(true);
      return;
    }

    /* ── TGS / Lottie ─────────────────────────────────────── */
    let cancelled = false;
    let removeVisibility: (() => void) | null = null;

    loadTgsData(src)
      .then((lottieData) => {
        if (cancelled || !el) return;
        el.innerHTML = '';

        // For looping mode, trim trailing hold-frames for a seamless restart
        let animData = lottieData;
        if (loop) {
          const trimmedOp = getTrimmedEnd(
            src,
            lottieData as Record<string, unknown>,
          );
          if (trimmedOp !== null) {
            animData = { ...lottieData, op: trimmedOp };
          }
        }

        const animation = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop,
          autoplay: !document.hidden,
          animationData: animData,
        });
        animRef.current = animation;

        // One-shot: pause after single play-through
        if (!loop) {
          animation.addEventListener('complete', () => animation.pause());
        }

        if (document.hidden) animation.pause();

        const onVisibility = () => {
          if (document.hidden) {
            animation.pause();
          } else if (loop || animation.currentFrame < animation.totalFrames - 1) {
            animation.play();
          }
        };
        document.addEventListener('visibilitychange', onVisibility);
        removeVisibility = () =>
          document.removeEventListener('visibilitychange', onVisibility);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      removeVisibility?.();
      animRef.current?.destroy();
      animRef.current = null;
      el.innerHTML = '';
    };
  }, [src, loop, error]);

  if (error) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <i
          className={fallbackIcon}
          style={{ fontSize: Math.min(width, height) * 0.5, opacity: 0.8 }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width,
        height,
        minWidth: width,
        minHeight: height,
        margin: '0 auto',
      }}
    />
  );
}

/** Base path for gif/tgs assets in public */
export const ASSETS_GIFS = '/assets/images/gifs';
