import { Menu } from '@grammyjs/menu';
import type { AppContext } from '@/types/bot.types.ts';
import { getChannelRules } from '@/storage/channel-rules.storage.ts';

/**
 * Main menu for channel rule management
 */
export const channelRuleMenu = new Menu<AppContext>('channel-rule-menu')
  .text('➕ 添加新规则', async (ctx) => {
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
    console.log(`Entering createRuleConversation`);
    await ctx.conversation.enter('createRuleConversation');
    await ctx.answerCallbackQuery('开始创建新规则...');
  })
  .row()
  .text('📜 查看已有规则', async (ctx) => {
    if (!ctx.session.configuringChannelId) {
      await ctx.answerCallbackQuery('❌ 未选择频道。');
      return;
    }

    const channelId = ctx.session.configuringChannelId;
    const rules = getChannelRules(channelId);

    if (rules.length === 0) {
      await ctx.editMessageText(
        '📜 **当前规则列表**\n\n' +
          '🔍 该频道暂无自定义规则。\n\n' +
          '点击下方按钮添加第一条规则：',
        {
          parse_mode: 'Markdown',
          reply_markup: channelRuleMenu,
        },
      );
    } else {
      let rulesText = '📜 **当前规则列表**\n\n';
      rules.forEach((rule, index) => {
        rulesText += `**${index + 1}.** 域名: ${rule.domains.join(', ')}\n`;
        rulesText += `   策略: ${rule.strategies
          .map((s) => {
            if (s.type === 'sld') return '二级域名';
            if (s.type === 'path') return `路径段-${s.segment}`;
            if (s.type === 'path_last') return '最后路径段';
            if (s.type === 'path_after') return `路径后缀-${s.prefix}`;
            return '未知策略';
          })
          .join(', ')}\n\n`;
      });

      await ctx.editMessageText(rulesText, {
        parse_mode: 'Markdown',
        reply_markup: channelRuleMenu,
      });
    }

    await ctx.answerCallbackQuery();
  })
  .row()
  .text('🗑️ 删除规则', async (ctx) => {
    if (!ctx.session.configuringChannelId) {
      await ctx.answerCallbackQuery('❌ 未选择频道。');
      return;
    }

    const channelId = ctx.session.configuringChannelId;
    const rules = getChannelRules(channelId);

    if (rules.length === 0) {
      await ctx.answerCallbackQuery('❌ 没有可删除的规则。');
      return;
    }

    // TODO: Implement rule deletion conversation
    await ctx.answerCallbackQuery('🚧 删除功能将在后续版本中实现。');
  })
  .row()
  .text('🔙 返回', async (ctx) => {
    delete ctx.session.configuringChannelId;

    await ctx.editMessageText(
      '👋 已退出频道规则管理。\n\n' +
        '如需管理其他频道，请重新发送 /manage_rules 命令。',
    );

    await ctx.answerCallbackQuery('已返回');
  });
