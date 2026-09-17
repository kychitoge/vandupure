/**
 * Central Logger for Vân Du Override Core Engine
 */

export const Logger = {
  prefix: '[Vân Du Pure]',

  debug(...args: unknown[]): void {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return;
    console.debug(this.prefix, ...args);
  },

  info(...args: unknown[]): void {
    console.info(this.prefix, ...args);
  },

  warn(...args: unknown[]): void {
    console.warn(this.prefix, ...args);
  },

  error(...args: unknown[]): void {
    console.error(this.prefix, ...args);
  }
};
