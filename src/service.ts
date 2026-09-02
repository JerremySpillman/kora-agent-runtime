import type { Config } from './config.js';
import { allowed, assertKoraContent } from './boundary.js';
import { route } from './routing.js';
import { invoke } from './claude.js';
import { Store } from './store.js';
import { log } from './log.js';
export function chunks(text:string,limit=2800):string[]{
 if(limit<2)throw new Error('invalid_chunk_limit');
 const result:string[]=[];let part='';for(const cp of text){if(part.length+cp.length>limit){result.push(part);part='';}part+=cp;}if(part)result.push(part);return result;
}
export interface Incoming {id:string;team?:string;channel:string;ts:string;thread?:string;text:string;dm?:boolean;}
export interface Delivery {reaction(add:boolean):Promise<unknown>;reply(text:string):Promise<unknown>;}
export async function handle(c:Config,store:Store,event:Incoming,delivery:Delivery,model=invoke){
 if(!allowed(c,event.team,event.channel,event.dm)){log('denied');return 'denied';}
 const role=route(event.text);
 if(!store.claim(event.id,role))return 'duplicate';
 try{
  if(event.text.length>16000)throw new Error('request_too_large');
  assertKoraContent(event.text);
  await delivery.reaction(true).catch(()=>log('reaction_failed'));
  const thread=event.channel+':'+(event.thread??event.ts);
  const answer=await model(role,event.text,store.context(thread),c.CLAUDE_TIMEOUT_MS);
  assertKoraContent(answer.reply);
  const ids=store.transaction(()=>answer.records.map(r=>{const {id,...fields}=r;return store.save({...fields,company:'kora',sourceType:'slack',sourceId:thread+':'+event.ts,provenance:'Model extraction from an allowed Kora Slack request; unverified inference, not an approved source.',classification:'inference'},id);}));
  const reply=answer.reply+(ids.length?'\n\nSaved local Kora records: '+ids.join(', '):'');
  store.turn(thread,event.text,reply);
  // Posting failures are not retried, to avoid duplicating partially delivered responses.
  for(const part of chunks(reply))await delivery.reply(part);
  store.finish(event.id,'completed');log('completed');return 'completed';
 }catch{
  store.finish(event.id,'failed');log('failed');
  await delivery.reply('Kora could not complete this request. It may exceed the Kora boundary, contain sensitive credentials, or require an unavailable service. No external actions were performed. Local drafts may have been saved; check existing records before retrying.').catch(()=>{});
  return 'failed';
 }finally{await delivery.reaction(false).catch(()=>log('reaction_failed'));}
}
