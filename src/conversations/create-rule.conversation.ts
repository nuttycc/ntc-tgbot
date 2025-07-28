import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { AppContext } from '@/types/bot.types.ts';
import type { Strategy, TagRule } from '@/types/tag.types.ts';
import { addChannelRule } from '@/storage/channel-rules.storage.ts';
import {
  escapeMarkdownV2,
  formatDomainsForMarkdownV2,
  formatStrategiesForMarkdownV2,
} from '@/utils/markdown.ts';
import { getHostname } from 'tldts';

/**
 * Conversation for creating a new tag rule
 */
export async function createRuleConversation(
  conversation: Conversation<AppContext, AppContext>,
  ctx: AppContext,
) {
  // Get the channel ID from session
  const channelId = await conversation.external(
    (ctx) => ctx.session.configuringChannelId,
  );

  if (!channelId) {
    await ctx.reply('❌ 错误：未找到频道信息。请重新开始流程。');
    return;
  }

  // Send initial message that will be updated throughout the conversation
  const initialMessage = await ctx.reply(
    '🎯 **规则创建向导**\n\n' + '⏳ 正在初始化...',
    { parse_mode: 'Markdown' },
  );

  // Ensure chat exists
  if (!ctx.chat) {
    await ctx.reply('❌ 错误：无法获取聊天信息。');
    return;
  }

  try {
    // Step 1: Get domains
    await ctx.api.editMessageText(
      ctx.chat.id,
      initialMessage.message_id,
      '🌐 **第 1 步：设置域名** (1/3)\n\n' +
        '请输入此规则要匹配的域名或URL。\n\n' +
        '📝 **格式说明：**\n' +
        '• 单个域名：`example.com` 或 `https://example.com`\n' +
        '• 多个域名：`domain1.com, https://domain2.org, domain3.net`\n' +
        '• 用英文逗号分隔\n\n' +
        '💡 **示例：**\n' +
        '`https://twitter.com, x.com` 或 `github.com`\n\n' +
        '🔄 **提示：** 支持直接输入URL，系统会自动提取域名',
      { parse_mode: 'Markdown' },
    );

    const domainsCtx = await conversation.waitFor('message:text');
    const domainsInput = domainsCtx.message.text.trim();

    // Delete user input message to keep chat clean
    try {
      await ctx.api.deleteMessage(ctx.chat.id, domainsCtx.message.message_id);
    } catch {
      // Ignore deletion errors
    }

    if (!domainsInput) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        initialMessage.message_id,
        '❌ 域名不能为空。已取消规则创建。',
      );
      return;
    }

    // Parse and validate domains/URLs
    const rawInputs = domainsInput
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (rawInputs.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        initialMessage.message_id,
        '❌ 未检测到有效输入。已取消规则创建。',
      );
      return;
    }

    // Extract domains from URLs or use direct domain input
    const domains = rawInputs
      .map((input) => {
        // Try to extract hostname from URL, fallback to direct domain
        const hostname = getHostname(input);
        return hostname || input;
      })
      .filter((domain) => domain && domain.length > 0)
      .filter((domain, index, self) => self.indexOf(domain) === index); // Remove duplicates

    if (domains.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        initialMessage.message_id,
        '❌ 未检测到有效域名。已取消规则创建。',
      );
      return;
    }

    // Step 2: Collect strategies
    const strategies: Strategy[] = [];
    let addMoreStrategies = true;

    while (addMoreStrategies) {
      // Show strategy type selection
      const strategyKeyboard = new InlineKeyboard()
        .text('🏷️ 二级域名 (SLD)', 'strategy_sld')
        .text('📂 路径段', 'strategy_path')
        .row()
        .text('📁 最后路径段', 'strategy_path_last')
        .text('🔗 路径后缀', 'strategy_path_after')
        .row()
        .text('❌ 取消', 'strategy_cancel');

      await ctx.api.editMessageText(
        ctx.chat.id,
        initialMessage.message_id,
        `🔧 **第 2 步：配置策略** (2/3)\n\n` +
          `🌐 **已设置域名：** ${domains.join(', ')}\n\n` +
          `📊 **当前策略数量：** ${strategies.length}\n\n` +
          '📖 **策略说明：**\n' +
          '• **二级域名 (SLD)**: 提取域名作为标签 (如：github)\n' +
          '• **路径段**: 提取指定位置的路径段 (如：/user/repo 中的 user)\n' +
          '• **最后路径段**: 提取URL路径的最后一段\n' +
          '• **路径后缀**: 提取指定前缀后的内容作为标签',
        {
          parse_mode: 'Markdown',
          reply_markup: strategyKeyboard,
        },
      );

      const strategyChoice = await conversation.waitFor('callback_query:data');
      const strategyType = strategyChoice.callbackQuery.data;

      await strategyChoice.answerCallbackQuery();

      if (strategyType === 'strategy_cancel') {
        await ctx.api.editMessageText(
          ctx.chat.id,
          initialMessage.message_id,
          '❌ 已取消规则创建。',
        );
        return;
      }

      let newStrategy: Strategy | null = null;

      switch (strategyType) {
        case 'strategy_sld':
          newStrategy = { type: 'sld' };
          break;

        case 'strategy_path':
          await ctx.api.editMessageText(
            ctx.chat.id,
            initialMessage.message_id,
            '📂 **路径段策略配置** (2/3)\n\n' +
              `🌐 **已设置域名：** ${domains.join(', ')}\n` +
              `📊 **当前策略数量：** ${strategies.length}\n\n` +
              '请输入要提取的路径段位置 (从 0 开始计数)：\n\n' +
              '💡 **示例：**\n' +
              'URL: `https://github.com/user/repo/issues`\n' +
              '• 位置 0: `user`\n' +
              '• 位置 1: `repo`\n' +
              '• 位置 2: `issues`\n\n' +
              '请输入数字 (如：0)：',
          );

          const segmentCtx = await conversation.waitFor('message:text');
          const segmentInput = parseInt(segmentCtx.message.text.trim());

          // Delete user input message
          try {
            await ctx.api.deleteMessage(
              ctx.chat.id,
              segmentCtx.message.message_id,
            );
          } catch {
            // Ignore deletion errors
          }

          if (isNaN(segmentInput) || segmentInput < 0) {
            await ctx.api.editMessageText(
              ctx.chat.id,
              initialMessage.message_id,
              '❌ 无效的路径段位置。已跳过此策略。',
            );
            break;
          }

          newStrategy = { type: 'path', segment: segmentInput };
          break;

        case 'strategy_path_last':
          newStrategy = { type: 'path_last' };
          break;

        case 'strategy_path_after':
          await ctx.api.editMessageText(
            ctx.chat.id,
            initialMessage.message_id,
            '🔗 **路径后缀策略配置** (2/3)\n\n' +
              `🌐 **已设置域名：** ${domains.join(', ')}\n` +
              `📊 **当前策略数量：** ${strategies.length}\n\n` +
              '请输入路径前缀 (提取此前缀后的内容)：\n\n' +
              '💡 **示例：**\n' +
              'URL: `https://npmjs.com/package/grammy`\n' +
              '前缀: `/package/`\n' +
              '结果标签: `grammy`\n\n' +
              '请输入前缀 (如：/package/)：',
          );

          const prefixCtx = await conversation.waitFor('message:text');
          const prefix = prefixCtx.message.text.trim();

          // Delete user input message
          try {
            await ctx.api.deleteMessage(
              ctx.chat.id,
              prefixCtx.message.message_id,
            );
          } catch {
            // Ignore deletion errors
          }

          if (!prefix) {
            await ctx.api.editMessageText(
              ctx.chat.id,
              initialMessage.message_id,
              '❌ 前缀不能为空。已跳过此策略。',
            );
            break;
          }

          newStrategy = { type: 'path_after', prefix };
          break;
      }

      if (newStrategy) {
        strategies.push(newStrategy);
      }

      // Ask if user wants to add more strategies
      if (strategies.length > 0) {
        const continueKeyboard = new InlineKeyboard()
          .text('➕ 继续添加策略', 'continue_yes')
          .text('✅ 完成创建', 'continue_no');

        await ctx.api.editMessageText(
          ctx.chat.id,
          initialMessage.message_id,
          `📊 **策略配置进度** (2/3)\n\n` +
            `🌐 **已设置域名：** ${domains.join(', ')}\n` +
            `📊 **当前策略数量：** ${strategies.length}\n\n` +
            '是否继续添加更多策略？',
          {
            reply_markup: continueKeyboard,
          },
        );

        const continueChoice = await conversation.waitFor(
          'callback_query:data',
        );
        await continueChoice.answerCallbackQuery();

        if (continueChoice.callbackQuery.data === 'continue_no') {
          addMoreStrategies = false;
        }
      }
    }

    if (strategies.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        initialMessage.message_id,
        '❌ 未配置任何策略。已取消规则创建。',
      );
      return;
    }

    // Step 3: Save the rule
    await ctx.api.editMessageText(
      ctx.chat.id,
      initialMessage.message_id,
      `💾 **第 3 步：保存规则** (3/3)\n\n` +
        `🌐 **已设置域名：** ${domains.join(', ')}\n` +
        `📊 **已配置策略：** ${strategies.length} 个\n\n` +
        '⏳ 正在保存规则...',
      { parse_mode: 'Markdown' },
    );

    const newRule: TagRule = {
      domains,
      strategies,
    };

    addChannelRule(channelId, newRule);

    // Format strategies for display
    const strategiesText = formatStrategiesForMarkdownV2(strategies, '');
    const domainsText = formatDomainsForMarkdownV2(domains);

    await ctx.api.editMessageText(
      ctx.chat.id,
      initialMessage.message_id,
      `${escapeMarkdownV2('🎉 规则创建成功！')}\n\n` +
        `${escapeMarkdownV2('🌐 域名：')} ${domainsText}\n` +
        `${escapeMarkdownV2('🔧 策略详情：')}\n${strategiesText}\n\n` +
        `${escapeMarkdownV2('现在当有人在频道中发送包含这些域名的链接时，我会自动根据配置的策略添加标签。')}\n\n` +
        `${escapeMarkdownV2('您可以返回之前的消息，继续使用菜单管理规则。')}`,
      {
        parse_mode: 'MarkdownV2',
      },
    );
  } catch (error) {
    console.error('Error in createRuleConversation:', error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      initialMessage.message_id,
      '❌ 创建规则时发生错误。请稍后重试。\n\n' +
        '如果问题持续存在，请联系管理员。',
    );
  }
}
