import type { Bot } from 'grammy';
import type { AppContext } from './types/bot.types';

export async function setupBotCommands(bot: Bot<AppContext>) {
  // Set bot commands for better UX
  await bot.api.setMyCommands([
    {
      command: 'manage_rules',
      description: '管理频道的自动标签规则 (仅私聊)',
    },
    {
      command: 'help',
      description: '显示帮助信息',
    },
  ]);

  console.log('Bot commands registered');
}
