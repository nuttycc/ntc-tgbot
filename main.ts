import { webhookCallback } from "grammy";
// You might modify this to the correct way to import your `Bot` object.
import bot from "./src/bot.ts";

const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
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