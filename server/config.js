import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_DIR: z.string().default(path.join(__dirname, '../logs')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ALLOWED_ORIGINS: z.string().default('*'),
  MAX_CONNECTIONS_PER_IP: z.coerce.number().int().min(1).max(1000).default(20),
  MAX_ROOMS: z.coerce.number().int().min(1).max(10000).default(100),
  MAX_PLAYERS_PER_ROOM: z.coerce.number().int().min(2).max(256).default(128),
  GIT_SHA: z.string().default('dev')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  host: env.HOST,
  logDir: env.LOG_DIR,
  logLevel: env.LOG_LEVEL,
  allowedOrigins: env.ALLOWED_ORIGINS === '*'
    ? '*'
    : env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
  maxConnectionsPerIp: env.MAX_CONNECTIONS_PER_IP,
  maxRooms: env.MAX_ROOMS,
  maxPlayersPerRoom: env.MAX_PLAYERS_PER_ROOM,
  gitSha: env.GIT_SHA,
  maxMessageSize: 1024,
  rateLimitCount: 60,
  rateLimitWindow: 1000
};
