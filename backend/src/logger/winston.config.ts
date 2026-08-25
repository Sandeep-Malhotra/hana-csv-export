import * as winston from 'winston';

const { combine, timestamp, colorize, printf, errors, splat } = winston.format;

/**
 * Human-readable colorized format for development.
 */
const devFormat = combine(
  splat(),
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, context, stack, ...meta }) => {
    const ctx = context ? ` \x1b[36m[${context}]\x1b[0m` : '';
    const stripped = { ...meta };
    delete stripped.ms; // remove nest-internal ms field
    const metaStr =
      Object.keys(stripped).length > 0
        ? `\n    ${JSON.stringify(stripped)}`
        : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${ts} ${level}${ctx} ${message}${metaStr}${stackStr}`;
  }),
);

export const winstonOptions: winston.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'debug',
  transports: [
    new winston.transports.Console({
      format: devFormat,
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
};
