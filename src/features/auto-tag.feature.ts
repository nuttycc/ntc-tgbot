import type { AppContext } from '@/types/bot.types.ts';
import type { Message } from 'grammy/types';
import { Composer } from 'grammy';
import { Router } from '@grammyjs/router';
import { generateTagsFromUrl } from '@/utils/url-parser.ts';
import { getChannelRules } from '@/storage/channel-rules.storage.ts';
import { rules as defaultRules } from '@/config/tag.rules.ts';
import { getLogger } from '@/utils/logset.ts';

const logger = getLogger(['features', 'auto-tag']);

const composer = new Composer<AppContext>();

const router = new Router<AppContext>((ctx) => {
  // Only route for channel posts with url entities
  if (ctx.channelPost?.entities?.some((e) => e.type === 'url')) {
    return 'auto_tag';
  }

  return undefined;
});

router.route('auto_tag', async (ctx) => {
  try {
    const channelPost = ctx.channelPost;
    if (!channelPost?.text) return;

    const urlEntities = ctx.entities('url');
    if (urlEntities.length === 0) return;

    // Get channel ID and rules
    const channelId = channelPost.chat.id;
    const channelRules = await getChannelRules(channelId);

    // Merge rules: channel rules take priority over default rules
    const effectiveRules = [...channelRules, ...defaultRules];

    const tags = new Set<string>();

    // Generate tags from each url using effective rules
    for (const entity of urlEntities) {
      const url = entity.text;
      const generatedTags = generateTagsFromUrl(url, effectiveRules);
      for (const tag of generatedTags) {
        tags.add(tag);
      }
    }

    if (tags.size === 0) return;

    const originalText = channelPost.text;

    const notHasTags = Array.from(tags).filter(
      (tag) => !originalText.includes(`#${tag}`),
    );

    if (notHasTags.length === 0) return;

    const newText = `${originalText}\n\n${notHasTags.map((tag) => `#${tag}`).join(' ')}`;

    if (newText.length > 4096) {
      logger.warn(`Message length ${newText.length} > 4096, cannot add tags`);
      return;
    }

    const editedMessage = (await ctx.api.editMessageText(
      channelPost.chat.id,
      channelPost.message_id,
      newText,
      {
        link_preview_options: {
          is_disabled: false,
          url: urlEntities[0]?.text ?? '',
        },
      },
    )) as unknown as Message;

    logger.debug('Edited channel post with tags', {
      tags: Array.from(tags),
      old: channelPost.text,
      new: editedMessage.text,
      oldEntities: channelPost.entities?.map((e) => e.type),
      newEntities: editedMessage.entities?.map((e) => e.type),
    });
  } catch (error) {
    logger.error('Error in auto-tagging', { error });
  }
});

composer.use(router);

export default composer;
