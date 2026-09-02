import { test } from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {importReviewed} from '../src/importer.js';
const base={company:'kora',sourceType:'google-drive',sourceId:'synthetic-approved-source',provenance:'Synthetic approved-source test fixture',kind:'knowledge',title:'Fixture specification',body:'Test data only',owner:'unassigned',due:'unknown',status:'open',classification:'approved-kora'};
function setup(fn:(store:Store)=>void){const dir=mkdtempSync(join(tmpdir(),'kora-import-'));const store=new Store(join(dir,'test.sqlite'));try{fn(store);}finally{store.close();rmSync(dir,{recursive:true});}}
test('reviewed source import preserves provenance and updates idempotently',()=>setup(store=>{
 const batch={company:'kora',reviewedForKoraOnly:true,records:[base]};const first=importReviewed(store,batch);const second=importReviewed(store,{...batch,records:[{...base,body:'Updated test data'}]});assert.deepEqual(first,second);const rows=store.context('').records;assert.equal(rows.length,1);assert.equal(rows[0].classification,'approved-kora');assert.equal(rows[0].source_id,base.sourceId);assert.ok(rows[0].imported_at);assert.equal(rows[0].body,'Updated test data');
}));
test('mixed, unreviewed and duplicate source batches import nothing',()=>setup(store=>{
 for(const batch of [{company:'kora',reviewedForKoraOnly:false,records:[base]},{company:'kora',reviewedForKoraOnly:true,records:[base,{...base,company:'other'}]},{company:'kora',reviewedForKoraOnly:true,records:[base,{...base,sourceId:'other',body:'personal investment holdings'}]},{company:'kora',reviewedForKoraOnly:true,records:[base,base]}])assert.throws(()=>importReviewed(store,batch));
 assert.equal(store.context('').records.length,0);
}));
