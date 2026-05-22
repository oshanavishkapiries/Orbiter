# Orbiter — User Guide

Complete reference for every command, flag, and workflow.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Installation & Setup](#2-installation--setup)
3. [Command Reference](#3-command-reference)
   - [orbiter run](#orbiter-run)
   - [orbiter replay](#orbiter-replay)
   - [orbiter refine](#orbiter-refine)
   - [orbiter session](#orbiter-session)
   - [orbiter profile](#orbiter-profile)
   - [orbiter memory](#orbiter-memory)
   - [orbiter models](#orbiter-models)
   - [orbiter config](#orbiter-config)
   - [orbiter viewer](#orbiter-viewer)
4. [Web Dashboard](#4-web-dashboard)
5. [Configuration File](#5-configuration-file)
6. [How the AI Brain Works](#6-how-the-ai-brain-works)
7. [Browser Persistence & Profiles](#7-browser-persistence--profiles)
8. [Flow Recording & Replay](#8-flow-recording--replay)
9. [Session Memory & Database](#9-session-memory--database)
10. [Common Workflows](#10-common-workflows)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Quick Start

```bash
# Install dependencies
pnpm install

# Set your OpenRouter API key
echo "OPENROUTER_API_KEY=your_key_here" > .env

# Run your first task
npx orbiter run "Go to google.com and search for AI news"
```

That's it. Orbiter opens a browser, figures out the steps, and executes them.

---

## 2. Installation & Setup

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 or higher |
| pnpm | 10+ |
| PostgreSQL | Any (for memory features) |

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
OPENROUTER_API_KEY=sk-or-...

# Optional — override the default PostgreSQL connection
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Build

```bash
pnpm build        # compile TypeScript → dist/
pnpm dev          # run directly with tsx (no build needed)
```

---

## 3. Command Reference

---

### `orbiter run`

**The main command.** Give it a plain-English task, Orbiter uses the LLM to plan and execute it step by step in a real browser.

```
orbiter run <prompt> [options]
```

#### Arguments

| Argument | Description |
|---|---|
| `<prompt>` | What you want the browser to do. Natural language — no special syntax needed. |

#### Flags

| Flag | Default | Description |
|---|---|---|
| `-m, --model <model>` | config default | LLM model to use for this run |
| `-p, --profile <name>` | `default` | Browser profile name (saves login sessions between runs) |
| `--headless` | `false` | Run browser invisibly in the background |
| `--no-record` | recording on | Disable saving the flow to disk |
| `--max-steps <n>` | `50` | Maximum number of tool calls before giving up |
| `--report` | off | Generate a markdown/JSON execution report after the run |
| `--report-format <fmt>` | `markdown` | Report format: `markdown` or `json` |
| `-e, --enhance` | off | Run the prompt through an AI enhancer before execution |

#### Examples

```bash
# Basic task
orbiter run "Go to github.com and star the playwright repository"

# Run headless (no visible browser window)
orbiter run "Scrape the top 10 news headlines from bbc.com" --headless

# Use a specific LLM model
orbiter run "Fill out the contact form on example.com" \
  --model anthropic/claude-opus-4

# Use a named profile (stays logged in between runs)
orbiter run "Post a tweet saying hello world" --profile twitter

# Let AI improve your vague prompt before running
orbiter run "do google stuff" --enhance

# Limit to 20 steps max (faster, lower cost for simple tasks)
orbiter run "Click the first search result on google.com" --max-steps 20

# Generate a detailed report after the run
orbiter run "Extract all product prices from shop.example.com" \
  --report --report-format markdown

# Combine flags
orbiter run "Login to my dashboard and download the latest report" \
  --profile work --headless --max-steps 30 --report
```

#### What happens during a run

```
PROMPT ENHANCEMENT (if --enhance)
  → AI rewrites your vague prompt into precise browser steps

PLANNING PHASE
  → LLM analyzes the task and estimates complexity

EXECUTION PHASE
  → Browser opens
  → LLM calls tools (navigate, click, fill, extract…) step by step
  → Each DOM dump is stored in DB — conversation stays lean
  → On failure, recovery engine retries up to 3 times

COMPLETION
  → Flow saved to data/flows/
  → Extracted data saved to data/outputs/
  → Session stored in PostgreSQL for later inspection
```

---

### `orbiter replay`

**Replay a recorded flow without the LLM.** Zero API cost. Runs the exact same steps that were recorded during a previous `orbiter run`.

```
orbiter replay <flow> [options]
```

#### Arguments

| Argument | Description |
|---|---|
| `<flow>` | Path to a `.flow.json` or `.raw.json` file |

#### Flags

| Flag | Description |
|---|---|
| `--params <json>` | Inject parameters as an inline JSON string |
| `--params-file <path>` | Inject parameters from a JSON file |
| `-p, --profile <name>` | Browser profile to use |
| `--headless` | Run without visible browser window |
| `--stop-on-error` | Stop the replay immediately if any step fails |
| `--screenshot-steps` | Take a screenshot after every step |
| `--skip <steps>` | Comma-separated step IDs to skip |

#### Examples

```bash
# Basic replay
orbiter replay data/flows/my-task.flow.json

# Replay headless (automation / CI pipeline)
orbiter replay data/flows/login-flow.flow.json --headless

# Inject parameters (e.g. different search term each run)
orbiter replay data/flows/google-search.flow.json \
  --params '{"searchTerm": "TypeScript tutorials"}'

# Parameters from a file
orbiter replay data/flows/form-fill.flow.json \
  --params-file ./my-params.json

# Stop immediately if anything fails
orbiter replay data/flows/checkout.flow.json --stop-on-error

# Take a screenshot after every step (for debugging)
orbiter replay data/flows/complex-flow.flow.json --screenshot-steps

# Skip steps 3 and 5 (e.g. skip a login step if already logged in)
orbiter replay data/flows/dashboard.flow.json --skip 3,5

# Use with a saved profile (already logged in)
orbiter replay data/flows/post-tweet.flow.json --profile twitter
```

#### Flow file types

| File | Description |
|---|---|
| `*.raw.json` | Unoptimized — recorded exactly as it happened, including retries |
| `*.flow.json` | Optimized — cleaned by `orbiter refine`, safe to replay reliably |

Always refine a raw flow before replaying it in production:
```bash
orbiter refine data/flows/my-task.raw.json
orbiter replay data/flows/my-task.flow.json
```

---

### `orbiter refine`

**Optimize a raw recorded flow.** Removes redundant steps, fixes fragile selectors, and produces a clean `.flow.json` ready for reliable replay.

```
orbiter refine <flow> [options]
```

#### Arguments

| Argument | Description |
|---|---|
| `<flow>` | Path to the raw flow file (`.raw.json`) |

#### Flags

| Flag | Default | Description |
|---|---|---|
| `--no-auto-clean` | auto-clean on | Skip rule-based cleanup (deduplication, wait removal) |
| `--no-llm` | LLM on | Skip AI-powered selector optimization |
| `-i, --interactive` | off | Review and approve each change manually |
| `-o, --output <path>` | auto | Custom path for the output `.flow.json` |
| `--dry-run` | off | Preview all changes without writing any files |

#### Examples

```bash
# Standard refine (recommended)
orbiter refine data/flows/my-task.raw.json

# Preview what would change without saving anything
orbiter refine data/flows/my-task.raw.json --dry-run

# Review every change and approve/reject interactively
orbiter refine data/flows/my-task.raw.json --interactive

# Only run rule-based cleanup, skip the LLM call (faster, cheaper)
orbiter refine data/flows/my-task.raw.json --no-llm

# Save the optimized flow to a custom location
orbiter refine data/flows/my-task.raw.json --output ./flows/production/login.flow.json

# Skip everything and just copy as-is (rarely useful)
orbiter refine data/flows/my-task.raw.json --no-auto-clean --no-llm
```

#### What refine does

```
Step 1 — Auto-clean (rule-based, no LLM cost)
  • Remove duplicate clicks on the same element
  • Remove redundant waits that always time out
  • Collapse consecutive scroll steps
  • Strip failed retry attempts

Step 2 — LLM optimization
  • Suggest more stable CSS selectors (ID > aria-label > data-testid)
  • Identify steps that can be combined
  • Flag steps likely to break on re-run

Step 3 — Output
  • Writes a clean .flow.json alongside the original .raw.json
  • Original file is never modified
```

---

### `orbiter session`

**Inspect what the AI did and what data it collected.** Every run stores its full step history, DOM snapshots, and extracted data in PostgreSQL. These commands let you browse it.

```
orbiter session <subcommand> [options]
```

#### Subcommands

---

##### `orbiter session list`

List recent automation sessions.

```bash
orbiter session list
orbiter session list --limit 30
```

| Flag | Default | Description |
|---|---|---|
| `-n, --limit <n>` | `15` | Number of sessions to show |

**Output example:**
```
Recent Sessions
────────────────────────────────────────────────────────────────────────
  sess_abc123  completed  12.4s
  Goal:    Extract top 50 hotels from booking.com/new-york
  Model:   openrouter/anthropic/claude-sonnet-4   Steps: 18   5/22/2026, 3:41 PM

  sess_def456  failed  8.1s
  Goal:    Login to my dashboard
  Model:   openrouter/anthropic/claude-sonnet-4   Steps: 7    5/22/2026, 3:28 PM
```

---

##### `orbiter session show <session-id>`

Inspect every step of a specific session.

```bash
orbiter session show sess_abc123
orbiter session show sess_abc123 --full
```

| Flag | Description |
|---|---|
| `--full` | Also print the raw JSON result for each step (verbose) |

**Output example:**
```
Session Details
────────────────────────────────────────────────────────────────────────
  ID:     sess_abc123
  Goal:   Extract top 50 hotels from booking.com/new-york
  Model:  openrouter/anthropic/claude-sonnet-4
  Status: completed  (12.4s)
  Date:   5/22/2026, 3:41:22 PM

Steps (18 total)
────────────────────────────────────────────────────────────────────────
  ✓ Step  1  navigate                   1823ms
             Navigated to https://booking.com ("Booking.com"). Page has 3 inputs…
  ✓ Step  2  fill                        312ms
             Filled "input[data-testid='destination-input']" with value.
  ✓ Step  3  extract_data               2104ms
             Extracted 50 item(s). Fields: [name, price, rating]. Full dataset saved…
```

---

##### `orbiter session data <session-id>`

View the structured data that was extracted during a session.

```bash
orbiter session data sess_abc123
orbiter session data sess_abc123 --json
```

| Flag | Description |
|---|---|
| `--json` | Output raw JSON (pipe to `jq`, save to file, etc.) |

**Examples:**
```bash
# Human-readable table view
orbiter session data sess_abc123

# Raw JSON — pipe into jq
orbiter session data sess_abc123 --json | jq '.[] | .data'

# Save extracted data to a file
orbiter session data sess_abc123 --json > results.json
```

---

### `orbiter profile`

**Manage browser profiles.** Each profile is a persistent browser session — cookies, localStorage, and login tokens are saved between runs. Works exactly like Chrome remembering your logins.

```
orbiter profile <subcommand> [options]
```

#### Subcommands

---

##### `orbiter profile list`

Show all profiles and whether they have saved login sessions.

```bash
orbiter profile list
```

**Output example:**
```
Browser Profiles
────────────────────────────────────────────────────────────────
  default  [has saved sessions]
    Default profile (has saved login sessions)
    Path: D:\Orbiter\data\browser-profile
    Last used: 5/22/2026, 3:41 PM

  github  [has saved sessions]
    My GitHub account
    Path: D:\Orbiter\data\profiles\github
    Last used: 5/22/2026, 2:10 PM

  fresh-test  [fresh — no saved state]
    Path: D:\Orbiter\data\profiles\fresh-test
    Never used
```

---

##### `orbiter profile create <name>`

Create a new named profile (empty, no saved state yet).

```bash
orbiter profile create github
orbiter profile create work --description "Work Google Workspace account"
orbiter profile create shopping --description "Amazon + eBay sessions"
```

| Flag | Description |
|---|---|
| `-d, --description <text>` | Optional label shown in `profile list` |

After creating a profile, run a task with it once to log in — from the second run onward, you are already authenticated:

```bash
# First run: browser opens fresh, log in manually
orbiter run "Go to github.com and login" --profile github

# All future runs: already logged in, no login step needed
orbiter run "Go to github and open my pull requests" --profile github
orbiter run "Star the top trending repo on github" --profile github
```

---

##### `orbiter profile info <name>`

Show details about a specific profile including saved state status.

```bash
orbiter profile info default
orbiter profile info github
```

---

### `orbiter memory`

**Inspect the long-term cross-session memory.** Orbiter learns CSS selectors, error patterns, and site behaviors over time and stores them in PostgreSQL. These persist across sessions and help future runs work faster and more reliably.

```
orbiter memory <subcommand> [options]
```

#### Subcommands

---

##### `orbiter memory stats`

Show database statistics — how many selectors, memories, and entries are stored.

```bash
orbiter memory stats
```

---

##### `orbiter memory list`

List learned CSS selectors for a specific domain.

```bash
orbiter memory list --domain github.com
orbiter memory list --domain booking.com --limit 50
```

| Flag | Default | Description |
|---|---|---|
| `-d, --domain <domain>` | required | The domain to list selectors for |
| `-l, --limit <n>` | `20` | Maximum number of selectors to show |

---

##### `orbiter memory search`

Search for a specific element's learned selector.

```bash
orbiter memory search github.com "login button"
orbiter memory search booking.com "search input"
```

| Argument | Description |
|---|---|
| `<domain>` | Site domain |
| `<query>` | Element name to search for |

---

##### `orbiter memory clear`

Remove stored memories.

```bash
# Clear memories for one domain only
orbiter memory clear --domain github.com

# Clear ALL memories (destructive — asks for confirmation)
orbiter memory clear --all

# Clear all without confirmation prompt
orbiter memory clear --all --yes
```

| Flag | Description |
|---|---|
| `-d, --domain <domain>` | Clear only the specified domain |
| `--all` | Clear everything in the database |
| `--yes` | Skip the confirmation prompt |

---

### `orbiter models`

List available LLM models on OpenRouter.

```bash
orbiter models
```

| Flag | Description |
|---|---|
| `-p, --provider <name>` | Filter by provider (`openrouter`, `openai`, `anthropic`) |

Use the model ID shown here with the `-m` flag in `orbiter run`:

```bash
orbiter models
# Shows: anthropic/claude-sonnet-4, openai/gpt-4o, google/gemini-pro ...

orbiter run "my task" --model openai/gpt-4o
orbiter run "my task" --model google/gemini-pro
```

---

### `orbiter config`

View the active configuration.

```bash
# Print current config as JSON
orbiter config --show

# Create a default config file (coming soon)
orbiter config --init
```

| Flag | Description |
|---|---|
| `-s, --show` | Print the full active configuration |
| `--init` | Generate a default config file |

---

### `orbiter viewer`

**Open the full-featured web dashboard in your browser.** Replaces the old single-page chat viewer with a complete React/Next.js application for managing sessions, monitoring live runs, launching new tasks, and exploring memory.

```
orbiter viewer [options]
```

#### Flags

| Flag | Default | Description |
|---|---|---|
| `-p, --port <number>` | `4040` | Port for the web app |
| `--no-open` | auto-open | Do not auto-open the browser |
| `--production` | dev mode | Serve the pre-built app (`next start`) instead of the dev server |

#### Setup (first time only)

```bash
# Install web app dependencies
cd web && pnpm install

# Return to project root and launch
cd ..
orbiter viewer
```

#### Examples

```bash
# Open dashboard (default port 4040)
orbiter viewer

# Use a different port
orbiter viewer --port 3000

# Launch without opening browser
orbiter viewer --no-open

# Serve optimised production build (faster startup)
orbiter viewer --production
```

The dashboard connects automatically to your PostgreSQL database (via `DATABASE_URL`) and the `data/` directory. It gracefully falls back to JSONL log files if the database is unavailable.

---

## 4. Web Dashboard

The web dashboard is a full-featured Next.js application located in `web/`. Launch it with `orbiter viewer`.

### Pages

| Page | URL | Description |
|---|---|---|
| Dashboard | `/` | Stats overview, recent sessions, quick-launch button |
| Live Monitor | `/live` | Real-time view of the currently running session (auto-polls every 2s) |
| Sessions | `/sessions` | Full searchable/filterable session table |
| Session Detail | `/sessions/:id` | Per-session tabs: Steps · LLM Chat · Extracted Data |
| New Run | `/run` | Web form to launch `orbiter run` and stream output live |
| Flows | `/flows` | Browse `.raw.json` and `.flow.json` files from `data/flows/` |
| Memory | `/memory` | View learned CSS selectors and patterns per domain |

### Session Detail tabs

| Tab | What it shows |
|---|---|
| **Steps** | Timeline of every tool call — tool badge, duration, success/fail indicator, result summary |
| **LLM Chat** | Expandable list of every LLM turn — messages sent, tool calls made, token counts, duration |
| **Data** | All structured data extracted during the session (JSON viewer) |

### Live Monitor

The Live Monitor page polls the database every 2 seconds while a session is `running`. It shows:

- The active session goal and ID
- Elapsed time and step count
- A live progress bar (out of the 50-step max)
- The latest step with its tool and result summary
- Full step history in reverse order

If no session is running, it shows a prompt to start a new run.

### New Run (web form)

The `/run` page provides a browser-based interface to start automation tasks:

1. Enter your prompt in the text area
2. Expand **Options** to choose model, browser profile, headless mode, max steps, and prompt enhancement
3. Click **Launch Run** — the output streams live in the console panel below
4. Links to the Live Monitor and Sessions list appear when the run finishes

> **Note:** Runs launched from the web form always target the same machine running the `orbiter viewer` server. The browser automation happens server-side, not in your browser.

### First-time setup

```bash
# 1. Install web app dependencies (once)
cd web
pnpm install
cd ..

# 2. Launch the dashboard
orbiter viewer
# → opens http://localhost:4040 automatically
```

### Build for production

```bash
cd web
pnpm build
cd ..

# Serve the optimised build
orbiter viewer --production
```

---

## 5. Configuration File

Orbiter looks for a `config.yml` or `config.yaml` in the project root. If not found, it uses built-in defaults.

```yaml
# config.yml

llm:
  provider: openrouter
  model: anthropic/claude-sonnet-4   # model used for all runs
  maxTokens: 4096
  temperature: 0.7
  vision: auto                        # auto | enabled | disabled

browser:
  headless: false                     # show browser by default
  defaultTimeout: 30000               # ms to wait for elements
  viewport:
    width: 1280
    height: 720
  stealth: true                       # hide automation signals

execution:
  maxRetries: 3                       # retry failed steps up to 3x
  screenshotOnError: true             # auto screenshot on failure

recording:
  enabled: true                       # save flows after every run
  outputDir: ./data/flows

output:
  dir: ./data/outputs
  formats:
    - json                            # also supports csv

database:
  url: postgresql://user:pass@host:5432/dbname

logging:
  level: info                         # error | warn | info | debug | trace
```

### Vision modes

| Value | Behavior |
|---|---|
| `auto` | Detects vision support from the model name. Claude and GPT-4o get screenshots; text-only models do not. |
| `enabled` | Always send screenshots as image messages, regardless of model |
| `disabled` | Never send images — text-only mode for all models |

---

## 6. How the AI Brain Works

Understanding the execution loop helps you write better prompts and debug failures.

```
User prompt
    │
    ▼ (if --enhance)
Prompt Enhancer
    → Rewrites vague prompts into precise browser-automation specs
    → Adds starting URL, element names, data fields, edge cases
    │
    ▼
Task Planner
    → LLM analyzes the task
    → Estimates number of steps
    → Decides if Loop Engine is needed
    │
    ▼
Execution Loop (up to --max-steps iterations)
    │
    ├─ LLM decides next action
    │   └─ Sees: system prompt + goal + last 12 step summaries
    │       (full DOM data is in DB, not in conversation)
    │
    ├─ Tool executes in browser
    │   └─ navigate / click / fill / extract_data / …
    │
    ├─ Result stored in PostgreSQL (full JSON)
    │   Summary stored in conversation (50–100 chars)
    │
    ├─ If step failed → Recovery Engine (up to 3 retries)
    │   → Takes screenshot, reads DOM, asks LLM for alternative
    │
    └─ If LLM needs earlier context → Recall tools
        → recall_dom_snapshot(step=3)    — get full DOM from step 3
        → recall_step_history(from=1)    — what happened in steps 1-5
        → recall_session_data()          — all data collected so far
```

### Available browser tools the LLM can use

| Tool | What it does |
|---|---|
| `navigate` | Go to a URL; auto-scans the page after loading |
| `analyze_page` | Scan all interactive elements and their selectors |
| `click` | Click an element by CSS selector |
| `fill` | Fill a form field (fast, no delay) |
| `type` | Type text with human-like keystroke delay |
| `scroll` | Scroll the page up, down, or to an element |
| `hover` | Move mouse over an element |
| `select_dropdown` | Choose from a `<select>` dropdown |
| `wait` | Wait for an element or a fixed time |
| `screenshot` | Take a screenshot (auto-injected as vision message) |
| `extract_text` | Extract text content from an element |
| `extract_data` | Extract structured fields from multiple elements |
| `evaluate_js` | Run JavaScript on the page |
| `detect_repetitive_pattern` | Activate Loop Engine for bulk extraction |
| `probe_selectors` | Validate selectors before bulk extraction |
| `recall_step_history` | Read what happened in earlier steps (from DB) |
| `recall_dom_snapshot` | Read full DOM from an earlier step (from DB) |
| `recall_session_data` | Read all data collected so far (from DB) |

---

## 7. Browser Persistence & Profiles

Orbiter uses **Playwright persistent contexts**, which work exactly like a normal browser profile — cookies, localStorage, IndexedDB, and session tokens are all saved to disk and restored on the next run.

### Default profile

Every run uses the `default` profile unless you specify otherwise:

```
data/browser-profile/   ← default profile directory
```

If you log in to a site during a run, the session is saved here. The next run with the same profile will already be authenticated.

### Named profiles — one per account or site

```bash
# Create profiles for different accounts
orbiter profile create github       -d "Personal GitHub"
orbiter profile create work-google  -d "Work Google account"
orbiter profile create amazon       -d "Shopping account"

# First use: log in during the run
orbiter run "Login to GitHub with my credentials" --profile github

# All future runs: already logged in
orbiter run "Open my GitHub notifications" --profile github
orbiter run "Create a new GitHub issue" --profile github
```

### Profile isolation

Different profiles never share state. Use separate profiles when:
- You have multiple accounts on the same site
- You want a completely fresh browser for testing
- You need to keep work and personal sessions separate

```bash
# Personal GitHub
orbiter run "Check personal repos" --profile github-personal

# Work GitHub (different account, different cookies)
orbiter run "Review work PRs" --profile github-work
```

---

## 8. Flow Recording & Replay

Every `orbiter run` automatically records what it did into a `.raw.json` flow file (unless `--no-record` is passed). This lets you replay the same task later without any LLM cost.

### Workflow

```bash
# Step 1 — Run the task (records a .raw.json)
orbiter run "Extract all job listings from careers.example.com"
# → saves data/flows/extract-all-job-listings-TIMESTAMP.raw.json

# Step 2 — Refine the raw recording into a clean, replayable flow
orbiter refine data/flows/extract-all-job-listings-TIMESTAMP.raw.json
# → saves data/flows/extract-all-job-listings-TIMESTAMP.flow.json

# Step 3 — Replay as many times as needed (zero LLM cost)
orbiter replay data/flows/extract-all-job-listings-TIMESTAMP.flow.json
orbiter replay data/flows/extract-all-job-listings-TIMESTAMP.flow.json
orbiter replay data/flows/extract-all-job-listings-TIMESTAMP.flow.json
```

### Parameterized flows

If your flow uses dynamic values (search terms, URLs, usernames), parameterize it:

```bash
# Replay with a different search term
orbiter replay data/flows/google-search.flow.json \
  --params '{"query": "TypeScript 5.0 features"}'

# Replay with parameters from a file
cat params.json
# { "query": "React best practices", "maxResults": 20 }

orbiter replay data/flows/google-search.flow.json --params-file params.json
```

### Flow file locations

```
data/
└── flows/
    ├── my-task-1748000000000.raw.json     # raw recording
    └── my-task-1748000000000.flow.json    # refined, ready to replay
```

---

## 9. Session Memory & Database

Orbiter stores two kinds of memory in PostgreSQL:

### Session memory (per-run)

Every `orbiter run` creates a session record with:
- Every tool call and its result summary
- Full DOM snapshots from `navigate` and `analyze_page` calls
- All data extracted via `extract_data` and `extract_text`

The LLM **does not** hold large DOM dumps in its conversation. Instead it stores them in the DB and retrieves them on demand via the recall tools. This keeps token usage low even for long 50-step sessions.

```bash
# See all your recent runs
orbiter session list

# See every step of a run
orbiter session show sess_abc123

# Get the data that was extracted
orbiter session data sess_abc123

# Export extracted data as JSON
orbiter session data sess_abc123 --json > results.json
```

### Long-term memory (cross-session)

Over multiple runs on the same site, Orbiter learns:
- Which CSS selectors reliably work for specific elements
- What error patterns occur and how to recover from them
- How pages are structured

This learning persists in the `memories`, `selectors`, and `error_patterns` tables and is reused automatically in future runs.

```bash
orbiter memory stats                        # how much has been learned
orbiter memory list --domain github.com     # what Orbiter knows about GitHub
orbiter memory clear --domain example.com   # forget a specific site
```

---

## 10. Common Workflows

### Scrape a website once

```bash
orbiter run "Extract the top 100 products from shop.example.com including name, price, and URL"
```

### Scrape the same site daily (zero cost after first run)

```bash
# First time — LLM runs, records flow
orbiter run "Extract all job listings from jobs.example.com"

# Refine the recording
orbiter refine data/flows/extract-all-job-listings-*.raw.json

# Every day after — replay with no LLM cost
orbiter replay data/flows/extract-all-job-listings-*.flow.json
```

### Automate a login-required workflow

```bash
# Create a profile for this site
orbiter profile create mysite

# First run: log in (browser window opens, you log in manually or via prompt)
orbiter run "Go to mysite.com and log in with user@example.com" --profile mysite

# All future runs: already logged in
orbiter run "Download my monthly invoice from mysite.com" --profile mysite
orbiter run "Check my account balance on mysite.com" --profile mysite
```

### Debug a failing run

```bash
# Run with full visibility (no headless, verbose output)
orbiter run "my task" --max-steps 10

# After the run, inspect exactly what happened
orbiter session list
orbiter session show sess_abc123
orbiter session show sess_abc123 --full    # see raw JSON per step

# Check what DOM was seen at step 3
# (LLM can use recall_dom_snapshot inside a run; you inspect via session show)
```

### Use a more powerful model for a complex task

```bash
# Claude Opus for hard, multi-step tasks
orbiter run "Research competitors, extract pricing from 5 different websites, and summarize" \
  --model anthropic/claude-opus-4 \
  --max-steps 80 \
  --enhance
```

### Generate a report for stakeholders

```bash
orbiter run "Extract all pricing plans from pricing.example.com" \
  --report --report-format markdown
# → saves data/reports/TIMESTAMP.md
```

---

## 11. Troubleshooting

### "OpenRouter API key not found"

```bash
# Add to .env
echo "OPENROUTER_API_KEY=sk-or-your-key" >> .env
```

### "Cannot connect to database"

Session memory is optional. Orbiter runs fine without a database — you just lose session inspection and long-term memory. To enable it:

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/orbiter
```

### Task fails after a few steps

```bash
# 1. Run without headless so you can see the browser
orbiter run "your task"   # (headless is false by default)

# 2. Increase max steps
orbiter run "your task" --max-steps 80

# 3. Use --enhance to give the LLM a more precise prompt
orbiter run "your vague task" --enhance

# 4. Check what went wrong in the session
orbiter session list
orbiter session show <last-session-id>
```

### Browser opens but nothing happens

The site may have anti-bot detection. Stealth mode is on by default. If it still fails:
- Try running headed (no `--headless`) — some sites block headless detection
- Use a profile that has real browsing history from a previous session

### Replay fails but run succeeded

The raw flow may have captured a flaky step. Refine it first:

```bash
orbiter refine data/flows/my-task.raw.json --interactive
orbiter replay data/flows/my-task.flow.json
```

### Steps are hitting the token limit on long tasks

The smart history manager keeps the last 12 step-pairs in conversation. For very long tasks (50+ steps), increase the model's context window by choosing a model with a larger context:

```bash
orbiter run "very long task" --model google/gemini-pro   # 1M context
orbiter run "very long task" --model anthropic/claude-opus-4
```

---

## Data Directory Layout

```
data/
├── browser-profile/     # default persistent browser session
├── profiles/            # named profiles (orbiter profile create)
│   ├── github/
│   └── work/
├── errors/              # screenshots taken when steps fail
├── flows/               # recorded flows (.raw.json and .flow.json)
├── logs/                # Winston log files
├── outputs/             # extracted data (JSON/CSV)
└── reports/             # execution reports
```

---

*Orbiter v1.0.0 — AI-powered browser automation*
