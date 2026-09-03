import type { WebClient } from '@slack/web-api';
import type { Config } from './config.js';
import { assertKoraContent } from './boundary.js';
import { invoke } from './claude.js';
import { log } from './log.js';
import { chunks } from './service.js';
import type { Store } from './store.js';

export type BriefingSlot='morning'|'afternoon';

const INFRASTRUCTURE_FOCUS=/\b(?:agent[- ]runtime|connector audit|operating hub|repository artifact|git(?:hub)? (?:repo|repository|checkout)|oauth scope|slack app|launchagent|scheduler permission)\b/i;

export function briefingQualityIssues(slot:BriefingSlot,text:string){
 const issues:string[]=[];
 if(INFRASTRUCTURE_FOCUS.test(text))issues.push('infrastructure_focus');
 const required=slot==='morning'
  ? [/priorit/i,/commitment|due|overdue/i,/blocker|waiting/i,/next action/i]
  : [/change/i,/commitment|open/i,/blocker|waiting/i,/carryover|next.business.day/i,/follow-up/i];
 for(const pattern of required)if(!pattern.test(text))issues.push(`missing_${pattern.source}`);
 const actionHeading=slot==='morning'?/next action/i:/follow-up/i;
 const section=text.slice(Math.max(0,text.search(actionHeading)));
 const numbered=(section.match(/(?:^|\n)\s*[1-3][.)]\s+/g)??[]).length;
 if(numbered!==3)issues.push('not_exactly_three_actions');
 return issues;
}

export function assertBriefingQuality(slot:BriefingSlot,text:string){
 const issues=briefingQualityIssues(slot,text);
 if(issues.length)throw new Error(`briefing_quality:${issues.join(',')}`);
}

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
 const guard=`This request was invoked by the deployed Kora scheduler; that invocation is administrator-verified. Connector access is role-gated, so a tool absent from this projects-role session is not evidence that another role lacks it. Focus on substantive Kora company work. Exclude agent-runtime setup, connector audits, Operating Hub files, repository artifacts and infrastructure records unless an unresolved outage directly blocks business work. Do not audit or critique the agent, scheduler or its permissions. Use approved read-only Kora Drive tools when useful and the supplied local records. Cite every Drive-derived claim by file title and source identifier. Mark unknowns and inferences. Do not create records or perform external writes.`;
 return slot==='morning'
  ? `Prepare the Kora morning operating brief for ${date}. ${guard} Include: today's top priorities; due or overdue commitments; blockers and waiting items; up to three important recently changed substantive Kora files; and exactly three recommended next actions.`
  : `Prepare the Kora afternoon follow-through brief for ${date}. ${guard} Include: meaningful business changes today; commitments still open; blockers and waiting items; next-business-day carryover; and exactly three follow-ups.`;
}

export async function deliverBriefing(c:Config,store:Store,client:WebClient,slot:BriefingSlot,date:string){
 const id=`briefing:${date}:${slot}`;
 if(!store.claim(id,'projects'))return 'duplicate';
 try{
  const prompt=briefingPrompt(slot,date);
  let answer=await invoke('projects',prompt,store.context(`scheduled:${slot}`),c.CLAUDE_TIMEOUT_MS);
  const firstIssues=briefingQualityIssues(slot,answer.reply);
  if(firstIssues.length){
   answer=await invoke('projects',`${prompt} Revise the draft before returning it. The prior draft failed these checks: ${firstIssues.join(', ')}. Use clear section headings, keep operational infrastructure out, and put exactly three numbered items in the requested final action section.`,store.context(`scheduled:${slot}:revision`),c.CLAUDE_TIMEOUT_MS);
  }
  assertBriefingQuality(slot,answer.reply);
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
