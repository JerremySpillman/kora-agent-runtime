# Kora Agent Runtime

Kora-only macOS Slack service, implemented from `KORA_SETUP.md`. Node 22.13+ (this account has Node 26), TypeScript, Slack Bolt Socket Mode, Zod, and Node's SQLite module. Claude Code runs through the approved Kora subscription; Pro/Max is the default policy, with a user-approved Team override supported in the private environment. No model API keys are used. Dependencies are pinned by package-lock.json.

## Local setup

```sh
npm ci
npm run build
npm test
npm run prepare-local
npm run claude-login
npm run doctor -- --live
npm run install-agent
```

Claude Code is installed as a local dependency; the login wrapper selects its isolated Kora config and removes API/provider credentials. Complete the browser login with the Kora subscription. Do not use `--console`. If the browser supplies an authorization code, enter it in the login terminal, never a chat or repository file.

Private paths (resolved from the current account's home directory):

- Environment: `~/.config/kora/runtime.env`, owner-only mode 0600
- Database: `~/.local/share/kora/kora.sqlite`, owner-only mode 0600
- Claude authentication: `~/.config/kora/claude`
- Empty Claude working directory: `~/.local/share/kora/claude-work`
- Operational logs: `~/Library/Logs/Kora`
- LaunchAgent: `~/Library/LaunchAgents/com.kora.agent.plist`

Enter Slack credentials and identifiers directly into the environment file. Confirm that the workspace, installed bot app, and private channel all belong only to Kora. No identifiers or credentials go in this public repository. The environment parser rejects missing values, wrong company, malformed IDs, and unexpected variables.

Use `slack-app-manifest.json` to configure the Kora Slack app if necessary. Enable Socket Mode and create its app-level token with `connections:write`. Install the app in the confirmed Kora workspace and invite the bot to the private `#kora-agent` channel. Put its `xoxb-` bot token and `xapp-` app token in the private file. The runtime checks bot/app/workspace identity, membership, and private, non-shared channel status before starting.

## Slack interface and persistence

Mention Kora in the configured private channel. Prefixes: `docs:`, `support:`, `fin:`, `meetings:`, `projects:`, `research:`. Unprefixed requests use local keyword routing, defaulting to research. One restricted, non-persistent Claude process handles each ordinary message. The runtime exposes only role-appropriate connector tools and denies shell/code execution, arbitrary file access, destructive connector actions and email sending. The Chief of Staff framing consolidates the selected specialist's response.

Replies remain in the originating thread. Plain text chunks disable mention/link parsing and unfurls; an eyes reaction is added during work and removed afterward. DMs and other channels/workspaces are silently denied, with no model call or content storage. Channel discussion should mention the bot for each follow-up.

On weekdays the service posts a top-level morning operating brief at 7:30 AM and an afternoon follow-through brief at 3:30 PM in `America/Los_Angeles`. Briefs use local records and approved read-only Kora Drive tools, carry source identifiers, and are deduplicated by local date and slot. A quality gate rejects infrastructure-focused output, requires the requested business sections, and enforces exactly three final actions; one bounded revision is attempted before a failed brief is withheld. The private environment may override `KORA_TIME_ZONE`, `KORA_MORNING_BRIEF_TIME`, `KORA_AFTERNOON_BRIEF_TIME`, or set `KORA_BRIEFINGS_ENABLED=false`.

The local SQLite database holds conversation context, durable event deduplication and records for support, projects, decisions, follow-ups, knowledge, FIN and document drafts. Records contain company, source type/identifier, import timestamp and provenance. Model-extracted records are explicitly marked inference. Responses include saved record IDs; request updates using those IDs. A batch of record changes is atomic. Event IDs are not retried automatically after failure, to prevent duplicate execution; review saved drafts before sending a new request. Delivery is not transactionally atomic with Slack: a connection failure can leave locally saved records and partial delivery.

Document work produces drafts stored in SQLite and delivered in Slack. An explicitly worded `docs:` request can create a Kora Drive document or rename one existing file; ordinary drafts do not change Drive. The connected Drive update tool cannot edit document bodies. Binary PDF rendering is not connected. Context uses the latest 30 records and six thread turns; this is a base local service, not a full knowledge search engine.

## Company and source boundaries

Only this macOS account and Kora sources are authorized. The service never reads other users' directories. SQLite refuses an existing database without the Kora company marker. Explicit foreign-company labels, personal-investment markers and recognizable credentials are rejected. These checks cannot determine ownership of arbitrary prose; approved source review remains necessary, and Claude's semantic refusal is defense in depth, not a guaranteed content classifier.

Kora Google Drive is connected through the isolated Kora Claude account. Every role can use explicit read-only Drive tools. The Document Builder receives create access only for an explicit Drive creation instruction and metadata-update access only for an explicit rename; ordinary drafting remains read-only. Drive body edits, copy, move, share and trash operations remain unavailable or denied. Before any additional import:

Kora Intercom is connected through the same isolated account. The `fin:` specialist can search and read conversations, contacts, companies and Help Center articles. Article creation, article updates and connector feedback submission are explicitly denied.

1. Confirm Kora Linear team/project mappings before enabling its connector tools.
2. Complete OAuth for the registered `https://mcp.granola.ai/mcp` connector, then confirm a Kora-only meeting boundary before enabling its read tools.
3. Confirm the existing Kora Intercom/FIN connector scope before enabling its tools.
4. Supply the legacy-memory export for review; exclude all non-Kora, personal and unauthorized equity material before ingestion.

Every imported record must carry company=`kora`, source type, source ID, import timestamp and provenance. Do not import an entire mixed account. Do not treat model inference as official Kora facts. The taxonomy is defined in `KORA_SETUP.md`. These connectors need subsequent implementation after their authorized source scope is known.

## Verification and operations

`npm run doctor` checks Node, private configuration permissions, database ownership marker and approved Claude subscription authentication. `--live` additionally runs a restricted Claude smoke test and checks Slack identity/channel/Socket Mode connectivity without posting. Run it before starting the persistent service. Never run a second Socket Mode service concurrently during the live doctor check.

`npm run install-agent -- --prepare` writes the plist without loading it. Installation without that flag validates configuration and subscription authentication, then loads `com.kora.agent`. Inspect status with:

```sh
launchctl print gui/$(id -u)/com.kora.agent
```

A loaded LaunchAgent runs only while this macOS account is logged in. Keep the account logged in and the Mac awake for continuous service; machine sleep/restart behavior is not configured automatically. Launchd restarts failures with a 60-second throttle. Logs emit fixed operational event names and timestamps; raw Slack/Claude errors, credentials and message bodies are not logged. Rotate local logs periodically. Conversation bodies are intentionally stored privately in SQLite, not in operational logs.

Live acceptance includes real threaded Slack replies, verified Kora Drive reads and document creation, verified Intercom reads, a loaded running agent, and sanitized operational logs. Automated tests cover channel/workspace/DM isolation, environment scrubbing, six-role routing, role-gated connector permissions, timezone-aware briefing schedules, foreign-company rejection, durable deduplication, atomic record batches, safe errors and unicode chunking.

Implementation references: [Slack Socket Mode](https://docs.slack.dev/tools/bolt-js/concepts/socket-mode/) and [Claude CLI](https://code.claude.com/docs/en/cli-reference), with flags verified against the installed Claude executable.

## Reviewed local imports and record inspection

`npm run records -- list` lists recent record summaries; `npm run records -- get ID` retrieves a full record locally. These commands intentionally display Kora content in the terminal and are separate from operational logging.

A reviewed source export can be imported with `npm run records -- import /absolute/path/to/reviewed.json --reviewed-kora`. It must be under this account's Documents directory or `~/.local/share/kora/imports`. It must be a JSON object containing `company: "kora"`, `reviewedForKoraOnly: true` and a `records` array matching `recordSchema` in `src/boundary.ts`. This declaration is a review attestation, not automatic authorization or a reliable semantic classifier. Review actual content first. Mixed, unreviewed, credential-bearing and explicitly foreign-company batches are rejected in full. Imports are atomic and repeated source/type/kind/title identities update existing records. Import timestamps are generated locally. No source data has been imported during base setup.

## Current installation checkpoint

The actual Kora app, workspace and private channel have been confirmed with the account owner; their IDs and both Slack credentials are stored only in the private environment. The installed app has passed identity, private membership, shared-channel rejection and Socket Mode connectivity checks. The app's pre-existing scopes were preserved; approved `groups:read` and `users:read` were added for verification. The template manifest expresses the minimum scopes for a new installation and is not a complete export of this existing app.

The account owner approved the authenticated Team subscription as an override to the original Pro/Max requirement; `CLAUDE_SUBSCRIPTION_TYPE=team` is saved only in the private environment. Restricted Claude and Slack connection smoke tests passed. The LaunchAgent is loaded and running. Google Drive reads, explicitly requested document creation/update, and Intercom/Fin reads are configured; destructive Drive and Intercom publishing tools are denied. Linear is registered at the account level but still requires OAuth. A clean Granola MCP endpoint is registered in the isolated Kora Claude profile and still requires OAuth plus a Kora-only meeting boundary. Cross-channel and DM denial are verified with local tests; no other workspace channels were accessed.
