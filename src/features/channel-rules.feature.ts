import { Router } from '@grammyjs/router';
import type { AppContext } from '@/types/bot.types.ts';
import { channelRuleMenu } from '@/menus/channel-rules.menu.ts';
import { manageChannelMenu } from '@/menus/manage-channel.menu.ts';
import {
  extractChannelIdentifier,
  validateChannelAccess,
} from '@/utils/channel.ts';

const router = new Router<AppContext>((ctx) => {
  // This feature is only available in private chats.
  if (ctx.chat?.type !== 'private') {
    return undefined;
  }

  // Route for the /manage_rules command.
  if (ctx.hasCommand('manage_rules')) {
    return 'manage_rules_command';
  }

  // Route for messages forwarded from a channel.
  if (ctx.message?.forward_origin?.type === 'channel') {
    return 'forwarded_message';
  }

  // Route for text messages that are potential channel identifiers.
  if (ctx.message?.text && extractChannelIdentifier(ctx.message.text)) {
    return 'text_identifier';
  }

  // For any other message, do not handle it.
  return undefined;
});

/**
 * Handle /manage_rules command
 */
router.route('manage_rules_command', async (ctx) => {
  const managedChannels = ctx.session.managedChannels ?? [];

  if (managedChannels.length > 0) {
    await ctx.reply('请从下方选择您要管理的频道，或添加一个新频道：', {
      reply_markup: manageChannelMenu,
    });
    return;
  }

  await ctx.reply(
    '**频道规则管理**\n\n' +
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
router.route('text_identifier', async (ctx) => {
  if (!ctx.message?.text) return; // Safeguard for text existence
  const channelIdentifier = extractChannelIdentifier(ctx.message.text);
  if (!channelIdentifier) {
    return; // Should not happen due to router logic, but as a safeguard.
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
    const channelUsername =
      'username' in chatInfo ? chatInfo.username : undefined;

    // Validate permissions
    const isValid = await validateChannelAccess(ctx, channelId, channelTitle);
    if (!isValid) {
      return;
    }

    // Handle successful authorization
    await handleChannelAuthorization(
      ctx,
      channelId,
      channelTitle,
      channelUsername,
    );
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
router.route('forwarded_message', async (ctx) => {
  const forwardOrigin = ctx.message!.forward_origin!;

  // The router ensures this is from a channel, but we can assert for type safety
  if (forwardOrigin.type !== 'channel') {
    await ctx.reply('❌ 请转发来自频道的消息，而不是来自用户或群组的消息。');
    return;
  }

  const channelId = forwardOrigin.chat.id;
  const channelTitle = forwardOrigin.chat.title;
  const channelUsername =
    'username' in forwardOrigin.chat ? forwardOrigin.chat.username : undefined;

  // Validate permissions
  const isValid = await validateChannelAccess(ctx, channelId, channelTitle);
  if (!isValid) {
    return;
  }

  // Handle successful authorization
  await handleChannelAuthorization(
    ctx,
    channelId,
    channelTitle,
    channelUsername,
  );
});

/**
 * Handle successful channel authorization
 */
async function handleChannelAuthorization(
  ctx: AppContext,
  channelId: number,
  channelTitle: string,
  channelUsername?: string,
): Promise<void> {
  // Store channel info in session
  ctx.session.configuringChannelId = channelId;

  // Initialize managedChannels if it doesn't exist
  if (!ctx.session.managedChannels) {
    ctx.session.managedChannels = [];
  }

  // Add channel to the list if it's not already there
  const channelExists = ctx.session.managedChannels.some(
    (c) => c.id === channelId,
  );
  if (!channelExists) {
    const channelData: { id: number; title: string; username?: string } = {
      id: channelId,
      title: channelTitle,
    };
    if (channelUsername) {
      channelData.username = channelUsername;
    }
    ctx.session.managedChannels.push(channelData);
  }

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

export default router;
