import type { WebClient } from '@slack/web-api';
import type { Config } from './config.js';
import { assertKoraContent } from './boundary.js';
import { invoke } from './claude.js';
import { log } from './log.js';
import { chunks } from './service.js';
import type { Store } from './store.js';

export type BriefingSlot='morning'|'afternoon';

function localClock(now:Date,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??'';
 return {date:`${get('year')}-${get('month')}-${get('day')}`,weekday:get('weekday'),minutes:Number(get('hour'))*60+Number(get('minute'))};
}
function minutes(value:string){const [hour,minute]=value.split(':').map(Number);return hour*60+minute;}

export function dueBriefings(now:Date,c:Pick<Config,'KORA_TIME_ZONE'|'KORA_MORNING_BRIEF_TIME'|'KORA_AFTERNOON_BRIEF_TIME'>){
 const clock=localClock(now,c.KORA_TIME_ZONE);
 if(!['Mon','Tue','Wed','Thu','Fri'].includes(clock.weekday))return [] as {slot:BriefingSlot,date:string}[];
 const windows:[BriefingSlot,number,number][]=[
  ['morning',minutes(c.KORA_MORNING_BRIEF_TIME),Math.min(minutes(c.KORA_MORNING_BRIEF_TIME)+240,24*60)],
  ['afternoon',minutes(c.KORA_AFTERNOON_BRIEF_TIME),Math.min(minutes(c.KORA_AFTERNOON_BRIEF_TIME)+240,24*60)],
 ];
 return windows.filter(([,start,end])=>clock.minutes>=start&&clock.minutes<end).map(([slot])=>({slot,date:clock.date}));
}

export function briefingPrompt(slot:BriefingSlot,date:string){
 return slot==='morning'
  ? `Prepare the Kora morning operating brief for ${date}. Use approved read-only Kora Drive tools when useful and the supplied local records. Include: today's top priorities; due or overdue commitments; blockers and waiting items; important recently changed Kora files; and exactly three recommended next actions. Cite every Drive-derived claim by file title and source identifier. Mark unknowns and inferences. Do not create records or perform external writes.`
  : `Prepare the Kora afternoon follow-through brief for ${date}. Use approved read-only Kora Drive tools when useful and the supplied local records. Include: meaningful changes today; commitments still open; blockers and waiting items; next-business-day carryover; and exactly three follow-ups. Cite every Drive-derived claim by file title and source identifier. Mark unknowns and inferences. Do not create records or perform external writes.`;
}

export async function deliverBriefing(c:Config,store:Store,client:WebClient,slot:BriefingSlot,date:string){
 const id=`briefing:${date}:${slot}`;
 if(!store.claim(id,'projects'))return 'duplicate';
 try{
  const answer=await invoke('projects',briefingPrompt(slot,date),store.context(`scheduled:${slot}`),c.CLAUDE_TIMEOUT_MS);
  assertKoraContent(answer.reply);
  const heading=slot==='morning'?`Kora morning brief — ${date}`:`Kora afternoon follow-through — ${date}`;
  for(const part of chunks(`${heading}\n\n${answer.reply}`))await client.chat.postMessage({channel:c.SLACK_KORA_CHANNEL_ID,text:part,mrkdwn:false,parse:'none',unfurl_links:false,unfurl_media:false});
  store.finish(id,'completed');log('briefing_completed');return 'completed';
 }catch{
  store.finish(id,'failed');log('briefing_failed');return 'failed';
 }
}

export function bindBriefingScheduler(c:Config,store:Store,client:WebClient,enqueue:(job:()=>Promise<unknown>)=>void,now=()=>new Date()){
 if(!c.KORA_BRIEFINGS_ENABLED)return ()=>{};
 const tick=()=>{for(const due of dueBriefings(now(),c))enqueue(()=>deliverBriefing(c,store,client,due.slot,due.date));};
 const timer=setInterval(tick,60_000);timer.unref();
 for(const due of dueBriefings(now(),c))enqueue(()=>deliverBriefing(c,store,client,due.slot,due.date));
 return ()=>clearInterval(timer);
}
