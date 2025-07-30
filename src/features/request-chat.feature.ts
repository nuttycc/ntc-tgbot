import { Router } from '@grammyjs/router';
import type { AppContext } from '@/types/bot.types.ts';
import { CHANNEL_REQUEST_ID } from '@/menus/manage-channel.menu.ts';
import { validateChannelAccess } from '@/utils/channel.ts';
import { channelRuleMenu } from '@/menus/channel-rules.menu.ts';

const router = new Router<AppContext>((ctx) => {
  // This feature is only available in private chats
  if (ctx.chat?.type !== 'private') {
    return undefined;
  }

  // Route for chat_shared service messages from request_chat
  if (ctx.message?.chat_shared?.request_id === CHANNEL_REQUEST_ID) {
    return 'channel_shared';
  }

  // Route for manual input fallback button
  if (ctx.message?.text === '📝 手动输入频道信息') {
    return 'manual_input_fallback';
  }

  return undefined;
});

/**
 * Handle chat_shared service message for channel selection
 */
router.route('channel_shared', async (ctx) => {
  const chatShared = ctx.message?.chat_shared;
  if (!chatShared) {
    await ctx.reply('❌ 无法获取频道信息，请重试。');
    return;
  }

  const channelId = chatShared.chat_id;

  try {
    // Get detailed channel information
    const chatInfo = await ctx.api.getChat(channelId);

    // Verify it's actually a channel
    if (chatInfo.type !== 'channel') {
      await ctx.reply('❌ 选择的聊天不是频道。请选择一个有效的频道。');
      return;
    }

    const channelTitle = chatInfo.title;
    const channelUsername =
      'username' in chatInfo ? chatInfo.username : undefined;

    // Validate permissions using existing validation logic
    const isValid = await validateChannelAccess(ctx, channelId, channelTitle);
    if (!isValid) {
      return;
    }

    // Handle successful authorization using existing logic
    await handleChannelAuthorization(
      ctx,
      channelId,
      channelTitle,
      channelUsername,
    );
  } catch (error) {
    console.error('Error processing shared channel:', error);

    if (error && typeof error === 'object' && 'error_code' in error) {
      const errorCode = (error as any).error_code;
      if (errorCode === 400) {
        await ctx.reply(
          '❌ 无法访问选择的频道。请确保：\n' +
            '• 频道仍然存在\n' +
            '• 我已被添加到频道中\n' +
            '• 我有读取消息的权限',
        );
      } else if (errorCode === 403) {
        await ctx.reply(
          '❌ 无法访问该频道。请确保：\n' +
            '• 我已被添加到频道中\n' +
            '• 我有足够的权限访问频道信息',
        );
      } else {
        await ctx.reply(
          '❌ 处理频道信息时发生错误。请稍后重试或使用手动输入方式。',
        );
      }
    } else {
      await ctx.reply(
        '❌ 处理频道信息时发生错误。请稍后重试或使用手动输入方式。',
      );
    }
  }
});

/**
 * Handle manual input fallback button
 */
router.route('manual_input_fallback', async (ctx) => {
  await ctx.reply(
    '**手动添加频道**\n\n' +
      '请通过以下任一方式，指定您想管理的频道：\n\n' +
      '**方式一：** 输入频道的用户名，例如 `@channelname` 或 `channelname`\n' +
      '**方式二：** 发送频道的公开链接，例如 `https://t.me/channelname`\n' +
      '**方式三：** 从目标频道转发任意一条消息给我\n\n' +
      '⚠️ **重要提示：**\n' +
      '• 您必须是该频道的管理员\n' +
      '• 同时，我也需要被添加为该频道的管理员，并拥有读取消息的权限',
    { parse_mode: 'Markdown' },
  );
});

/**
 * Handle successful channel authorization (reused from existing logic)
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

  // First, remove the reply keyboard
  await ctx.reply('✅ 频道添加成功！', {
    reply_markup: { remove_keyboard: true },
  });

  // Then send the success message with inline keyboard
  await ctx.reply(
    `📢 频道：**${channelTitle}**\n` +
      `🆔 ID：\`${channelId}\`\n` +
      `现在您可以管理此频道的自动标签规则了。`,
    {
      parse_mode: 'Markdown',
      reply_markup: channelRuleMenu,
    },
  );
}

export default router;
