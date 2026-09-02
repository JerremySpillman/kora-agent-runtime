import { LogLevel, type Logger } from '@slack/logger';
export type Event='starting'|'configuration_ready'|'subscription_ready'|'slack_verified'|'started'|'stopped'|'denied'|'completed'|'failed'|'briefing_completed'|'briefing_failed'|'reaction_failed'|'slack_error'|'slack_warning'|'startup_failed';
// Accept no arbitrary data: neither SDK errors nor Slack message bodies enter logs.
export function log(event:Event){process.stdout.write(JSON.stringify({time:new Date().toISOString(),event})+'\n');}
export const slackLogger:Logger={debug(){},info(){},warn(){log('slack_warning');},error(){log('slack_error');},setLevel(){},getLevel(){return LogLevel.ERROR;},setName(){}};
