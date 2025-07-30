import { Menu, MenuRange } from '@grammyjs/menu';
import type { AppContext } from '@/types/bot.types.ts';
import { channelRuleMenu } from '@/menus/channel-rules.menu.ts';
import { Keyboard } from 'grammy';
import { fmt, b, code } from '@grammyjs/parse-mode';

// Request ID for channel selection - using a unique identifier
export const CHANNEL_REQUEST_ID = 1001;

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
    // Create keyboard with both new request_chat method and legacy options
    const keyboard = new Keyboard()
      .requestChat('📢 选择频道', CHANNEL_REQUEST_ID, {
        chat_is_channel: true,
        chat_has_username: true,
        user_administrator_rights: {
          is_anonymous: false,
          can_manage_chat: true, // Required: User must be able to manage the channel for bot integration
          can_delete_messages: true, // Required: User needs to delete inappropriate content and manage channel quality
          can_manage_video_chats: false,
          can_restrict_members: false,
          can_promote_members: false,
          can_change_info: true, // Required: User needs to modify channel settings and information for bot configuration
          can_invite_users: true, // Required: User must be able to add the bot to the channel
          can_post_messages: true, // Required: User needs to post messages in the channel (basic channel functionality)
          can_edit_messages: true, // Required: User needs to edit posted messages for content management
          can_pin_messages: true, // Required: User needs to pin important messages and announcements
          can_manage_topics: false,
          can_post_stories: false,
          can_edit_stories: false,
          can_delete_stories: false,
        },
        bot_administrator_rights: {
          is_anonymous: false,
          can_manage_chat: false,
          can_delete_messages: false,
          can_manage_video_chats: false,
          can_restrict_members: false,
          can_promote_members: false,
          can_change_info: false,
          can_invite_users: false,
          can_post_messages: true, // Required: Bot needs to post auto-tagged messages and responses
          can_edit_messages: true, // Required: Bot needs to edit previously posted messages for updates
          can_pin_messages: false,
          can_manage_topics: false,
          can_post_stories: false,
          can_edit_stories: false,
          can_delete_stories: false,
        },
        bot_is_member: true,
      })
      .row()
      .text('📝 手动输入频道信息')
      .resized();

    const formattedMessage = fmt`${b}添加新频道${b}

🎯 ${b}方式 一：${b} 从列表中选择频道
📝 ${b}方式 二：${b} 手动输入频道信息

• 输入频道用户名：${code}@channelname${code} 或 ${code}channelname${code}
• 发送频道链接：${code}https://t.me/channelname${code}
• 从目标频道转发任意消息给我

⚠️ ${b}权限要求：${b}
• 您必须是该频道的管理员
• Bot 需要被添加为该频道管理员，并拥有读取和编辑消息的权限`;

    await ctx.reply(formattedMessage.text, {
      entities: formattedMessage.entities,
      reply_markup: keyboard,
    });
    ctx.menu.close();
  });

// Register sub menu so nav works
manageChannelMenu.register(channelRuleMenu);
