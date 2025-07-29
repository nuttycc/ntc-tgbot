import type { AppContext } from '@/types/bot.types.ts';

/**
 * Extracts channel identifier from various input formats.
 * @param input - Channel input (username, or t.me/telegram.me URL)
 * @returns Channel identifier with @ prefix, or null if invalid format
 */
export function extractChannelIdentifier(input: string): string | null {
  const trimmed = input.trim();

  // Handle @channelname format
  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  // Handle channelname format (without @)
  if (trimmed.match(/^[a-zA-Z0-9_]{5,}$/)) {
    return `@${trimmed}`;
  }

  // Handle t.me links
  const tMeMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?t\.me\/([a-zA-Z0-9_]{5,})(?:\/.*)?$/,
  );
  if (tMeMatch) {
    return `@${tMeMatch[1]}`;
  }

  // Handle telegram.me links
  const telegramMeMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?telegram\.me\/([a-zA-Z0-9_]{5,})(?:\/.*)?$/,
  );
  if (telegramMeMatch) {
    return `@${telegramMeMatch[1]}`;
  }

  return null;
}

/**
 * Validate channel and user permissions
 */
export async function validateChannelAccess(
  ctx: AppContext,
  channelId: number,
  channelTitle: string,
): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ 无法获取用户信息。');
    return false;
  }

  try {
    // Check if the bot is a member of the channel
    const botMember = await ctx.api.getChatMember(channelId, ctx.me.id);
    if (!['member', 'administrator', 'creator'].includes(botMember.status)) {
      await ctx.reply(
        `❌ 我不在频道 "${channelTitle}" 中，或者没有足够的权限。\n\n` +
          '请确保：\n' +
          '1. 将我添加到频道中\n' +
          '2. 给我读取消息的权限',
      );
      return false;
    }

    // Check if the user is an administrator of the channel
    const userMember = await ctx.api.getChatMember(channelId, userId);
    if (!['creator', 'administrator'].includes(userMember.status)) {
      await ctx.reply(
        `❌ 您不是频道 "${channelTitle}" 的管理员。\n\n` +
          '只有频道的创建者或管理员才能配置自动标签规则。',
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking channel permissions:', error);
    await ctx.reply(
      '❌ 检查权限时发生错误。请确保：\n' +
        '1. 频道设置正确\n' +
        '2. 我有足够的权限访问频道信息\n' +
        '3. 您有管理该频道的权限',
    );
    return false;
  }
}
