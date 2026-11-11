import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  logDir: process.env.LOG_DIR || path.join(__dirname, '../logs'),
  maxMessageSize: 1024, // обмеження 1KB
  rateLimitCount: 4,    // макс 4 повідомлення
  rateLimitWindow: 1000 // за 1 секунду
};