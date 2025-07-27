import { Composer } from "grammy";
import { Router } from "@grammyjs/router";
import { generateTagsFromUrl } from "@/utils/url-parser.ts";
import type { AppContext } from "@/bot.ts";

const composer = new Composer<AppContext>();

const router = new Router<AppContext>((ctx) => {
  if (ctx.channelPost?.entities?.some((e) => e.type === "url")) {
    return "auto_tag";
  }
  return undefined;
});

router.route("auto_tag", async (ctx) => {
  try {
    const channelPost = ctx.channelPost;
    if (!channelPost?.text) return;

    const urlEntities = ctx.entities("url");
    if (urlEntities.length === 0) return;

    const tags = new Set<string>();

    // Generate tags from each url
    for (const entity of urlEntities) {
      const url = entity.text;
      const generatedTags = generateTagsFromUrl(url);
      for (const tag of generatedTags) {
        tags.add(tag);
      }
    }

    if (tags.size === 0) return;

    const originalText = channelPost.text;

    const notHasTags = Array.from(tags).filter(
      (tag) => !originalText.includes(`#${tag}`)
    );

    if (notHasTags.length === 0) return;

    const newText = `${originalText}\n\n${notHasTags
      .map((tag) => `#${tag}`)
      .join(" ")}`;

    if (newText.length > 4096) {
      console.warn("Message too long, cannot add tags:", newText.length);
      return;
    }

    await ctx.editMessageText(newText);

    console.log("Edited channel post with tags:", {
      tags: Array.from(tags),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error editing channel post:", error);
  }
});

composer.use(router);

export default composer; 