import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStoriesStore } from './storiesStore';
import { storiesApi } from '../../core/api/endpoints';
import './stories.css';

const IMAGE_DURATION = 6000;
const LONG_PRESS_MS = 180;
const RESTART_THRESHOLD = 0.12;

export function StoriesViewer() {
  const { isOpen, stories, currentIndex, next, prev, close, markViewed } = useStoriesStore();
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [closing, setClosing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const durationRef = useRef(IMAGE_DURATION);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const viewedSetRef = useRef(new Set<number>());

  const story = stories[currentIndex];
  const isVideo = story?.content_type === 'video';

  /* ── Close with animation ─────────────────────────────────── */
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      close();
      setClosing(false);
    }, 250);
  }, [close]);

  /* ── Mark viewed ──────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen || !story) return;
    if (story.is_viewed || viewedSetRef.current.has(story.id)) return;
    viewedSetRef.current.add(story.id);
    storiesApi.markViewed(story.id).catch(() => {});
    markViewed(story.id);
  }, [isOpen, story, markViewed]);

  /* ── Reset on story change ────────────────────────────────── */
  useEffect(() => {
    if (!isOpen || !story) return;
    setProgress(0);
    setIsPaused(false);
    setMediaReady(false);
    progressRef.current = 0;
    elapsedBeforePauseRef.current = 0;
    cancelAnimationFrame(rafRef.current);

    if (!isVideo) {
      durationRef.current = IMAGE_DURATION;
      const img = new Image();
      img.onload = () => setMediaReady(true);
      img.onerror = () => setMediaReady(true);
      img.src = story.media_url;
    }
    // for video, mediaReady is set via onLoadedData
  }, [isOpen, currentIndex, story?.id, isVideo, story?.media_url]);

  /* ── Image progress animation (rAF) ──────────────────────── */
  useEffect(() => {
    if (!isOpen || isVideo || !mediaReady || isPaused) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    startTimeRef.current = performance.now() - elapsedBeforePauseRef.current;

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const p = Math.min(elapsed / durationRef.current, 1);
      progressRef.current = p;
      setProgress(p);

      if (p >= 1) {
        next();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isVideo, mediaReady, isPaused, currentIndex]);

  /* ── Video play/pause sync ────────────────────────────────── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;

    if (isPaused) {
      v.pause();
    } else if (mediaReady) {
      v.play().catch(() => {
        // autoplay blocked — try muted
        v.muted = true;
        v.play().catch(() => {});
      });
    }
  }, [isPaused, mediaReady, isVideo]);

  /* ── Video event handlers ─────────────────────────────────── */
  const onVideoLoadedData = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      durationRef.current = (v.duration || 10) * 1000;
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
    }
    setMediaReady(true);
  }, []);

  const onVideoTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const p = v.currentTime / v.duration;
    progressRef.current = p;
    setProgress(p);
  }, []);

  const onVideoEnded = useCallback(() => {
    next();
  }, [next]);

  /* ── Gesture handling ─────────────────────────────────────── */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('.stories-close-btn')) return;
      isLongPressRef.current = false;

      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        setIsPaused(true);
        if (!isVideo) {
          elapsedBeforePauseRef.current = progressRef.current * durationRef.current;
        }
      }, LONG_PRESS_MS);
    },
    [isVideo],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('.stories-close-btn')) return;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (isLongPressRef.current) {
        isLongPressRef.current = false;
        setIsPaused(false);
        return;
      }

      // Determine tap side
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const isRight = x > rect.width * 0.38;

      if (isRight) {
        next();
      } else {
        if (progressRef.current < RESTART_THRESHOLD) {
          prev();
        } else {
          // Restart current
          progressRef.current = 0;
          elapsedBeforePauseRef.current = 0;
          setProgress(0);
          if (isVideo && videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
          }
          startTimeRef.current = performance.now();
        }
      }
    },
    [next, prev, isVideo],
  );

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      setIsPaused(false);
    }
  }, []);

  /* ── Keyboard shortcuts ───────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') {
        if (progressRef.current < RESTART_THRESHOLD) prev();
        else {
          progressRef.current = 0;
          elapsedBeforePauseRef.current = 0;
          setProgress(0);
          if (videoRef.current) videoRef.current.currentTime = 0;
          startTimeRef.current = performance.now();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose, next, prev]);

  /* ── Lock body scroll ─────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  /* ── Clear viewed set when viewer opens ───────────────────── */
  useEffect(() => {
    if (isOpen) viewedSetRef.current.clear();
  }, [isOpen]);

  if (!isOpen || !story) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`stories-overlay${closing ? ' stories-overlay--closing' : ''}`}
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Safe area top spacer */}
          <div className="stories-safe-top" />

          {/* ── Progress bars ────────────────────────────────── */}
          <div className="stories-progress-container">
            {stories.map((s, i) => (
              <div key={s.id} className="stories-progress-track">
                <div
                  className="stories-progress-fill"
                  style={{
                    transform: `scaleX(${
                      i < currentIndex ? 1 : i === currentIndex ? progress : 0
                    })`,
                    transition:
                      i === currentIndex
                        ? 'none'
                        : 'transform 0.3s ease',
                  }}
                />
              </div>
            ))}
          </div>

          {/* ── Header ───────────────────────────────────────── */}
          <div className="stories-header">
            <div className="stories-header-info">
              <div className="stories-header-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="stories-header-text">
                <span className="stories-header-title">{story.title}</span>
                <span className="stories-header-time">
                  {formatTimeAgo(story.created_at)}
                </span>
              </div>
            </div>
            <button
              className="stories-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              aria-label="Закрыть"
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M20 8L8 20M8 8l12 12"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* ── Media content ────────────────────────────────── */}
          <div className="stories-media-wrapper">
            <AnimatePresence mode="wait">
              <motion.div
                key={story.id}
                className="stories-media-inner"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {isVideo ? (
                  <video
                    ref={videoRef}
                    className="stories-media"
                    src={story.media_url}
                    poster={story.thumbnail_url ?? undefined}
                    playsInline
                    preload="auto"
                    onLoadedData={onVideoLoadedData}
                    onTimeUpdate={onVideoTimeUpdate}
                    onEnded={onVideoEnded}
                  />
                ) : (
                  <img
                    className="stories-media"
                    src={story.media_url}
                    alt={story.title}
                    draggable={false}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Loading spinner */}
            {!mediaReady && (
              <div className="stories-loading">
                <div className="stories-spinner" />
              </div>
            )}
          </div>

          {/* ── Description ──────────────────────────────────── */}
          {story.description && (
            <div className="stories-description">
              <p>{story.description}</p>
            </div>
          )}

          {/* ── Story counter ────────────────────────────────── */}
          <div className="stories-counter">
            {currentIndex + 1} / {stories.length}
          </div>

          {/* ── Gesture overlay ──────────────────────────────── */}
          <div
            className="stories-gesture-layer"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          />

          {/* ── Pause indicator ──────────────────────────────── */}
          <AnimatePresence>
            {isPaused && (
              <motion.div
                className="stories-paused-badge"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect
                    x="9"
                    y="7"
                    width="5"
                    height="18"
                    rx="1.5"
                    fill="white"
                    fillOpacity="0.9"
                  />
                  <rect
                    x="18"
                    y="7"
                    width="5"
                    height="18"
                    rx="1.5"
                    fill="white"
                    fillOpacity="0.9"
                  />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}
