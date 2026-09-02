import { spawn } from 'node:child_process';
import { paths, privateDir } from './config.js';
import { systemPrompt, type Role } from './routing.js';
import { z } from 'zod';
export const DRIVE_READ_TOOLS = [
 'mcp__claude_ai_Google_Drive__search_files',
 'mcp__claude_ai_Google_Drive__list_recent_files',
 'mcp__claude_ai_Google_Drive__get_file_metadata',
 'mcp__claude_ai_Google_Drive__read_file_content',
 'mcp__claude_ai_Google_Drive__get_file_permissions',
] as const;
export const DRIVE_CREATE_TOOLS = [
 'mcp__claude_ai_Google_Drive__create_file',
] as const;
export const DRIVE_UPDATE_TOOLS = [
 'mcp__claude_ai_Google_Drive__update_file',
] as const;
export const DRIVE_MUTATING_TOOLS = [
 'mcp__claude_ai_Google_Drive__copy_file',
 'mcp__claude_ai_Google_Drive__share_file',
 'mcp__claude_ai_Google_Drive__trash_file',
] as const;
export const INTERCOM_READ_TOOLS = [
 'mcp__claude_ai_Intercom__search',
 'mcp__claude_ai_Intercom__fetch',
 'mcp__claude_ai_Intercom__search_conversations',
 'mcp__claude_ai_Intercom__get_conversation',
 'mcp__claude_ai_Intercom__search_contacts',
 'mcp__claude_ai_Intercom__get_contact',
 'mcp__claude_ai_Intercom__list_companies',
 'mcp__claude_ai_Intercom__get_company',
 'mcp__claude_ai_Intercom__list_articles',
 'mcp__claude_ai_Intercom__search_articles',
 'mcp__claude_ai_Intercom__get_article',
] as const;
export const INTERCOM_WRITE_TOOLS = [
 'mcp__claude_ai_Intercom__create_article',
 'mcp__claude_ai_Intercom__update_article',
 'mcp__claude_ai_Intercom__submit_mcp_feedback',
] as const;
export function claudeEnv(parent:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv {
 const env:NodeJS.ProcessEnv={};
 for(const key of ['HOME','USER','LOGNAME','PATH','TMPDIR','LANG','LC_ALL','TERM']) if(parent[key]) env[key]=parent[key];
 env.CLAUDE_CONFIG_DIR=paths.claude;
 // Keep telemetry and bug reporting off without disabling account-managed
 // connector discovery, which is also classified as nonessential traffic.
 env.DISABLE_TELEMETRY='1';
 env.DISABLE_ERROR_REPORTING='1';
 env.DISABLE_BUG_COMMAND='1';
 return env;
}
export function explicitDriveCreate(request:string){return /\b(?:create|save)\b[\s\S]{0,100}\b(?:kora\s+)?(?:google\s+)?drive\b/i.test(request);}
export function explicitDriveUpdate(request:string){return /\b(?:update|revise|edit)\b[\s\S]{0,100}\b(?:drive|document|file)\b/i.test(request);}
export function claudeArgs(role:Role,request=''){
 const create=role==='docs'&&explicitDriveCreate(request);
 const update=role==='docs'&&explicitDriveUpdate(request);
 return [
 '-p',
 // Restricted mode confines file tools to paths.cwd and removes command/code
 // execution. Account-managed MCP connectors remain discoverable.
 '--restricted',
 '--disable-slash-commands',
 '--no-chrome',
 '--no-session-persistence',
 '--max-turns','8',
 // Read-only tools may run. Any connector or file operation that asks for
 // approval fails closed in this unattended Slack process.
 '--allowedTools',[...DRIVE_READ_TOOLS,...(create?DRIVE_CREATE_TOOLS:[]),...(update?DRIVE_UPDATE_TOOLS:[]),...(role==='fin'?INTERCOM_READ_TOOLS:[])].join(','),
 '--disallowedTools',[...(create?[]:DRIVE_CREATE_TOOLS),...(update?[]:DRIVE_UPDATE_TOOLS),...DRIVE_MUTATING_TOOLS,...(role==='fin'?[]:INTERCOM_READ_TOOLS),...INTERCOM_WRITE_TOOLS].join(','),
 '--permission-mode','dontAsk',
 '--output-format','json',
 '--system-prompt',systemPrompt(role),
];}
export function runClaude(args:string[],input='',timeout=120000):Promise<string>{
 privateDir(paths.claude); privateDir(paths.cwd);
 return new Promise((resolve,reject)=>{
  const child=spawn(paths.executable,args,{env:claudeEnv(),cwd:paths.cwd,stdio:['pipe','pipe','pipe']});
  let out='',overflow=false,timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeout);
  child.stdout.on('data',chunk=>{if(out.length+chunk.length>2_000_000){overflow=true;child.kill('SIGKILL');}else out+=chunk.toString();});
  child.stderr.resume(); // Never persist raw Claude diagnostics.
  child.stdin.on('error',()=>{});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('claude_unavailable'));});
  child.on('close',code=>{clearTimeout(timer);if(code!==0||overflow||timedOut)reject(new Error('claude_failed'));else resolve(out);});
  child.stdin.end(input);
 });
}
export function approvedSubscription(status:unknown,allowedTypes:readonly string[]=['pro','max']){
 const result=z.object({loggedIn:z.literal(true),authMethod:z.literal('claude.ai'),subscriptionType:z.string()}).safeParse(status);
 return result.success && allowedTypes.includes(result.data.subscriptionType.toLowerCase());
}
export async function subscriptionAuth(allowedTypes:readonly string[]=['pro','max']){
 try {return approvedSubscription(JSON.parse(await runClaude(['auth','status'],'',15000)),allowedTypes);}catch{return false;}
}
const outputSchema=z.object({reply:z.string().min(1).max(12000),records:z.array(z.object({id:z.string().uuid().optional(),kind:z.enum(['support','project','decision','follow-up','knowledge','document','fin']),title:z.string().min(1).max(300),body:z.string().max(15000),owner:z.string().max(200).default('unassigned'),due:z.string().max(100).default('unknown'),status:z.enum(['open','in-progress','blocked','done','draft']).default('open')}).strict()).max(12)}).strict();
export async function invoke(role:Role,request:string,context:unknown,timeout:number){
 // Account connector discovery adds startup latency; keep the agent bounded by
 // max-turns while allowing enough wall time for a read and cited response.
 const raw=JSON.parse(await runClaude(claudeArgs(role,request),JSON.stringify({context,request}),Math.max(timeout,240000)));
 if(raw.is_error || typeof raw.result!=='string')throw new Error('claude_result_failed');
 return outputSchema.parse(JSON.parse(raw.result.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')));
}
