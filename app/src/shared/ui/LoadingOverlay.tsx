import { motion } from 'framer-motion';

export function LoadingOverlay() {
  return (
    <motion.div
      className="loading-overlay"
      id="loadingOverlay"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="loading-spinner" />
      <motion.p
        className="loading-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        Загрузка...
      </motion.p>
    </motion.div>
  );
}
