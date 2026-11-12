import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ['*.password', '*.token', '*.secret', '*.authorization', 'req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]'
  },
  base: {
    service: 'space-game-server',
    gitSha: config.gitSha
  }
});