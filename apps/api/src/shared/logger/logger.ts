/**
 * Structured logging entry point (swap for Pino/Winston in production if needed).
 */
export const logger = {
  info: (...args: unknown[]) => {
    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
