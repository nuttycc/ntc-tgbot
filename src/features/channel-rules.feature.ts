import { Composer } from 'grammy';
import type { AppContext } from '@/types/bot.types.ts';
import { channelRuleMenu } from '@/menus/channel-rules.menu.ts';

const composer = new Composer<AppContext>();

/**
 * Extract channel identifier from various input formats
 */
function extractChannelIdentifier(input: string): string | null {
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
async function validateChannelAccess(
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

/**
 * Handle successful channel authorization
 */
async function handleChannelAuthorization(
  ctx: AppContext,
  channelId: number,
  channelTitle: string,
): Promise<void> {
  // Store channel info in session
  ctx.session.configuringChannelId = channelId;

  await ctx.reply(
    `✅ **授权成功！**\n\n` +
      `📢 频道：**${channelTitle}**\n` +
      `🆔 ID：\`${channelId}\`\n\n` +
      `现在您可以管理此频道的自动标签规则了。`,
    {
      parse_mode: 'Markdown',
      reply_markup: channelRuleMenu,
    },
  );
}

/**
 * Handle /manage_rules command
 * This command can only be used in private chats
 */
composer.command('manage_rules', async (ctx) => {
  // Check if this is a private chat
  if (ctx.chat.type !== 'private') {
    await ctx.reply(
      '❌ 此命令只能在私聊中使用。请直接与我私聊以管理频道规则。',
    );
    return;
  }

  await ctx.reply(
    '📋 **频道规则管理**\n\n' +
      '请选择以下任一方式指定要管理的频道：\n\n' +
      '**方式一：直接输入频道用户名**\n' +
      '• 输入 `@channelname` 或 `channelname`\n' +
      '• 例如：`@mychannel` 或 `mychannel`\n\n' +
      '**方式二：发送频道链接**\n' +
      '• 发送 `https://t.me/channelname`\n' +
      '• 例如：`https://t.me/mychannel`\n\n' +
      '**方式三：转发频道消息**\n' +
      '• 从目标频道转发任意消息给我\n\n' +
      '⚠️ **重要提醒：**\n' +
      '• 您必须是该频道的管理员或创建者\n' +
      '• 我也必须在该频道中并有读取消息的权限',
    {
      parse_mode: 'Markdown',
    },
  );
});

/**
 * Handle text messages for channel identification
 */
composer.on('message:text', async (ctx) => {
  // Only process in private chats
  if (ctx.chat.type !== 'private') {
    return;
  }

  const channelIdentifier = extractChannelIdentifier(ctx.message.text);
  if (!channelIdentifier) {
    return; // Not a channel identifier, ignore
  }

  try {
    // Get channel information
    const chatInfo = await ctx.api.getChat(channelIdentifier);

    // Check if it's a channel
    if (chatInfo.type !== 'channel') {
      await ctx.reply('❌ 指定的聊天不是频道。请指定一个有效的频道。');
      return;
    }

    const channelId = chatInfo.id;
    const channelTitle = chatInfo.title;

    // Validate permissions
    const isValid = await validateChannelAccess(ctx, channelId, channelTitle);
    if (!isValid) {
      return;
    }

    // Handle successful authorization
    await handleChannelAuthorization(ctx, channelId, channelTitle);
  } catch (error) {
    console.error('Error processing channel identifier:', error);

    // Provide helpful error messages
    if (error && typeof error === 'object' && 'error_code' in error) {
      const errorCode = (error as any).error_code;
      if (errorCode === 400) {
        await ctx.reply(
          '❌ 无法找到指定的频道。请检查：\n' +
            '• 频道用户名是否正确\n' +
            '• 频道是否为公开频道\n' +
            '• 我是否已加入该频道',
        );
      } else if (errorCode === 403) {
        await ctx.reply(
          '❌ 无法访问该频道。请确保：\n' +
            '• 频道是公开的，或者\n' +
            '• 我已加入该频道',
        );
      } else {
        await ctx.reply(
          '❌ 处理频道信息时发生错误。请稍后重试或使用转发消息的方式。',
        );
      }
    } else {
      await ctx.reply(
        '❌ 处理频道信息时发生错误。请稍后重试或使用转发消息的方式。',
      );
    }
  }
});

/**
 * Handle forwarded messages for channel identification and authorization
 */
composer.on('message:forward_origin', async (ctx) => {
  // Only process in private chats
  if (ctx.chat.type !== 'private') {
    return;
  }

  const forwardOrigin = ctx.message.forward_origin;

  // Check if the message is forwarded from a channel
  if (forwardOrigin.type !== 'channel') {
    await ctx.reply('❌ 请转发来自频道的消息，而不是来自用户或群组的消息。');
    return;
  }

  const channelId = forwardOrigin.chat.id;
  const channelTitle = forwardOrigin.chat.title;

  // Validate permissions
  const isValid = await validateChannelAccess(ctx, channelId, channelTitle);
  if (!isValid) {
    return;
  }

  // Handle successful authorization
  await handleChannelAuthorization(ctx, channelId, channelTitle);
});

export default composer;
