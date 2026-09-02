import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { readFileSync, lstatSync, mkdirSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { z } from 'zod';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const paths = {
 env: join(homedir(), '.config/kora/runtime.env'),
 data: join(homedir(), '.local/share/kora'),
 db: join(homedir(), '.local/share/kora/kora.sqlite'),
 logs: join(homedir(), 'Library/Logs/Kora'),
 claude: join(homedir(), '.config/kora/claude'),
 cwd: join(homedir(), '.local/share/kora/claude-work'),
 executable: join(ROOT, 'node_modules/.bin/claude'),
};
export function privateDir(path: string) { mkdirSync(path, {recursive:true, mode:0o700}); if(lstatSync(path).isSymbolicLink()) throw new Error('unsafe_private_path'); chmodSync(path,0o700); }
export const configSchema = z.object({
 COMPANY_ID:z.literal('kora'),
 CLAUDE_SUBSCRIPTION_TYPE:z.enum(['pro','max','team']).optional(),
 SLACK_KORA_BOT_TOKEN:z.string().regex(/^xoxb-[A-Za-z0-9-]{10,}$/),
 SLACK_KORA_APP_TOKEN:z.string().regex(/^xapp-[A-Za-z0-9-]{10,}$/),
 SLACK_KORA_TEAM_ID:z.string().regex(/^T[A-Z0-9]{8,}$/),
 SLACK_KORA_APP_ID:z.string().regex(/^A[A-Z0-9]{8,}$/),
 SLACK_KORA_CHANNEL_ID:z.string().regex(/^[CG][A-Z0-9]{8,}$/),
 CLAUDE_TIMEOUT_MS:z.coerce.number().int().min(1000).max(300000).default(120000),
 KORA_TIME_ZONE:z.string().default('America/Los_Angeles').refine(value=>{try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format();return true;}catch{return false;}},'invalid_time_zone'),
 KORA_MORNING_BRIEF_TIME:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).default('07:30'),
 KORA_AFTERNOON_BRIEF_TIME:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).default('15:30'),
 KORA_BRIEFINGS_ENABLED:z.enum(['true','false']).default('true').transform(value=>value==='true'),
}).strict();
export type Config=z.infer<typeof configSchema>;
export function readConfig():Config {
 const st=lstatSync(paths.env);
 if(!st.isFile() || st.isSymbolicLink() || (st.mode & 0o777)!==0o600 || st.uid!==process.getuid?.()) throw new Error('env_requires_owner_0600');
 const result=configSchema.safeParse(parse(readFileSync(paths.env)));
 if(!result.success) throw new Error('invalid_configuration_fields: '+[...new Set(result.error.issues.map(i=>i.path.join('.') || 'unknown_keys'))].join(', '));
 return result.data;
}
