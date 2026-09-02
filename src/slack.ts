import { App } from '@slack/bolt';
import type { Config } from './config.js';
import { slackLogger } from './log.js';
export function makeApp(c:Config){return new App({token:c.SLACK_KORA_BOT_TOKEN,appToken:c.SLACK_KORA_APP_TOKEN,socketMode:true,logger:slackLogger,clientOptions:{logger:slackLogger}});}
export async function verifySlack(app:App,c:Config){
 const auth=await app.client.auth.test();
 if(auth.team_id!==c.SLACK_KORA_TEAM_ID || !auth.bot_id)throw new Error('slack_identity_mismatch');
 const bot=await app.client.bots.info({bot:auth.bot_id});
 if(bot.bot?.app_id!==c.SLACK_KORA_APP_ID)throw new Error('slack_app_mismatch');
 const result=await app.client.conversations.info({channel:c.SLACK_KORA_CHANNEL_ID});const ch=result.channel;
 if(!ch?.is_private||!ch.is_member||ch.is_archived||ch.is_ext_shared||ch.is_org_shared||ch.is_shared)throw new Error('slack_channel_not_private_isolated_member');
}
