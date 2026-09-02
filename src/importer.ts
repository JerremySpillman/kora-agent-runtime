import { createHash } from 'node:crypto';
import { z } from 'zod';
import { recordSchema, validateRecord, type KoraRecord } from './boundary.js';
import { Store } from './store.js';
export const importSchema=z.object({
 company:z.literal('kora'),
 reviewedForKoraOnly:z.literal(true),
 records:z.array(recordSchema).min(1).max(500),
}).strict();
export function importReviewed(store:Store,value:unknown){
 // Caller must review source content; this flag is an attestation, not a classifier.
 const batch=importSchema.parse(value);
 const records=batch.records.map(validateRecord);
 if(records.some(r=>r.sourceType==='slack'))throw new Error('use_slack_runtime_for_slack_records');
 const identity=(r:KoraRecord)=>createHash('sha256').update(JSON.stringify([r.sourceType,r.sourceId,r.kind,r.title])).digest('hex');
 const keys=records.map(identity);
 if(new Set(keys).size!==keys.length)throw new Error('duplicate_import_identity');
 return store.transaction(()=>records.map((r,i)=>{
  const existing=store.db.prepare("SELECT id FROM records WHERE company='kora' AND source_type=? AND source_id=? AND kind=? AND title=?").get(r.sourceType,r.sourceId,r.kind,r.title);
  if(existing && typeof existing.id!=='string')throw new Error('invalid_existing_record');
  return store.save(r,existing?.id as string|undefined);
 }));
}
