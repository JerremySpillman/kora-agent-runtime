import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { configSchema } from '../src/config.js';
import { allowed,validateRecord } from '../src/boundary.js';
import { claudeEnv,claudeArgs,approvedSubscription,DRIVE_READ_TOOLS,DRIVE_CREATE_TOOLS,DRIVE_UPDATE_TOOLS,DRIVE_MUTATING_TOOLS,INTERCOM_READ_TOOLS,INTERCOM_WRITE_TOOLS } from '../src/claude.js';
import { route } from '../src/routing.js';
import { Store } from '../src/store.js';
import { handle,chunks,type Incoming } from '../src/service.js';
import { dueBriefings,briefingPrompt } from '../src/briefings.js';
const c=configSchema.parse({COMPANY_ID:'kora',SLACK_KORA_BOT_TOKEN:'xoxb-test-placeholder',SLACK_KORA_APP_TOKEN:'xapp-test-placeholder',SLACK_KORA_TEAM_ID:'T00000000',SLACK_KORA_APP_ID:'A00000000',SLACK_KORA_CHANNEL_ID:'C00000000'});
function withStore(fn:(s:Store)=>void|Promise<void>){const dir=mkdtempSync(join(tmpdir(),'kora-test-'));const s=new Store(join(dir,'test.sqlite'));return Promise.resolve().then(()=>fn(s)).finally(()=>{s.close();rmSync(dir,{recursive:true});});}
const record={company:'kora',sourceType:'slack',sourceId:'test',provenance:'synthetic test only',kind:'support',title:'Kora fixture',body:'Synthetic issue',owner:'unassigned',due:'unknown',status:'open',classification:'inference'};
test('channel and workspace allowlist fails closed, including DMs',()=>{
 assert.equal(allowed(c,'T00000000','C00000000'),true);
 for(const args of [['T00000001','C00000000'],['T00000000','C00000001'],[undefined,'C00000000'],['T00000000',undefined]])assert.equal(allowed(c,...args as [string|undefined,string|undefined]),false);
 assert.equal(allowed(c,'T00000000','C00000000',true),false);
});
test('configuration rejects missing secrets, unknown keys and wrong company',()=>{
 for(const change of [{COMPANY_ID:'other'},{SLACK_KORA_CHANNEL_ID:''},{SLACK_KORA_BOT_TOKEN:''},{ANTHROPIC_API_KEY:'fixture'}])assert.equal(configSchema.safeParse({...c,...change}).success,false);
});
test('Claude child has subscription-only environment, restricted read tools and no Slack credentials',()=>{
 const env=claudeEnv({HOME:'/Users/kora-test',PATH:'/bin',ANTHROPIC_API_KEY:'fixture',ANTHROPIC_AUTH_TOKEN:'fixture',ANTHROPIC_BASE_URL:'fixture',CLAUDE_CODE_OAUTH_TOKEN:'fixture',CLAUDE_CODE_USE_BEDROCK:'1',SLACK_KORA_BOT_TOKEN:'fixture',NODE_OPTIONS:'fixture'});
 for(const key of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','CLAUDE_CODE_OAUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','SLACK_KORA_BOT_TOKEN','NODE_OPTIONS'])assert.equal(env[key],undefined);
 assert.equal(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC,undefined);
 assert.equal(env.DISABLE_TELEMETRY,'1');
 assert.equal(env.DISABLE_ERROR_REPORTING,'1');
 assert.equal(env.DISABLE_BUG_COMMAND,'1');
 assert.equal(env.HOME,'/Users/kora-test');const args=claudeArgs('research');
 assert.ok(args.includes('--restricted'));
 assert.ok(args.includes('--no-session-persistence'));
 assert.equal(args[args.indexOf('--max-turns')+1],'8');
 assert.ok(args.includes('--permission-mode'));
 assert.equal(args[args.indexOf('--permission-mode')+1],'dontAsk');
 assert.equal(args[args.indexOf('--allowedTools')+1],DRIVE_READ_TOOLS.join(','));
 assert.equal(args[args.indexOf('--disallowedTools')+1],[...DRIVE_CREATE_TOOLS,...DRIVE_UPDATE_TOOLS,...DRIVE_MUTATING_TOOLS,...INTERCOM_READ_TOOLS,...INTERCOM_WRITE_TOOLS].join(','));
 const docs=claudeArgs('docs','Create and save this document in Kora Google Drive.');
 assert.equal(docs[docs.indexOf('--allowedTools')+1],[...DRIVE_READ_TOOLS,...DRIVE_CREATE_TOOLS].join(','));
 assert.equal(docs[docs.indexOf('--disallowedTools')+1],[...DRIVE_UPDATE_TOOLS,...DRIVE_MUTATING_TOOLS,...INTERCOM_READ_TOOLS,...INTERCOM_WRITE_TOOLS].join(','));
 const draftOnly=claudeArgs('docs','Draft a Kora operating brief in Slack.');
 assert.equal(draftOnly[draftOnly.indexOf('--allowedTools')+1],DRIVE_READ_TOOLS.join(','));
 const update=claudeArgs('docs','Update the Drive document with the new status.');
 assert.equal(update[update.indexOf('--allowedTools')+1],[...DRIVE_READ_TOOLS,...DRIVE_UPDATE_TOOLS].join(','));
 const fin=claudeArgs('fin');
 assert.equal(fin[fin.indexOf('--allowedTools')+1],[...DRIVE_READ_TOOLS,...INTERCOM_READ_TOOLS].join(','));
 assert.equal(fin[fin.indexOf('--disallowedTools')+1],[...DRIVE_CREATE_TOOLS,...DRIVE_UPDATE_TOOLS,...DRIVE_MUTATING_TOOLS,...INTERCOM_WRITE_TOOLS].join(','));
 for(const forbidden of ['--safe-mode','--tools','--strict-mcp-config','--mcp-config','--setting-sources'])assert.equal(args.includes(forbidden),false);
 assert.match(args[args.indexOf('--system-prompt')+1],/Approved tools and connectors may be available/i);
 assert.match(args[args.indexOf('--system-prompt')+1],/Never invoke.*writes/i);
 assert.match(docs[docs.indexOf('--system-prompt')+1],/explicitly asks.*Kora Drive/i);
 assert.match(fin[fin.indexOf('--system-prompt')+1],/read-only Intercom tools/i);
});
test('all six prefixes route to exactly one specialist',()=>{for(const r of ['docs','support','fin','meetings','projects','research'])assert.equal(route(r+': fixture'),r);assert.equal(route('customer bug'),'support');assert.equal(route('meeting minutes'),'meetings');assert.equal(route('hello'),'research');});
test('record company boundary rejects foreign data and credentials',()=>{
 for(const bad of [{company:'other'},{body:'company=other'},{body:'personal investment portfolio'},{body:'xoxb-test-placeholder'}])assert.throws(()=>validateRecord({...record,...bad}));
 assert.equal(validateRecord(record).company,'kora');
});
test('database rejects another company without relabeling',()=>{
 const dir=mkdtempSync(join(tmpdir(),'kora-boundary-'));const path=join(dir,'test.sqlite');const db=new DatabaseSync(path);db.exec("CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);INSERT INTO metadata VALUES('company','other');");db.close();assert.throws(()=>new Store(path),/company_mismatch/);const check=new DatabaseSync(path);assert.equal(check.prepare("SELECT value FROM metadata").get()?.value,'other');check.close();rmSync(dir,{recursive:true});
});
test('durable records can update and failed batch rolls back',()=>withStore(s=>{
 const id=s.save(record);s.save({...record,status:'done'},id);assert.equal(s.context('none').records[0]?.status,'done');
 assert.throws(()=>s.transaction(()=>{s.save({...record,title:'rollback'});s.save({...record,company:'other'});}));assert.equal(s.context('none').records.length,1);
}));
test('denied events cause zero model calls, storage or replies',()=>withStore(async s=>{
 let calls=0;const noop=async()=>{calls++;};const event:Incoming={id:'denied',team:'T00000001',channel:'C00000000',ts:'1',text:'hello'};
 assert.equal(await handle(c,s,event,{reaction:noop,reply:noop},async()=>{calls++;return {reply:'bad',records:[]};}),'denied');assert.equal(calls,0);assert.equal(s.db.prepare('SELECT count(*) AS n FROM events').get()?.n,0);
}));
test('one invocation per event with durable deduplication and record provenance',()=>withStore(async s=>{
 let calls=0;const replies:string[]=[];const reactions:boolean[]=[];
 const event:Incoming={id:'event1',team:c.SLACK_KORA_TEAM_ID,channel:c.SLACK_KORA_CHANNEL_ID,ts:'2',thread:'1',text:'support: Track Kora issue'};
 const delivery={reaction:async(add:boolean)=>{reactions.push(add);},reply:async(text:string)=>{replies.push(text);}};
 const model=async()=>{calls++;return {reply:'Recorded draft.',records:[{kind:'support' as const,title:'Issue',body:'Unverified Kora issue',owner:'unassigned',due:'unknown',status:'open' as const}]};};
 assert.equal(await handle(c,s,event,delivery,model),'completed');assert.equal(await handle(c,s,event,delivery,model),'duplicate');assert.equal(calls,1);assert.equal(replies.length,1);assert.deepEqual(reactions,[true,false]);assert.equal(s.context(event.channel+':1').turns.length,1);
 const r=s.context('x').records[0];assert.equal(r?.company,'kora');assert.equal(r?.source_type,'slack');assert.ok(r?.imported_at);assert.equal(r?.classification,'inference');
}));
test('model failure produces safe reply and clears reaction',()=>withStore(async s=>{
 const replies:string[]=[];const reactions:boolean[]=[];
 await handle(c,s,{id:'error',team:c.SLACK_KORA_TEAM_ID,channel:c.SLACK_KORA_CHANNEL_ID,ts:'3',text:'hello'},{reaction:async a=>{reactions.push(a);},reply:async t=>{replies.push(t);}},async()=>{throw new Error('secret fixture');});
 assert.equal(replies.join('').includes('secret fixture'),false);assert.deepEqual(reactions,[true,false]);
}));
test('Slack chunking preserves unicode and stays below limit',()=>{const text='hello 👋\n'.repeat(1500);const parts=chunks(text);assert.equal(parts.join(''),text);assert.ok(parts.every(p=>p.length<=2800&&!/[\uD800-\uDBFF]$/.test(p)));});

test('weekday briefing schedule is timezone-aware and weekend-safe',()=>{
 const schedule={KORA_TIME_ZONE:'America/Los_Angeles',KORA_MORNING_BRIEF_TIME:'07:30',KORA_AFTERNOON_BRIEF_TIME:'15:30'};
 assert.deepEqual(dueBriefings(new Date('2026-09-02T14:30:00Z'),schedule),[{slot:'morning',date:'2026-09-02'}]);
 assert.deepEqual(dueBriefings(new Date('2026-09-02T22:30:00Z'),schedule),[{slot:'afternoon',date:'2026-09-02'}]);
 assert.deepEqual(dueBriefings(new Date('2026-09-05T17:00:00Z'),schedule),[]);
 assert.match(briefingPrompt('morning','2026-09-02'),/read-only Kora Drive/i);
});

test('subscription billing is fail-closed and Team requires explicit configuration',()=>{
 const status={loggedIn:true,authMethod:'claude.ai',subscriptionType:'team'};
 assert.equal(approvedSubscription(status),false);assert.equal(approvedSubscription(status,['team']),true);
 assert.equal(approvedSubscription({...status,authMethod:'api_key'},['team']),false);
 assert.equal(approvedSubscription({...status,loggedIn:false},['team']),false);
 assert.equal(approvedSubscription({...status,subscriptionType:'pro'}),true);
});
