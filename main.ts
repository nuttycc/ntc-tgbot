import { webhookCallback } from "grammy";
// You might modify this to the correct way to import your `Bot` object.
import bot from "./src/bot.ts";

// 替换为您的服务器可公开访问的 URL
const endpointUrl = `https://ntc-tgbot.nuttycc.deno.net/${bot.token}`;
await bot.api.setWebhook(endpointUrl);

const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {

  console.log('Server is running...');

  if (req.method === "POST") {
    const url = new URL(req.url);
    if (url.pathname.slice(1) === bot.token) {
      try {
        console.log("Received update");
        return await handleUpdate(req);
      } catch (err) {
        console.error(err);
      }
    }
  }
  return new Response();
});