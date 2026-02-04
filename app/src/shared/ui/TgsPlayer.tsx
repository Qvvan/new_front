/**
 * TGS / Lottie player for Telegram sticker animations and static images.
 * Uses the same logic as the old TGSLoader: fetch .tgs → decompress with pako → play with lottie.
 * Paths are relative to public: use /assets/images/gifs/...
 */

import { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web';
import pako from 'pako';

const lottieDataCache = new Map<string, object>();

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

export function TgsPlayer({ src, fallbackIcon = 'fas fa-gift', width = 80, height = 80, className = '', loop = false }: TgsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || error) return;

    const isImage = /\.(png|jpg|jpeg|gif)$/i.test(src);
    if (isImage) {
      const img = document.createElement('img');
      img.src = src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.onload = () => setLoaded(true);
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

    let cancelled = false;
    let removeVisibility: (() => void) | null = null;

    loadTgsData(src)
      .then((lottieData) => {
        if (cancelled || !el) return;
        el.innerHTML = '';
        const animation = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop,
          autoplay: !document.hidden,
          animationData: lottieData,
        });
        animRef.current = animation;
        animation.addEventListener('complete', () => animation.pause());
        if (document.hidden) animation.pause();
        setLoaded(true);

        const onVisibility = () => {
          if (document.hidden) animation.pause();
          else if (animation.currentFrame < animation.totalFrames - 1) animation.play();
        };
        document.addEventListener('visibilitychange', onVisibility);
        removeVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
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
  }, [src, error]);

  if (error) {
    return (
      <div className={className} style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className={fallbackIcon} style={{ fontSize: Math.min(width, height) * 0.5, opacity: 0.8 }} />
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
