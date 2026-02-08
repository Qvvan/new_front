/**
 * Shared Framer Motion variants for consistent animations across the app.
 */

export const pageTransition = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
  transition: { duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: 1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

export const cardHover = {
  rest: { scale: 1 },
  hover: { scale: 1.01 },
  tap: { scale: 0.99 },
};

export const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.1 },
};

export const modalPanel = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.99, y: 4 },
  transition: { duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

export const slideUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

export const slideDown = {
  initial: { opacity: 0, y: -16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const navItemTap = {
  tap: { scale: 0.92 },
  transition: { duration: 0.15 },
};
