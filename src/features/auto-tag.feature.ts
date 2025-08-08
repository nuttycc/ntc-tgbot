import type { AppContext } from '@/types/bot.types.ts';
import type { Message, MessageEntity } from 'grammy/types';
import type { TagRule } from '@/types/tag.types.ts';
import { Composer } from 'grammy';
import { Router } from '@grammyjs/router';
import { generateTagsFromUrl } from '@/utils/url-parser.ts';
import { getChannelRules } from '@/storage/channel-rules.storage.ts';
import { rules as defaultRules } from '@/config/tag.rules.ts';
import { getLogger } from '@/utils/logset.ts';

const logger = getLogger(['features', 'auto-tag']);

const composer = new Composer<AppContext>();

function getOriginalText(post: Message | undefined): string | undefined {
  if (!post) return undefined;
  return post.text ?? post.caption ?? undefined;
}

function collectUrlEntities(
  post: Message,
): Array<{ offset: number; length: number }> {
  const entities: MessageEntity[] = (post.entities ?? post.caption_entities ?? []) as MessageEntity[];
  const urlEntities = entities.filter((e) => e.type === 'url');
  return urlEntities.map((e) => ({
    offset: e.offset ?? 0,
    length: e.length ?? 0,
  }));
}

function sliceUrls(
  text: string,
  entities: Array<{ offset: number; length: number }>,
): string[] {
  const urls: string[] = [];
  for (const entity of entities) {
    const start = Math.max(0, entity.offset);
    const end = Math.min(text.length, start + Math.max(0, entity.length));
    if (end > start) urls.push(text.slice(start, end));
  }
  return urls;
}

async function loadEffectiveRules(channelId: number): Promise<TagRule[]> {
  const channelRules = await getChannelRules(channelId);
  return [...channelRules, ...defaultRules];
}

function computeTags(urls: string[], effectiveRules: TagRule[]): Set<string> {
  const tags = new Set<string>();
  for (const url of urls) {
    const generatedTags = generateTagsFromUrl(url, effectiveRules);
    for (const tag of generatedTags) tags.add(tag);
  }
  return tags;
}

function buildNewText(originalText: string, tags: Set<string>): string | null {
  const missingTags = Array.from(tags).filter((tag) => !originalText.includes(`#${tag}`));
  if (missingTags.length === 0) return null;
  return `${originalText}\n\n${missingTags.map((t) => `#${t}`).join(' ')}`;
}

async function editMessagePreservingSemantics(
  ctx: AppContext,
  post: Message,
  newText: string,
  firstUrl: string,
): Promise<Message | undefined> {
  if (post.text) {
    if (newText.length > 4096) {
      logger.warn(`Message length ${newText.length} > 4096, cannot add tags`);
      return undefined;
    }

    return (await ctx.api.editMessageText(post.chat.id, post.message_id, newText, {
      link_preview_options: {
        is_disabled: false,
        url: firstUrl,
      },
    })) as unknown as Message;
  }

  if (post.caption) {
    if (newText.length > 1024) {
      logger.warn(
        `Caption length ${newText.length} > 1024, cannot add tags to caption`,
      );
      return undefined;
    }

    return (await ctx.api.editMessageCaption(post.chat.id, post.message_id, {
      caption: newText,
    })) as unknown as Message;
  }

  return undefined;
}

async function handleAutoTag(ctx: AppContext) {
  logger.debug('Auto-tagging channel post', { channelPost: ctx.channelPost });

  const post = ctx.channelPost;
  if (!post) return;

  const originalText = getOriginalText(post);
  if (!originalText) return;

  const urlEntityRanges = collectUrlEntities(post);
  if (urlEntityRanges.length === 0) return;

  const urls = sliceUrls(originalText, urlEntityRanges);
  if (urls.length === 0) return;

  const effectiveRules = await loadEffectiveRules(post.chat.id);
  const tags = computeTags(urls, effectiveRules);
  if (tags.size === 0) return;

  const newText = buildNewText(originalText, tags);
  if (!newText) return;

  const firstUrl = urls[0] ?? '';
  const editedMessage = await editMessagePreservingSemantics(
    ctx,
    post as unknown as Message,
    newText,
    firstUrl,
  );

  logger.debug('Edited channel post with tags', {
    tags: Array.from(tags),
    old: originalText,
    new: editedMessage?.text ?? editedMessage?.caption,
    oldEntities: (post.entities ?? post.caption_entities)?.map((e) => e.type),
    newEntities: (
      editedMessage?.entities ?? editedMessage?.caption_entities ?? []
    ).map((e) => e.type),
  });
}

const router = new Router<AppContext>((ctx) => {
  // Route for channel posts that contain URL entities either in text or caption
  const post = ctx.channelPost;
  if (!post) return undefined;

  const hasUrlInText = post.entities?.some((e) => e.type === 'url') ?? false;
  const hasUrlInCaption =
    post.caption_entities?.some((e) => e.type === 'url') ?? false;

  if (hasUrlInText || hasUrlInCaption) {
    logger.debug('Routing to auto-tag', {
      entities: hasUrlInText ? post.entities : undefined,
      caption_entities: hasUrlInCaption ? post.caption_entities : undefined,
    });
    return 'auto_tag';
  }

  return undefined;
});

router.route('auto_tag', async (ctx) => {
  try {
    await handleAutoTag(ctx);
  } catch (error) {
    logger.error('Error in auto-tagging', { error });
  }
});

composer.use(router);

export default composer;
