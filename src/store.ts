import { DatabaseSync } from 'node:sqlite';
import { chmodSync, existsSync, lstatSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { privateDir } from './config.js';
import { validateRecord } from './boundary.js';
export class Store {
 db:DatabaseSync;
 constructor(path:string) {
  privateDir(dirname(path));
  if(existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('unsafe_database_path');
  this.db=new DatabaseSync(path); chmodSync(path,0o600);
  const tables=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  if(tables.length) {
   let company; try {company=this.db.prepare("SELECT value FROM metadata WHERE key='company'").get()?.value;}catch{}
   if(company!=='kora'){this.db.close(); throw new Error('database_company_mismatch');}
  }
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   INSERT OR IGNORE INTO metadata VALUES('company','kora');
   CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,company TEXT NOT NULL CHECK(company='kora'),source_type TEXT NOT NULL,source_id TEXT NOT NULL,imported_at TEXT NOT NULL,provenance TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,owner TEXT NOT NULL,due TEXT NOT NULL,status TEXT NOT NULL,classification TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,company TEXT NOT NULL CHECK(company='kora'),role TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS turns(id INTEGER PRIMARY KEY,company TEXT NOT NULL CHECK(company='kora'),thread TEXT NOT NULL,request TEXT NOT NULL,response TEXT NOT NULL,created_at TEXT NOT NULL);`);
 }
 claim(id:string,role:string) {return this.db.prepare("INSERT OR IGNORE INTO events VALUES(?,'kora',?,'running',?)").run(id,role,new Date().toISOString()).changes===1;}
 finish(id:string,state:string) {this.db.prepare('UPDATE events SET state=? WHERE id=?').run(state,id);}
 save(value:unknown,id?:string) {
  const r=validateRecord(value); const key=id??randomUUID();
  if(id && !this.db.prepare("SELECT id FROM records WHERE id=? AND company='kora'").get(id)) throw new Error('unknown_record');
  this.db.prepare(`INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_type=excluded.source_type,source_id=excluded.source_id,imported_at=excluded.imported_at,provenance=excluded.provenance,title=excluded.title,body=excluded.body,owner=excluded.owner,due=excluded.due,status=excluded.status,classification=excluded.classification`).run(key,r.company,r.sourceType,r.sourceId,new Date().toISOString(),r.provenance,r.kind,r.title,r.body,r.owner,r.due,r.status,r.classification);
  return key;
 }
 transaction<T>(fn:()=>T):T {this.db.exec('BEGIN'); try {const result=fn(); this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 context(thread:string) {
  const records=this.db.prepare("SELECT * FROM records WHERE company='kora' ORDER BY imported_at DESC LIMIT 30").all().map(r=>{r.body=String(r.body).slice(0,2000);return r;});
  const turns=this.db.prepare("SELECT request,response FROM (SELECT * FROM turns WHERE company='kora' AND thread=? ORDER BY id DESC LIMIT 6) ORDER BY id").all(thread).map(t=>({request:String(t.request).slice(0,4000),response:String(t.response).slice(0,4000)}));
  return {records,turns,notice:'Recent context only. Record bodies and turns may be truncated; do not infer missing details.'};
 }
 turn(thread:string,request:string,response:string){this.db.prepare("INSERT INTO turns(company,thread,request,response,created_at) VALUES('kora',?,?,?,?)").run(thread,request,response,new Date().toISOString());}
 close(){this.db.close();}
}
