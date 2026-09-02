import { z } from 'zod';
import type { Config } from './config.js';
export function allowed(c:Config, team:string|undefined, channel:string|undefined, isDm=false) {
 return !isDm && team===c.SLACK_KORA_TEAM_ID && channel===c.SLACK_KORA_CHANNEL_ID;
}
export const recordSchema=z.object({
 company:z.literal('kora'), sourceType:z.enum(['slack','google-drive','linear','granola','legacy-memory','public-research']),
 sourceId:z.string().min(1).max(500), provenance:z.string().min(1).max(1000),
 kind:z.enum(['support','project','decision','follow-up','knowledge','document','fin']),
 title:z.string().min(1).max(300), body:z.string().max(30000),
 owner:z.string().max(200).default('unassigned'), due:z.string().max(100).default('unknown'),
 status:z.enum(['open','in-progress','blocked','done','draft']).default('open'),
 classification:z.enum(['approved-kora','inference','public-research']),
}).strict();
export type KoraRecord=z.infer<typeof recordSchema>;
export function assertKoraContent(text:string) {
 if(/\b(?:company\s*[:=]\s*(?!kora\b)[\w-]+|non[- ]kora|personal investment|personal portfolio|unauthorized equity)\b/i.test(text)) throw new Error('company_boundary_rejected');
 if(/\b(?:xox[baprs]-[\w-]+|xapp-[\w-]+|sk-ant-[\w-]+)\b|-----BEGIN .*PRIVATE KEY-----/.test(text)) throw new Error('credential_content_rejected');
}
export function validateRecord(value:unknown) { const r=recordSchema.parse(value); assertKoraContent(r.title+'\n'+r.body); return r; }
