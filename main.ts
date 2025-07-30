import { webhookCallback } from 'grammy';
import bot from './src/bot.ts';
import { getLogger } from '@/utils/logset.ts';

const logger = getLogger(['webhook']);

const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(
  {
    hostname: '0.0.0.0',
    port: 8000,
    onListen: ({ port, hostname }) =>
      logger.info(`Bot webhook server running on ${hostname}:${port} ...`),
  },
  async (req) => {
    if (req.method === 'POST') {
      const url = new URL(req.url);

      logger.debug(`Received new request from ${url.origin}`);

      if (url.pathname.slice(1) === bot.token) {
        logger.debug(`handling update...`);

        return await handleUpdate(req);
      }
    }

    return new Response();
  },
);
