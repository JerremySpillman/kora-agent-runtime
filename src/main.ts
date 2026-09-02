import { readConfig, paths } from './config.js';
import { Store } from './store.js';
import { makeApp, verifySlack } from './slack.js';
import { handle, type Incoming } from './service.js';
import { subscriptionAuth } from './claude.js';
import { log } from './log.js';
import { bindBriefingScheduler } from './briefings.js';
async function main(){
 process.umask(0o077);log('starting');
 const c=readConfig();log('configuration_ready');if(!await subscriptionAuth(c.CLAUDE_SUBSCRIPTION_TYPE?[c.CLAUDE_SUBSCRIPTION_TYPE]:undefined))throw new Error('claude_subscription_login_required');
 log('subscription_ready');const store=new Store(paths.db),app=makeApp(c);await verifySlack(app,c);log('slack_verified');
 let queue=Promise.resolve();let pending=0;
 function enqueueJob(job:()=>Promise<unknown>){
  if(pending>=20){log('denied');return;}
  pending++;queue=queue.then(job).then(()=>{},()=>log('failed')).finally(()=>{pending--;});
 }
 function enqueue(event:Incoming){
  // No model invocation, storage or response outside the allowlisted channel.
  if(event.team!==c.SLACK_KORA_TEAM_ID||event.channel!==c.SLACK_KORA_CHANNEL_ID||event.dm){log('denied');return;}
  enqueueJob(()=>handle(c,store,event,{
   reaction:add=>add?app.client.reactions.add({channel:event.channel,timestamp:event.ts,name:'eyes'}):app.client.reactions.remove({channel:event.channel,timestamp:event.ts,name:'eyes'}),
   reply:text=>app.client.chat.postMessage({channel:event.channel,thread_ts:event.thread??event.ts,text,mrkdwn:false,parse:'none',unfurl_links:false,unfurl_media:false}),
  }));
 }
 app.event('app_mention',async({event,body})=>{if('bot_id' in event||'subtype' in event)return;enqueue({id:body.event_id,team:body.team_id,channel:event.channel,ts:event.ts,thread:event.thread_ts,text:event.text.replace(/<@[A-Z0-9]+>/g,'').trim()});});
 app.event('message',async({event,body})=>{if(event.subtype!==undefined||!('text' in event)||!event.text)return;
  // DM events are handled and denied by default; private-channel requests use mentions.
  if('channel_type' in event&&event.channel_type==='im')enqueue({id:body.event_id,team:body.team_id,channel:event.channel,ts:event.ts,text:event.text,dm:true});
 });
 app.error(async()=>log('slack_error'));
 await app.start();const stopBriefings=bindBriefingScheduler(c,store,app.client,enqueueJob);log('started');
 async function stop(){stopBriefings();await app.stop();await queue;store.close();log('stopped');process.exit(0);}
 process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
}
main().catch(()=>{log('startup_failed');process.exitCode=1;});
