import { Menu } from '@grammyjs/menu';
import type { AppContext } from '@/types/bot.types.ts';
import { getChannelRules } from '@/storage/channel-rules.storage.ts';
import {
  escapeMarkdownV2,
  formatDomainsForMarkdownV2,
  formatStrategiesForMarkdownV2,
} from '@/utils/markdown.ts';

/**
 * Main menu for channel rule management
 * Layout optimized: 2-3 buttons per row
 */
export const channelRuleMenu = new Menu<AppContext>('channel-rule-menu')
  // First row: Add and View (2 buttons)
  .text('➕ 添加规则', async (ctx) => {
    // Check if there's a channel being configured
    console.log(
      `ctx.session.configuringChannelId: ${ctx.session.configuringChannelId}`,
    );

    if (!ctx.session.configuringChannelId) {
      console.log(`ctx.session.configuringChannelId is undefined`);
      await ctx.answerCallbackQuery(
        '❌ 未选择频道。请先转发频道消息进行授权。',
      );
      return;
    }

    // Enter the rule creation conversation
    try {
      await ctx.conversation.enter('createRuleConversation');
      await ctx.answerCallbackQuery('开始创建新规则...');
    } catch (error) {
      console.error('Failed to enter conversation:', error);
      await ctx.answerCallbackQuery('❌ 无法启动规则创建流程，请重试。');
    }
  })
  .text('📜 查看规则', async (ctx) => {
    if (!ctx.session.configuringChannelId) {
      await ctx.answerCallbackQuery({
        text: '❌ 未选择频道。',
        show_alert: true,
      });
      return;
    }

    const channelId = ctx.session.configuringChannelId;
    const rules = await getChannelRules(channelId);

    if (rules.length === 0) {
      await ctx.editMessageText(
        `${escapeMarkdownV2('📜 当前规则列表')}\n\n` +
          `${escapeMarkdownV2('🔍 该频道暂无自定义规则。')}\n\n` +
          `${escapeMarkdownV2('点击下方按钮添加第一条规则：')}`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: channelRuleMenu,
        },
      );
    } else {
      let rulesText = `${escapeMarkdownV2('📜 当前规则列表')}\n\n`;
      rules.forEach((rule, index) => {
        const domainsText = formatDomainsForMarkdownV2(rule.domains);
        rulesText += `${escapeMarkdownV2(`${index + 1}.`)} ${escapeMarkdownV2('域名:')} ${domainsText}\n`;
        rulesText += `   ${escapeMarkdownV2('策略数量:')} ${rule.strategies.length}\n`;

        rulesText += formatStrategiesForMarkdownV2(rule.strategies) + '\n\n';
      });

      await ctx.editMessageText(rulesText, {
        parse_mode: 'MarkdownV2',
        reply_markup: channelRuleMenu,
      });
    }

    await ctx.answerCallbackQuery();
  })
  .row()
  // Second row: Delete and Exit (2 buttons)
  .text('🗑️ 删除规则', async (ctx) => {
    if (!ctx.session.configuringChannelId) {
      await ctx.answerCallbackQuery('❌ 未选择频道。');
      return;
    }

    const channelId = ctx.session.configuringChannelId;
    const rules = await getChannelRules(channelId);

    if (rules.length === 0) {
      await ctx.answerCallbackQuery('❌ 没有可删除的规则。');
      return;
    }

    // TODO: Implement rule deletion conversation
    await ctx.answerCallbackQuery('🚧 删除功能将在后续版本中实现。');
  })
  .text('❌ 退出', async (ctx) => {
    delete ctx.session.configuringChannelId;

    await ctx.editMessageText(
      '👋 已退出频道规则管理。\n\n' +
        '如需管理其他频道，请重新发送 /manage_rules 命令。',
      { reply_markup: { inline_keyboard: [] } },
    );

    await ctx.answerCallbackQuery('已退出');
  });
