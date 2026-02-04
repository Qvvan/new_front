import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const TERMINAL_LINES = [
  { prompt: 'root@vpn:~$', command: './init_vpn.sh' },
  { output: '[INFO] Инициализация защищённого туннеля...' },
  { output: '[INFO] Шифрование: ', success: 'AES-256' },
  { output: '[INFO] Протокол: ', success: 'ACTIVE' },
  { output: '[INFO] Сеть: ', success: 'SECURED' },
  { output: '[SUCCESS] Система готова к работе.', isSuccess: true },
  { prompt: 'root@vpn:~$', cursor: true },
];

export function LoadingOverlay() {
  const [progress, setProgress] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const lineInterval = setInterval(() => {
      setVisibleLines((prev) => Math.min(prev + 1, TERMINAL_LINES.length));
    }, 220);
    return () => clearInterval(lineInterval);
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 10 + 5, 100));
    }, 90);
    return () => clearInterval(progressInterval);
  }, []);

  return (
    <motion.div
          className="loader-screen cyber-loader"
          id="loadingOverlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="cyber-loader-bg" />
          <div className="loader-container cyber-loader-container">
            <div className="hack-terminal">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <div className="terminal-title">VPN PROTOCOL INIT</div>
              </div>
              <div className="terminal-body">
                {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
                  <div key={i} className="terminal-line">
                    {line.prompt && <span className="prompt">{line.prompt}</span>}
                    {line.command && <span className="command">{line.command}</span>}
                    {line.output && (
                      <span className={`output ${line.isSuccess ? 'success' : ''}`}>
                        {line.output}
                        {line.success && <span className="success"> {line.success}</span>}
                      </span>
                    )}
                    {line.cursor && <span className="cursor">_</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="loader-progress-container">
              <div
                className="loader-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="loader-percentage">{Math.floor(progress)}%</div>
            <div className="hack-lines">
              <div className="hack-line" />
              <div className="hack-line" />
              <div className="hack-line" />
            </div>
          </div>
        </motion.div>
  );
}
