import { readFileSync,realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve,sep } from 'node:path';
import { Store } from './store.js';
import { paths } from './config.js';
import { importReviewed } from './importer.js';
export function ownedImportPath(path:string){
 const actual=realpathSync(resolve(path));
 const allowed=[resolve(homedir(),'Documents')+sep,resolve(paths.data,'imports')+sep];
 if(!allowed.some(prefix=>actual.startsWith(prefix)))throw new Error('import_requires_current_account_documents_or_kora_imports');
 return actual;
}
function main(){
 process.umask(0o077);const [command,arg,confirmation]=process.argv.slice(2);const store=new Store(paths.db);
 try{
  if(command==='list')console.log(JSON.stringify(store.db.prepare("SELECT id,kind,title,owner,due,status,source_type,source_id,imported_at,classification FROM records WHERE company='kora' ORDER BY imported_at DESC LIMIT 100").all(),null,2));
  else if(command==='get'&&arg){const r=store.db.prepare("SELECT * FROM records WHERE company='kora' AND id=?").get(arg);if(!r)throw new Error('record_not_found');console.log(JSON.stringify(r,null,2));}
  else if(command==='import'&&arg){
   if(confirmation!=='--reviewed-kora')throw new Error('review_source_for_kora_only_before_importing');
   const data=readFileSync(ownedImportPath(arg));if(data.length>10_000_000)throw new Error('import_too_large');
   const ids=importReviewed(store,JSON.parse(data.toString('utf8')));console.log(`Imported ${ids.length} Kora records. No content printed.`);
  }else throw new Error('usage: records list | get ID | import FILE --reviewed-kora');
 }finally{store.close();}
}
// Deliberately omit imported data and schema diagnostics from errors.
if(process.argv[1]?.endsWith('/records.js')){try{main();}catch{console.error('Record operation failed. Check command, source approval and Kora schema; source contents were not logged.');process.exitCode=1;}}
