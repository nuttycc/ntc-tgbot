import { Menu, MenuRange } from '@grammyjs/menu';
import type { AppContext } from '@/types/bot.types.ts';
import {
  getChannelRules,
  removeChannelRule,
  removeChannelRuleStrategy,
} from '@/storage/channel-rules.storage.ts';
import {
  escapeMarkdownV2,
  formatDomainsForMarkdownV2,
  formatStrategiesForMarkdownV2,
} from '@/utils/markdown.ts';
import { getLogger } from '@/utils/logset.ts';

const logger = getLogger(['menus', 'channel-rules']);

/**
 * Main menu for channel rule management
 */
export const channelRuleMenu = new Menu<AppContext>('channel-rule-menu')
  .text('➕ 添加规则', async (ctx) => {
    logger.debug(
      `ctx.session.configuringChannelId: ${ctx.session.configuringChannelId}`,
    );

    if (!ctx.session.configuringChannelId) {
      logger.debug(`ctx.session.configuringChannelId is undefined`);
      await ctx.answerCallbackQuery({
        text: '❌ 未选择频道。请先转发频道消息进行授权。',
        show_alert: true,
      });
      return;
    }

    // Enter the rule creation conversation
    try {
      await ctx.conversation.enter('createRuleConversation');
      await ctx.answerCallbackQuery('开始创建新规则...');
    } catch (error) {
      logger.error('Failed to enter conversation', { error });
      await ctx.answerCallbackQuery({
        text: '❌ 未知错误，无法启动规则创建流程，请重试。',
        show_alert: true,
      });
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
  .text('🗑️ 删除策略', async (ctx) => {
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
      await ctx.answerCallbackQuery({
        text: '❌ 没有可删除的策略。',
        show_alert: false,
      });
      return;
    }

    // Populate domains for deletion menu
    const uniqueDomains = new Set<string>();
    rules.forEach((rule) => {
      rule.domains.forEach((domain) => uniqueDomains.add(domain));
    });

    ctx.session.deletionDomains = Array.from(uniqueDomains).sort();

    // Navigate to domain selection menu with updated message
    await ctx.editMessageText(
      `${escapeMarkdownV2('🗑️ 删除策略')}\n\n` +
        `${escapeMarkdownV2('请选择要删除策略的域名：')}`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: deleteDomainSelectionMenu,
      },
    );
  })
  .text('❌ 退出', async (ctx) => {
    delete ctx.session.configuringChannelId;

    await ctx.editMessageText(
      '👋 已退出频道规则管理。\n\n' +
        '如需管理其他频道，请重新发送 /manage_rules 命令。',
      { reply_markup: { inline_keyboard: [] } },
    );

    await ctx.answerCallbackQuery({
      text: '已退出',
      show_alert: false,
    });
  });

/**
 * Domain selection menu for rule deletion
 */
const deleteDomainSelectionMenu = new Menu<AppContext>(
  'delete-domain-selection',
)
  .dynamic((ctx) => {
    const range = new MenuRange<AppContext>();

    if (!ctx.session.configuringChannelId) {
      return range;
    }

    // Note: We need to handle async in dynamic menu differently
    // Store domains in session for menu rendering
    if (!ctx.session.deletionDomains) {
      // This will be populated when navigating to this menu
      return range;
    }

    ctx.session.deletionDomains.forEach((domain) => {
      range.text(
        {
          text: `🌐 ${domain}`,
          payload: domain,
        },
        async (ctx) => {
          ctx.session.selectedDeletionDomain = ctx.match;

          // Populate rules for the selected domain
          if (ctx.session.configuringChannelId) {
            const allRules = await getChannelRules(
              ctx.session.configuringChannelId,
            );
            ctx.session.domainRulesForDeletion = allRules.filter((rule) =>
              rule.domains.includes(ctx.match!),
            );
          }

          const ruleCount = ctx.session.domainRulesForDeletion?.length || 0;
          await ctx.editMessageText(
            `${escapeMarkdownV2('🗑️ 规则管理')}\n\n` +
              `${escapeMarkdownV2(`域名: ${ctx.match || ''}`)}\n` +
              `${escapeMarkdownV2(`规则数量: ${ruleCount}`)}\n\n` +
              `${escapeMarkdownV2('请选择删除方式：')}`,
            {
              parse_mode: 'MarkdownV2',
              reply_markup: deleteRuleManagementMenu,
            },
          );
        },
      );
    });

    return range;
  })
  .row()
  .text('🔙 返回主菜单', async (ctx) => {
    // Clean up all deletion-related session data
    delete ctx.session.deletionDomains;
    delete ctx.session.selectedDeletionDomain;
    delete ctx.session.domainRulesForDeletion;
    delete ctx.session.strategyItemsForDeletion;
    delete ctx.session.selectedStrategyItem;
    delete ctx.session.selectedRuleIndex;

    await ctx.menu.nav('channel-rule-menu');
    await ctx.answerCallbackQuery({
      text: '已返回主菜单',
      show_alert: false,
    });
  });

/**
 * Rule management menu for selected domain
 */
const deleteRuleManagementMenu = new Menu<AppContext>('delete-rule-management')
  .text('🗑️ 删除全部策略', async (ctx) => {
    if (!ctx.session.selectedDeletionDomain) {
      return;
    }

    const domain = ctx.session.selectedDeletionDomain;
    const rules = ctx.session.domainRulesForDeletion || [];
    const totalStrategies = rules.reduce(
      (sum, rule) => sum + rule.strategies.length,
      0,
    );

    await ctx.editMessageText(
      `${escapeMarkdownV2('⚠️ 确认删除全部策略')}\n\n` +
        `${escapeMarkdownV2(`域名: ${domain}`)}\n` +
        `${escapeMarkdownV2(`将删除 ${rules.length} 条规则，共 ${totalStrategies} 个策略`)}\n\n` +
        `${escapeMarkdownV2('此操作不可撤销，请确认：')}`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: confirmDeleteAllMenu,
      },
    );
  })
  .text('🎯 选择删除策略', async (ctx) => {
    if (
      !ctx.session.domainRulesForDeletion ||
      ctx.session.domainRulesForDeletion.length === 0
    ) {
      return;
    }

    // Populate strategy items for granular deletion - only individual strategies
    const strategyItems: Array<{
      ruleIndex: number;
      strategyIndex: number;
      strategy: import('types/tag.types.ts').Strategy;
      domains: string[];
      isFullRule: boolean;
    }> = [];

    ctx.session.domainRulesForDeletion.forEach((rule, ruleIndex) => {
      // Only add individual strategy deletion options
      rule.strategies.forEach((strategy, strategyIndex) => {
        strategyItems.push({
          ruleIndex,
          strategyIndex,
          strategy: { ...strategy },
          domains: [...rule.domains],
          isFullRule: false,
        });
      });
    });

    ctx.session.strategyItemsForDeletion = strategyItems;

    const domain = ctx.session.selectedDeletionDomain || '';
    const totalStrategies = strategyItems.length;

    let itemsText = `${escapeMarkdownV2('🎯 选择要删除的策略')}\n\n`;
    itemsText += `${escapeMarkdownV2(`域名: ${domain}`)}\n`;
    itemsText += `${escapeMarkdownV2(`可删除策略数量: ${totalStrategies}`)}\n\n`;
    itemsText += `${escapeMarkdownV2('选择要删除的策略：')}\n\n`;

    await ctx.editMessageText(itemsText, {
      parse_mode: 'MarkdownV2',
      reply_markup: deleteItemSelectionMenu,
    });
  })
  .row()
  .text('🔙 返回域名选择', async (ctx) => {
    // Clean up rule and strategy specific session data
    delete ctx.session.selectedDeletionDomain;
    delete ctx.session.domainRulesForDeletion;
    delete ctx.session.strategyItemsForDeletion;
    delete ctx.session.selectedStrategyItem;
    delete ctx.session.selectedRuleIndex;

    await ctx.editMessageText(
      `${escapeMarkdownV2('🗑️ 删除策略')}\n\n` +
        `${escapeMarkdownV2('请选择要删除策略的域名：')}`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: deleteDomainSelectionMenu,
      },
    );
  });

/**
 * Strategy selection menu for deletion
 */
const deleteItemSelectionMenu = new Menu<AppContext>('delete-item-selection')
  .dynamic((ctx) => {
    const range = new MenuRange<AppContext>();

    if (
      !ctx.session.configuringChannelId ||
      !ctx.session.selectedDeletionDomain
    ) {
      return range;
    }

    if (!ctx.session.strategyItemsForDeletion) {
      return range;
    }

    ctx.session.strategyItemsForDeletion.forEach((item, index) => {
      // Only display individual strategies (no full rules)
      let strategyText = item.strategy.type;
      if (item.strategy.type === 'path') {
        strategyText += ` (位置 ${item.strategy.segment})`;
      } else if (item.strategy.type === 'path_after') {
        strategyText += ` (${item.strategy.prefix})`;
      }

      const displayText = `🔧 ${strategyText}`;

      range.text(
        {
          text: displayText,
          payload: index.toString(),
        },
        async (ctx) => {
          const itemIndex = parseInt(ctx.match!);
          const selectedItem =
            ctx.session.strategyItemsForDeletion?.[itemIndex];

          if (!selectedItem) {
            await ctx.answerCallbackQuery({
              text: '策略不存在，请重试',
              show_alert: true,
            });
            return;
          }

          ctx.session.selectedStrategyItem = selectedItem;

          let strategyDisplayText = selectedItem.strategy.type;
          if (selectedItem.strategy.type === 'path') {
            strategyDisplayText += ` (位置 ${selectedItem.strategy.segment})`;
          } else if (selectedItem.strategy.type === 'path_after') {
            strategyDisplayText += ` (${selectedItem.strategy.prefix})`;
          }

          const confirmationText =
            `${escapeMarkdownV2('⚠️ 确认删除策略')}\n\n` +
            `${escapeMarkdownV2(`策略类型: ${strategyDisplayText}`)}\n` +
            `${escapeMarkdownV2(`域名: ${selectedItem.domains.join(', ')}`)}\n\n` +
            `${escapeMarkdownV2('删除此策略后，如果规则中没有其他策略，整个规则将被删除。')}\n\n` +
            `${escapeMarkdownV2('此操作不可撤销，请确认：')}`;

          await ctx.editMessageText(confirmationText, {
            parse_mode: 'MarkdownV2',
            reply_markup: confirmDeleteItemMenu,
          });
        },
      );
    });

    return range;
  })
  .row()
  .text('🔙 返回规则管理', async (ctx) => {
    delete ctx.session.strategyItemsForDeletion;
    delete ctx.session.selectedStrategyItem;

    const domain = ctx.session.selectedDeletionDomain || '';
    const ruleCount = ctx.session.domainRulesForDeletion?.length || 0;

    await ctx.editMessageText(
      `${escapeMarkdownV2('🗑️ 规则管理')}\n\n` +
        `${escapeMarkdownV2(`域名: ${domain}`)}\n` +
        `${escapeMarkdownV2(`规则数量: ${ruleCount}`)}\n\n` +
        `${escapeMarkdownV2('请选择删除方式：')}`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: deleteRuleManagementMenu,
      },
    );
  });

/**
 * Confirmation menu for deleting all strategies in domain
 */
const confirmDeleteAllMenu = new Menu<AppContext>('confirm-delete-all')
  .text('⚠️ 确认删除全部策略', async (ctx) => {
    if (
      !ctx.session.configuringChannelId ||
      !ctx.session.selectedDeletionDomain
    ) {
      return;
    }

    try {
      const channelId = ctx.session.configuringChannelId;
      const domain = ctx.session.selectedDeletionDomain;
      const rules = await getChannelRules(channelId);

      // Find and remove all rules containing the selected domain
      let deletedRuleCount = 0;
      let deletedStrategyCount = 0;

      for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i];
        if (rule && rule.domains.includes(domain)) {
          deletedStrategyCount += rule.strategies.length;
          const success = await removeChannelRule(channelId, i);
          if (success) deletedRuleCount++;
        }
      }

      // Clean up session
      delete ctx.session.deletionDomains;
      delete ctx.session.selectedDeletionDomain;
      delete ctx.session.domainRulesForDeletion;

      await ctx.editMessageText(
        `${escapeMarkdownV2('✅ 删除完成！')}\n\n` +
          `${escapeMarkdownV2(`已删除域名 "${domain}" 下的 ${deletedRuleCount} 条规则，共 ${deletedStrategyCount} 个策略。`)}\n\n` +
          `${escapeMarkdownV2('请选择其他操作：')}`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: channelRuleMenu,
        },
      );
    } catch (error) {
      logger.error('Failed to delete all strategies', { error });
      await ctx.editMessageText(
        `${escapeMarkdownV2('❌ 删除失败')}\n\n` +
          `${escapeMarkdownV2('操作过程中发生错误，请重试。')}`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: channelRuleMenu,
        },
      );
    }
  })
  .text('❌ 取消', async (ctx) => {
    const domain = ctx.session.selectedDeletionDomain || '';
    const rules = ctx.session.domainRulesForDeletion || [];
    const totalStrategies = rules.reduce(
      (sum, rule) => sum + rule.strategies.length,
      0,
    );

    await ctx.editMessageText(
      `${escapeMarkdownV2('🗑️ 策略管理')}\n\n` +
        `${escapeMarkdownV2(`域名: ${domain}`)}\n` +
        `${escapeMarkdownV2(`规则数量: ${rules.length}，策略数量: ${totalStrategies}`)}\n\n` +
        `${escapeMarkdownV2('请选择删除方式：')}`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: deleteRuleManagementMenu,
      },
    );
  });

/**
 * Confirmation menu for deleting individual strategies
 */
const confirmDeleteItemMenu = new Menu<AppContext>('confirm-delete-item')
  .text('⚠️ 确认删除', async (ctx) => {
    if (
      !ctx.session.configuringChannelId ||
      !ctx.session.selectedStrategyItem
    ) {
      return;
    }

    try {
      const channelId = ctx.session.configuringChannelId;
      const selectedItem = ctx.session.selectedStrategyItem;
      let success = false;
      let successMessage = '';

      // Delete individual strategy
      const allRules = await getChannelRules(channelId);
      let actualRuleIndex = -1;
      let actualStrategyIndex = -1;

      // Find the rule and strategy by matching domains and strategy content
      for (let ruleIdx = 0; ruleIdx < allRules.length; ruleIdx++) {
        const rule = allRules[ruleIdx];
        if (!rule) continue;

        const domainsMatch =
          selectedItem.domains.every((domain) =>
            rule.domains.includes(domain),
          ) &&
          rule.domains.every((domain) => selectedItem.domains.includes(domain));

        if (domainsMatch) {
          for (
            let stratIdx = 0;
            stratIdx < rule.strategies.length;
            stratIdx++
          ) {
            if (
              JSON.stringify(rule.strategies[stratIdx]) ===
              JSON.stringify(selectedItem.strategy)
            ) {
              actualRuleIndex = ruleIdx;
              actualStrategyIndex = stratIdx;
              break;
            }
          }
          if (actualRuleIndex !== -1) break;
        }
      }

      if (actualRuleIndex !== -1 && actualStrategyIndex !== -1) {
        success = await removeChannelRuleStrategy(
          channelId,
          actualRuleIndex,
          actualStrategyIndex,
        );
        if (success) {
          let strategyDisplayText = selectedItem.strategy.type;
          if (selectedItem.strategy.type === 'path') {
            strategyDisplayText += ` (位置 ${selectedItem.strategy.segment})`;
          } else if (selectedItem.strategy.type === 'path_after') {
            strategyDisplayText += ` (${selectedItem.strategy.prefix})`;
          }
          successMessage =
            `${escapeMarkdownV2('✅ 策略删除成功！')}\n\n` +
            `${escapeMarkdownV2(`已删除策略: ${strategyDisplayText}`)}\n` +
            `${escapeMarkdownV2(`域名: ${selectedItem.domains.join(', ')}`)}\n\n` +
            `${escapeMarkdownV2('请选择其他操作：')}`;
        }
      }

      if (success) {
        // Clean up session
        delete ctx.session.deletionDomains;
        delete ctx.session.selectedDeletionDomain;
        delete ctx.session.domainRulesForDeletion;
        delete ctx.session.strategyItemsForDeletion;
        delete ctx.session.selectedStrategyItem;
        delete ctx.session.selectedRuleIndex;

        await ctx.editMessageText(successMessage, {
          parse_mode: 'MarkdownV2',
          reply_markup: channelRuleMenu,
        });
      } else {
        await ctx.editMessageText(
          `${escapeMarkdownV2('❌ 删除失败')}\n\n` +
            `${escapeMarkdownV2('操作过程中发生错误，请重试。')}`,
          {
            parse_mode: 'MarkdownV2',
            reply_markup: channelRuleMenu,
          },
        );
      }
    } catch (error) {
      logger.error('Failed to delete item', { error });
      await ctx.editMessageText(
        `${escapeMarkdownV2('❌ 删除失败')}\n\n` +
          `${escapeMarkdownV2('操作过程中发生错误，请重试。')}`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: channelRuleMenu,
        },
      );
    }
  })
  .text('❌ 取消', async (ctx) => {
    const domain = ctx.session.selectedDeletionDomain || '';
    const totalStrategies = ctx.session.strategyItemsForDeletion?.length || 0;

    let itemsText = `${escapeMarkdownV2('🎯 选择要删除的策略')}\n\n`;
    itemsText += `${escapeMarkdownV2(`域名: ${domain}`)}\n`;
    itemsText += `${escapeMarkdownV2(`可删除策略数量: ${totalStrategies}`)}\n\n`;
    itemsText += `${escapeMarkdownV2('选择要删除的策略：')}\n\n`;

    await ctx.editMessageText(itemsText, {
      parse_mode: 'MarkdownV2',
      reply_markup: deleteItemSelectionMenu,
    });
  });

// Register all sub-menus
channelRuleMenu.register(deleteDomainSelectionMenu);
channelRuleMenu.register(deleteRuleManagementMenu);
channelRuleMenu.register(deleteItemSelectionMenu);
channelRuleMenu.register(confirmDeleteAllMenu);
channelRuleMenu.register(confirmDeleteItemMenu);
