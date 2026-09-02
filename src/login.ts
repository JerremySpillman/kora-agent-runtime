import { spawn } from 'node:child_process';
import { claudeEnv } from './claude.js';
import { paths, privateDir } from './config.js';
privateDir(paths.claude);privateDir(paths.cwd);
const child=spawn(paths.executable,['auth','login'],{env:claudeEnv(),cwd:paths.cwd,stdio:'inherit'});
child.on('error',()=>{console.error('Claude login unavailable');process.exitCode=1;});
child.on('close',code=>{process.exitCode=code??1;});
