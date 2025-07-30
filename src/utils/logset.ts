import { configure, getConsoleSink, type Sink } from '@logtape/logtape';
import { getFileSink } from '@logtape/file';
import { getPrettyFormatter } from '@logtape/pretty';

import { getLogger as defaultLogger, type Logger } from '@logtape/logtape';

const isDevelopment = process.env.NODE_ENV === 'development';

const prettyFormatter = getPrettyFormatter({
  // Show timestamp
  timestamp: 'date-time', // "time" | "date-time" | "date" | "rfc3339" | etc.

  // Control colors
  colors: true,

  // Category display
  categoryWidth: 15,
  categoryTruncate: 'middle', // "middle" | "end" | false

  // Word wrapping
  wordWrap: true, // true | false | number
});

await configure({
  sinks: {
    console: getConsoleSink({ formatter: prettyFormatter }),
    file: getFileSink('logs/tgbot.log', {
      lazy: true,
      bufferSize: 8192,
      flushInterval: 5000,
      nonBlocking: true,
    }),
  } as Record<string, Sink>,
  loggers: [
    {
      category: ['logtape', 'meta'],
      lowestLevel: 'warning',
      sinks: ['console'],
    },
    {
      category: ['app'],
      lowestLevel: isDevelopment ? 'debug' : 'info',
      sinks: ['console'],
    },
  ],
});

// create a wrapper for the default logger with root category
export const getLogger = (category: string[]) => {
  return defaultLogger(['app', ...category]) as Logger;
};
