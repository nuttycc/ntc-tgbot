import { Bot, Context } from "grammy";
import type { EmojiFlavor } from "@grammyjs/emoji";
import { emojiParser } from "@grammyjs/emoji";
// import { Menu, MenuRange } from "@grammyjs/menu";
import autoTagFeature from "./features/auto-tag.feature.ts";

export type AppContext = EmojiFlavor<Context>;

const bot = new Bot<AppContext>(process.env.BOT_TOKEN || "");

bot.use(emojiParser());
bot.use(autoTagFeature);

bot.catch((err) => {
  console.error("Error in bot:", err);
});

// bot.start({
//   onStart: (botInfo) => {
//     console.log(`Bot @${botInfo.username} started at ${new Date().toUTCString()}`);
//   },
// });

// 替换为您的服务器可公开访问的 URL
const endpointUrl = "https://ntc-tgbot.nuttycc.deno.net/";
await bot.api.setWebhook(endpointUrl);

export default bot;