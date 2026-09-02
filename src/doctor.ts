import { readConfig,paths } from './config.js';
import { subscriptionAuth,invoke } from './claude.js';
import { Store } from './store.js';
import { makeApp,verifySlack } from './slack.js';
async function doctor(){
 let failed=false;function report(name:string,ok:boolean){console.log(`${ok?'PASS':'BLOCKED'} ${name}`);if(!ok)failed=true;}
 report('Node >=22.13',Number(process.versions.node.split('.')[0])>22||(Number(process.versions.node.split('.')[0])===22&&Number(process.versions.node.split('.')[1])>=13));
 let c;try{c=readConfig();report('private configuration',true);}catch(e){console.log(e instanceof Error?e.message:'configuration unavailable');report('private configuration',false);}
 try{new Store(paths.db).close();report('Kora SQLite boundary',true);}catch{report('Kora SQLite boundary',false);}
 const auth=await subscriptionAuth(c?.CLAUDE_SUBSCRIPTION_TYPE?[c.CLAUDE_SUBSCRIPTION_TYPE]:undefined);report('Approved Claude subscription authentication',auth);
 if(process.argv.includes('--live')){
  if(auth){try{await invoke('research','Reply with exactly Kora ready and no records. Do not use a connector for this smoke test.',{},30000);report('Claude restricted runtime smoke test',true);}catch{report('Claude restricted runtime smoke test',false);}}
  if(c){const app=makeApp(c);try{await verifySlack(app,c);await app.start();report('Slack identity, private channel and Socket Mode connection',true);}catch{report('Slack identity, private channel and Socket Mode connection',false);}finally{await app.stop().catch(()=>{});}}
 }
 if(!process.argv.includes('--live'))console.log('Live smoke tests: not run (use --live after login and local configuration).');
 process.exitCode=failed?1:0;
}
doctor().catch(()=>{console.error('doctor_failed');process.exitCode=1;});
