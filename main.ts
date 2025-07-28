import { webhookCallback } from 'grammy';
// You might modify this to the correct way to import your `Bot` object.
import bot from './src/bot.ts';

const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve({ port: 8080 }, async (req) => {
  if (req.method === 'POST') {
    const url = new URL(req.url);
    // Do not log full URL to avoid exposing the bot token.
    console.log(
      `request from ${
        req.headers.get('x-forwarded-for') ??
        req.headers.get('x-real-ip') ??
        'unknown'
      }`,
    );
    if (url.pathname.slice(1) === bot.token) {
      try {
        console.log('Received update');
        return await handleUpdate(req);
      } catch (err) {
        console.error(err);
      }
    }
  }
  return new Response();
});
