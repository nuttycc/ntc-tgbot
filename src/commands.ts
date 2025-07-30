import type { Bot } from 'grammy';
import type { AppContext } from './types/bot.types';
import { type } from 'arktype';
import { getLogger } from '@/utils/logset.ts';

const logger = getLogger(['commands']);

// TypeScript enum
enum BotCommand {
  MANAGE_RULES = 'manage_rules',
  HELP = 'help',
  START = 'start',
}

// ArkType validator
const CommandSchema = type({
  command: 'string',
  description: 'string',
});

const CommandsListSchema = CommandSchema.array();

// Type-safe configuration
const commandsConfig: Record<BotCommand, string> = {
  [BotCommand.MANAGE_RULES]: '管理频道标签规则',
  [BotCommand.HELP]: '获取帮助',
  [BotCommand.START]: '开始',
};

// Generate and validate
const commandsList = Object.entries(commandsConfig).map(
  ([command, description]) => ({
    command,
    description,
  }),
);

export async function setupBotCommands(bot: Bot<AppContext>) {
  // Runtime validation
  const validatedCommands = CommandsListSchema(commandsList);

  if (validatedCommands instanceof type.errors) {
    throw new Error(`命令配置无效: ${validatedCommands.summary}`);
  }

  await bot.api.setMyCommands(validatedCommands);
  logger.info('Bot commands registered and validated');
}
