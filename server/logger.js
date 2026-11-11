import fs from 'fs';
import path from 'path';
import { Transform, pipeline } from 'stream';
import { config } from './config.js';

if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

export class EventToNDJSONTransform extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
  }

  _transform(chunk, encoding, callback) {
    try {
      const data = JSON.stringify({ timestamp: Date.now(), ...chunk }) + '\n';
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  }
}

export class MatchLogger {
  constructor(matchId) {
    this.matchId = matchId;
    this.filePath = path.join(config.logDir, `match-${matchId}.ndjson`);
    this.transformStream = new EventToNDJSONTransform();
    this.fileStream = fs.createWriteStream(this.filePath, { flags: 'a' });

    pipeline(this.transformStream, this.fileStream, (err) => {
      if (err) {
        console.error(`[Logger Error] Match ${matchId}:`, err);
      }
    });
  }

  log(event) {
    if (!this.transformStream.destroyed) {
      this.transformStream.write(event);
    }
  }

  close() {
    this.transformStream.end();
  }

  static getReplayStream(matchId) {
    const filePath = path.join(config.logDir, `match-${matchId}.ndjson`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.createReadStream(filePath);
  }
}