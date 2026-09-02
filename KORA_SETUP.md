# Kora Mac mini setup contract

## Objective

Configure this macOS account as the isolated, always-on Kora execution environment. The user should work through Slack after setup rather than switch macOS desktops routinely.

Execute the implementation. Do not ask Jerremy to define Kora, invent workflows, write technical requirements, or copy files from another macOS account.

## Hard company boundary

- This account and repository are Kora-only.
- Do not access another macOS user's home directory.
- Do not access or configure HVAC Hero accounts, files, repositories, Slack channels, Google Drive, databases, or credentials.
- Reject any source that is visibly HVAC Hero or personal-investment material.
- Never store passwords, session cookies, OAuth tokens, Slack tokens, Claude credentials, or Codex credentials in Git.
- Never send email. Email output must remain an unsent draft.

## Authentication and billing

- Use Claude Code authenticated through the dedicated Kora Claude Pro/Max subscription.
- Do not request or configure `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `ANTHROPIC_BASE_URL`.
- Remove those variables from every spawned Claude process.
- If Claude authentication is missing, run the normal interactive Claude Code login and let Jerremy complete the browser step.
- Codex may use Jerremy's normal Codex subscription for setup and repository work.

## Known Slack resources

- Workspace: `BAJ_Enterprise`
- Workspace ID: `T0BU7TQKJ49`
- Private Kora channel: `#kora-agent`
- Channel ID: `C0BU42NUX1B`
- Slack app: `Kora Chief of Staff`
- Slack app ID: `A0BU23NG3R9`

The Kora bot must be deny-by-default outside `C0BU42NUX1B`. Responses stay in the originating thread.

## Kora organization already defined

Build one supervisor/router with these six specialist roles. These are internal roles selected by routing; do not create six paid model calls for one message.

### 1. Kora Chief of Staff

Purpose: receive Slack requests, determine which specialist owns the work, preserve company context, surface decisions and blockers, and produce one coherent response.

Routing prefixes:

- `docs:` -> Document Builder
- `support:` -> Support Tracker
- `fin:` -> FIN Integration
- `meetings:` -> Meeting Follow-through
- `projects:` -> Project Manager
- `research:` -> Knowledge & Research

When no prefix is supplied, classify locally and invoke exactly one primary specialist unless the work genuinely requires a composed response.

### 2. Document Builder

Creates and updates proposals, operating documents, partner briefs, process documents, PDFs, customer-facing materials, and agreement drafts using approved Kora sources. It preserves official product facts and clearly marks unknown claims.

### 3. Support Tracker

Tracks product issues, customer questions, owners, severity, status, promised follow-ups, resolution evidence, and recurring support themes. It should create or update durable records rather than leave action items buried in chat.

### 4. FIN Integration

Maintains Kora's FIN support-agent knowledge, source coverage, gaps, escalation rules, draft responses, integration tasks, and test results. FIN was formerly Intercom. It must distinguish verified Kora source material from model inference.

### 5. Meeting Follow-through

Processes Kora meetings from Granola or supplied notes, extracts commitments, owners, dates, delegated work, decisions, and waiting items, and keeps an action register current. It never imports non-Kora meetings.

### 6. Project Manager

Tracks Kora initiatives, owners, deadlines, dependencies, blockers, decisions, and next actions. Linear is the preferred permanent task system once connected. Slack is the interface, not the system of record.

### 7. Knowledge & Research

Answers questions using approved Kora sources, records provenance, highlights uncertainty, and produces decision-ready research. It does not silently mix public research with official Kora facts.

## Known Kora knowledge areas

Use these as the initial taxonomy when approved Kora data becomes available:

- Kora product and Powerblock specifications
- Kora operating system and company hub architecture
- Kora Install Control and the 42-day sold-to-installed SLA
- Kora FIN agent infrastructure
- Shopify D2C reservation, invoice, and ACH payment flow
- Qmerit installation partnership
- Signature Solar master services agreement
- Capital-raise context that is company-authorized
- Key Kora people and decision owners, including Greg and Tyler

Do not invent the contents of these areas. Ask for or connect the approved Kora sources, then ingest with provenance.

## Permanent systems of record

- Slack: requests, conversation, and delivery notification
- Linear: projects, tasks, owners, and deadlines
- Kora Google Drive: approved documents and source files
- Granola: meeting source notes
- GitHub: runtime code and non-secret configuration
- Local Kora SQLite database: routing state, indexed knowledge metadata, support items, decisions, and follow-ups
- Markdown: human-readable reports or backups only, never the primary operating database

## Runtime to implement

Build a Node.js 22+ TypeScript Slack service using Socket Mode and the locally authenticated Claude Code executable. Use `@slack/bolt`, `zod`, and SQLite. Include:

- strict configuration validation
- channel allowlisting
- app-mention and direct-message handling
- thread-preserving replies
- safe Slack message chunking
- an eyes reaction while work is running
- removal of Anthropic API credential variables from Claude child processes
- tool-disabled Claude runs for ordinary Slack conversation
- one specialist invocation per ordinary message
- durable Kora-only SQLite storage with a company identifier check
- redacted operational logs
- unit tests for channel isolation, environment scrubbing, routing, and company-boundary enforcement
- a `doctor` command
- a macOS LaunchAgent installer

Create private local paths under this user's home directory for `.env`, SQLite, and logs. Apply mode `0600` to secret environment files. Never commit them.

## Slack secrets

The runtime requires Slack connection credentials, which are not model API keys:

- `SLACK_KORA_BOT_TOKEN` beginning `xoxb-`
- `SLACK_KORA_APP_TOKEN` beginning `xapp-` with `connections:write`

Prepare the private environment file first. Then tell Jerremy its exact path and have him paste the credentials directly into that local file. Never ask him to paste credentials into Codex chat.

## Data connections

After the base Slack service passes tests, ask Jerremy only for authorization or login steps that cannot be completed automatically:

1. Connect only the Kora Google account/Drive.
2. Connect Linear and map Kora projects/teams.
3. Connect Granola or import its Kora-only export.
4. Import the supplied Claude legacy-memory export after filtering out personal, HVAC, and unauthorized equity material.

Every imported record must include company=`kora`, source type, source identifier, import timestamp, and a concise provenance note.

## Verification and completion

Do not claim success until all available checks pass:

1. Typecheck.
2. Unit tests.
3. Configuration validation.
4. Claude subscription-auth smoke test without API credential variables.
5. Slack connection smoke test.
6. A mention in `#kora-agent` receives one threaded response.
7. A request from any other channel is denied.
8. The LaunchAgent is loaded and remains running.
9. Logs contain no credentials or message bodies.
10. A repository scan finds no HVAC Hero strings or data beyond the explicit prohibition in this setup contract.

Pause only for a browser authentication step, local secret entry, or a final external side effect that requires Jerremy's confirmation. Otherwise keep implementing and testing.

At completion report the runtime path, private environment path, database path, LaunchAgent label/status, allowed Slack channel IDs, connected Kora data sources, test results, and remaining user actions.

