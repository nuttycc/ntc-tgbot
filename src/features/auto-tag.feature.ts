import { Composer } from 'grammy';
import { Router } from '@grammyjs/router';
import { generateTagsFromUrl } from '@/utils/url-parser.ts';
import type { AppContext } from '@/types/bot.types.ts';
import { getChannelRules } from '@/storage/channel-rules.storage.ts';
import { rules as defaultRules } from '@/config/tag.rules.ts';

const composer = new Composer<AppContext>();

const router = new Router<AppContext>((ctx) => {
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

    // console.log('channelRules', channelRules);

    // Merge rules: channel rules take priority over default rules
    const effectiveRules = [...channelRules, ...defaultRules];

    // console.log('effectiveRules', effectiveRules);

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

    console.log('OriginalText:', JSON.stringify(originalText));

    const notHasTags = Array.from(tags).filter(
      (tag) => !originalText.includes(`#${tag}`),
    );

    if (notHasTags.length === 0) return;

    const newText = `${originalText}\n\n${notHasTags.map((tag) => `#${tag}`).join(' ')}`;

    console.log('NewText:', JSON.stringify(newText));

    if (newText.length > 4096) {
      console.warn(
        'Message length exceeds 4096, cannot add tags:',
        newText.length,
      );
      return;
    }

    // console.log('Before', {entities: channelPost.entities, oldText: channelPost.text});

    await ctx.api.editMessageText(
      channelPost.chat.id,
      channelPost.message_id,
      newText,
      {
        link_preview_options: {
          is_disabled: false,
          url: urlEntities[0]?.text ?? '',
        },
      },
    );

    // if(editedMessage !== true && typeof editedMessage !== "string" && 'entities' in editedMessage && 'text' in editedMessage) {
    //   console.log('After edit', {entities: editedMessage.entities, newText: editedMessage.text});
    // }

    console.log('Edited channel post with tags:', {
      tags: Array.from(tags),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in auto-tagging:', error);
  }
});

composer.use(router);

export default composer;
