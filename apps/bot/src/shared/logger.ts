import pino from 'pino';

import { env } from '../config/env.js';
import { formatLogLine } from './log-format.js';

const loggerOptions = {
  level: env.LOG_LEVEL,
  base: null,
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime
} satisfies pino.LoggerOptions;

const prettyStream: pino.DestinationStream = {
  write(line) {
    const formatted = formatLogLine(line);
    if (formatted) {
      process.stdout.write(`${formatted}\n`);
    }
  }
};

export const logger =
  env.LOG_FORMAT === 'pretty'
    ? pino(loggerOptions, prettyStream)
    : pino(loggerOptions);
