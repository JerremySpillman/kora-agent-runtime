import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { paths,ROOT,readConfig } from './config.js';
import { subscriptionAuth } from './claude.js';
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const label='com.kora.agent';
async function install(){
 if(process.platform!=='darwin')throw new Error('macOS_required');
 const plist=join(homedir(),'Library/LaunchAgents',label+'.plist');
 if(!process.argv.includes('--prepare')){const c=readConfig();if(!await subscriptionAuth(c.CLAUDE_SUBSCRIPTION_TYPE?[c.CLAUDE_SUBSCRIPTION_TYPE]:undefined))throw new Error('subscription_login_required');}
 writeFileSync(plist,`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${escape(process.execPath)}</string><string>${escape(join(ROOT,'dist/src/main.js'))}</string></array>
<key>WorkingDirectory</key><string>${escape(ROOT)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>60</integer><key>Umask</key><integer>63</integer>
<key>EnvironmentVariables</key><dict><key>HOME</key><string>${escape(homedir())}</string><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
<key>StandardOutPath</key><string>${escape(join(paths.logs,'runtime.log'))}</string><key>StandardErrorPath</key><string>${escape(join(paths.logs,'stderr.log'))}</string>
</dict></plist>\n`,{mode:0o600});
 if(process.argv.includes('--prepare')){console.log('LaunchAgent prepared, not loaded: '+plist);return;}
 const result=spawnSync('/bin/launchctl',['bootstrap',`gui/${process.getuid!()}`,plist],{stdio:'inherit'});if(result.status!==0)throw new Error('launchagent_load_failed');
 console.log('Loaded '+label);
}
install().catch(e=>{console.error(e instanceof Error?e.message:'launchagent_failed');process.exitCode=1;});
