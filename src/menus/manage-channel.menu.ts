import { Menu, MenuRange } from '@grammyjs/menu';
import type { AppContext } from '@/types/bot.types.ts';
import { channelRuleMenu } from '@/menus/channel-rules.menu.ts';

export const MANAGE_CHANNEL_MENU_ID = 'manage-channel-menu';

export const manageChannelMenu = new Menu<AppContext>(MANAGE_CHANNEL_MENU_ID)
  .dynamic((ctx) => {
    const range = new MenuRange<AppContext>();
    const channels = ctx.session.managedChannels ?? [];

    if (channels.length === 0) {
      return range;
    }

    channels.forEach((channel) => {
      range.text(
        {
          text: channel.title,
          payload: channel.id.toString(),
        },
        (ctx) => {
          ctx.session.configuringChannelId = Number(ctx.match);
          return ctx.menu.nav('channel-rule-menu');
        },
      );
    });

    return range;
  })
  .row()
  .text('➕ 添加新频道', async (ctx) => {
    await ctx.reply(
      '请通过以下任一方式，指定您想管理的频道：\n\n' +
        '**方式一：** 输入频道的用户名，例如 `@channelname` 或 `channelname`\n' +
        '**方式二：** 发送频道的公开链接，例如 `https://t.me/channelname`\n' +
        '**方式三：** 从目标频道转发任意一条消息给我\n\n' +
        '⚠️ **重要提示：**\n' +
        '• 您必须是该频道的管理员。\n' +
        '• 同时，我也需要被添加为该频道的管理员，并拥有读取消息的权限。',
      { parse_mode: 'Markdown' },
    );
    await ctx.menu.close();
  });

// Register sub menu so nav works
manageChannelMenu.register(channelRuleMenu);
