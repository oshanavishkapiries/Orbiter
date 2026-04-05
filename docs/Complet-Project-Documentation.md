# 🚀 ORBITER - Complete Project Documentation

## Project Overview

**Project Name:** Orbiter

**Description:** An AI-powered browser automation tool that uses Large Language Models (LLMs) as the "brain" to control web browsers like a human. The tool features intelligent pattern detection, flow recording/replay capabilities, and advanced error recovery mechanisms.

**Target Users:** Both technical developers and non-technical users who need to automate repetitive browser tasks.

**Tech Stack:**
- **Runtime:** Node.js 18+ with TypeScript
- **Browser Engine:** Playwright (Chromium)
- **LLM Provider:** OpenRouter (V1), with plug-and-play architecture for OpenAI, Anthropic
- **CLI Framework:** Commander
- **Configuration:** YAML-based with Zod validation
- **Logging:** Winston with professional CLI output (chalk, ora, boxen)
- **Build Tool:** tsup
- **Package Manager:** pnpm

---

## Core Concept & Philosophy

### The Problem We're Solving

Traditional browser automation requires:
1. **Manual element identification** - Developer must inspect and write selectors
2. **Hardcoded flows** - Scripts break when websites change
3. **Token waste with LLMs** - Using LLM for every repetitive action is expensive
4. **Complex error handling** - Difficult to recover from failures

### Our Solution: Three Key Innovations

#### 1. **Loop Engine (Pattern Detection)**
Instead of having LLM process each item in a list individually:
- LLM analyzes page structure ONCE
- Identifies repeating patterns (e.g., product cards, hotel listings)
- Defines extraction schema
- Loop Engine executes extraction WITHOUT further LLM calls
- **Result:** 95%+ cost savings, 10x faster execution

**Example Scenario:**
```
Task: "Extract all hotels from Google Maps search"

Traditional Approach:
- LLM Call 1: "I see Hotel A, let me extract it" → $0.02
- LLM Call 2: "I see Hotel B, let me extract it" → $0.02
- ... x 50 hotels = $1.00, ~3 minutes

Orbiter Approach:
- LLM Call 1: "I detect pattern: .hotel-card with fields..." → $0.02
- Loop Engine: Extracts all 50 hotels → $0.00
- Total: $0.02, ~15 seconds
```

#### 2. **Flow Refiner (Self-Learning)**
Recorded flows contain noise (failed attempts, retries, debug steps):
- **Phase 1:** Rule-based auto-cleanup (remove failed steps, merge actions)
- **Phase 2:** LLM-powered optimization (suggest better selectors, combine steps)
- **Phase 3:** Interactive review (user can manually remove unnecessary steps)
- **Output:** Clean, replayable flow with fallback selector chains

**Example:**
```
Raw Recording (23 steps, includes 8 failed attempts)
    ↓
Auto-Cleanup (15 steps, removed failures)
    ↓
LLM Optimization (12 steps, merged actions, better selectors)
    ↓
Clean Flow (saved as .flow.json, replayable without LLM)
```

#### 3. **Error Context System**
When execution fails:
- **Capture rich context:** URL, page title, DOM summary, visible elements, screenshot
- **Send to LLM:** "Here's what failed, here's what's on the page, suggest recovery"
- **LLM decides:** Try alternative selector / wait longer / navigate elsewhere / abort
- **Record recovery:** Successful recovery becomes fallback in optimized flow

**Example:**
```
Step 5: Click "button[type='submit']" → FAILED (selector not found)
    ↓
Error Context Builder:
- Current URL: checkout.example.com/payment
- Available buttons: ["button#pay-now", "a.complete-order"]
- Screenshot: errors/error-step5-xxx.png
    ↓
LLM Recovery:
"I see button#pay-now on the page. Website changed HTML. Try that."
    ↓
Retry: Click "button#pay-now" → SUCCESS
    ↓
Flow Refiner: Adds both selectors as fallback chain
```

---

## Complete Feature Set

### Version 1 (MVP) Features

#### Core Features
1. **CLI Interface** - Professional, text-only logging (no images in terminal)
2. **Prompt-to-Execution Pipeline** - User provides goal, LLM plans and executes
3. **Browser Profile Support** - Load existing Chrome profiles (cookies, sessions intact)
4. **Stealth Mode** - Anti-detection measures (override navigator.webdriver, etc.)

#### Tool Registry (12 Core Browser Tools)
- `navigate` - Go to URL
- `click` - Click element
- `type` - Type text
- `fill` - Fill form field
- `scroll` - Scroll page
- `hover` - Hover over element
- `select_dropdown` - Select from dropdown
- `screenshot` - Capture screenshot
- `extract_text` - Extract text from element
- `extract_data` - Extract structured data
- `wait` - Wait for condition
- `evaluate_js` - Execute JavaScript

#### Loop Engine
- `detect_repetitive_pattern` - Identify repeating elements
- Pattern-based extraction (no LLM in loop)
- Pagination support (infinite scroll, click-next)
- Detail page drill-down and back navigation
- Human-like delays (randomized 800-1500ms)
- CSV/JSON output

#### Flow Recording & Replay
- Record all steps to `.raw.json` (includes failures, metadata)
- Replay from `.flow.json` (clean, optimized flow)
- Parameterized flows (variables like {{EMAIL}}, {{PASSWORD}})

#### Flow Refiner
- Auto-cleanup (rule-based removal of failed steps)
- LLM-powered optimization
- Interactive CLI review mode
- Fallback selector chains

#### Error Context & Recovery
- Rich error context capture
- LLM-guided recovery suggestions
- Automatic retry with alternative strategies
- Error recording for flow optimization

#### Configuration
- YAML-based config (`orbiter.yaml`)
- Environment variable overrides
- Profile-specific settings
- Per-task configuration

#### Logging & Monitoring
- Professional CLI output (colors, boxes, progress bars)
- Winston-based file logging (JSON format)
- Separate error logs
- Step-by-step execution tracking
- Token usage monitoring
- Performance metrics

### Version 2+ (Future) Features
- Web UI with visual flow builder
- Server deployment mode (API endpoints)
- Task scheduler (cron-based recurring tasks)
- Multi-user support with authentication
- Flow marketplace (share flows)
- Parallel browser sessions
- Multiple LLM provider switching
- Screenshot-based page understanding (vision models)
- Advanced analytics dashboard

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER INPUT LAYER                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────────┐    │
│  │   CLI   │  │ Config   │  │ API (Future V2)     │    │
│  │ Command │  │  Files   │  │                     │    │
│  └────┬────┘  └────┬─────┘  └──────────┬──────────┘    │
│       └─────────────┼──────────────────┘                │
└─────────────────────┼──────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   CORE ENGINE                            │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────┐       │
│  │  Task Planner │◄──│  LLM Provider             │       │
│  │  Orchestrator │   │  (OpenRouter/OpenAI/      │       │
│  └──────┬───────┘    │   Anthropic)              │       │
│         │            └──────────────────────────┘       │
│         ▼                                                │
│  ┌──────────────────────────────────────┐               │
│  │      Execution Router                 │               │
│  │  Decides: Single action? Loop?        │               │
│  │           Replay existing flow?       │               │
│  └──────────┬────────────────────────────┘               │
│             │                                            │
│    ┌────────┼────────┬──────────────┐                   │
│    ▼        ▼        ▼              ▼                   │
│  ┌────┐  ┌────┐  ┌──────┐  ┌──────────────┐            │
│  │LLM │  │Loop│  │Flow  │  │Error Recovery│            │
│  │Step│  │Eng.│  │Replay│  │  Handler     │            │
│  └─┬──┘  └─┬──┘  └──┬───┘  └──────┬───────┘            │
│    └───────┴────────┴─────────────┘                     │
│                     ▼                                    │
│  ┌──────────────────────────────────────┐               │
│  │         TOOL REGISTRY                 │               │
│  │  click | type | navigate | scroll    │               │
│  │  extract | screenshot | wait | ...   │               │
│  └──────────────┬───────────────────────┘               │
│                 ▼                                        │
│  ┌──────────────────────────────────┐                   │
│  │      FLOW RECORDER               │                   │
│  │  Records every step + metadata    │                   │
│  └──────────────┬───────────────────┘                   │
│                 ▼                                        │
│  ┌──────────────────────────────────┐                   │
│  │      FLOW REFINER                │                   │
│  │  Auto-cleanup + LLM optimize     │                   │
│  └──────────────────────────────────┘                   │
└─────────────────────┼───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│                BROWSER LAYER                             │
│  ┌──────────────────────────────────────┐               │
│  │         Playwright                    │               │
│  │  ┌─────────────┐ ┌───────────────┐  │               │
│  │  │  Profile     │ │  Stealth      │  │               │
│  │  │  Manager     │ │  Manager      │  │               │
│  │  └─────────────┘ └───────────────┘  │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## Development Phases

### Phase 0: Project Setup & Foundation ✅ COMPLETED
**Duration:** 1-2 days

**Goals:**
- Initialize Node.js/TypeScript project
- Setup tooling (ESLint, Prettier, tsup)
- Configuration system (YAML + Zod validation)
- Basic CLI skeleton
- Logger utility
- Project structure

**Key Files Created:**
```
orbiter/
├── package.json
├── tsconfig.json
├── config/default.yaml
├── src/
│   ├── index.ts (Entry point with #!/usr/bin/env node)
│   ├── cli/
│   │   ├── index.ts (CLI setup with Commander)
│   │   ├── commands/ (run, replay, refine, config, profile)
│   │   └── ui/ (logger, spinner, progress)
│   ├── config/
│   │   ├── index.ts (Config loader with env override)
│   │   └── schema.ts (Zod validation)
│   └── utils/ (id, fs helpers)
```

**Deliverables:**
- `orbiter --help` works
- Configuration loading works
- Professional logging system
- Build pipeline functional

---

### Phase 1: Core Browser Engine ✅ COMPLETED
**Duration:** 3-4 days

**Goals:**
- Playwright integration
- Browser lifecycle management
- Profile support
- Stealth measures
- Page utilities
- Execution context

**Key Components:**

1. **BrowserManager** (`src/browser/manager.ts`)
   - Launch browser (headless/headful)
   - Load Chrome profiles (persistent context)
   - Navigate, wait, screenshot
   - Close and cleanup

2. **StealthManager** (`src/browser/stealth.ts`)
   - Override `navigator.webdriver`
   - Spoof plugins, languages
   - Add chrome object
   - Randomize canvas fingerprint

3. **ProfileManager** (`src/browser/profile-manager.ts`)
   - List available Chrome profiles
   - Validate profile paths
   - Get profile by name
   - Display profile info

4. **PageUtils** (`src/browser/page-utils.ts`)
   - Element existence checks
   - Get text, attributes
   - Scroll operations
   - Get page dimensions
   - Visible elements summary

5. **ExecutionContext** (`src/core/execution-context.ts`)
   - Manage browser + page lifecycle
   - Track execution state
   - Record step history
   - Store collected data
   - Generate execution summary

**Testing:**
```bash
# Launch browser and navigate
pnpm dev run "test navigation" --headless

# List Chrome profiles
pnpm dev profile --list

# Use custom profile
pnpm dev run "test" --profile "/path/to/profile"
```

**Deliverables:**
- Browser launches successfully
- Can navigate to URLs
- Screenshots work
- Profile loading works
- Stealth measures applied

---

### Phase 2: LLM Integration & Tool Registry
**Duration:** 4-5 days

**Goals:**
- OpenRouter API integration
- Plug-and-play LLM provider architecture
- Function calling / tool use
- 12 core browser tools
- Prompt engineering
- Token tracking

**Key Components:**

1. **LLM Provider Interface** (`src/llm/interfaces.ts`)
```typescript
interface LLMProvider {
  name: string;
  chat(messages: Message[], tools: Tool[]): Promise<LLMResponse>;
  supportsFunctionCalling(): boolean;
}
```

2. **OpenRouterProvider** (`src/llm/openrouter.ts`)
   - API client implementation
   - Chat completion with tools
   - Token counting
   - Error handling
   - Rate limiting

3. **Tool Registry** (`src/tools/registry.ts`)
   - Dynamic tool registration
   - Tool validation
   - Tool execution
   - Result parsing

4. **Individual Tools** (`src/tools/*.ts`)
   - `navigate.ts` - Navigate to URL
   - `click.ts` - Click element
   - `type.ts` - Type text
   - `fill.ts` - Fill form field
   - `scroll.ts` - Scroll page
   - `hover.ts` - Hover element
   - `select.ts` - Select dropdown
   - `screenshot.ts` - Take screenshot
   - `extract-text.ts` - Extract text
   - `extract-data.ts` - Extract structured data
   - `wait.ts` - Wait for condition
   - `evaluate.ts` - Execute JavaScript

5. **Task Planner** (`src/core/planner.ts`)
   - Parse user prompt
   - Generate step plan with LLM
   - Estimate token usage
   - Decide execution strategy

6. **Task Executor** (`src/core/executor.ts`)
   - Execute LLM-planned steps
   - Call appropriate tools
   - Handle tool results
   - Record execution

**Tool Definition Example:**
```typescript
// src/tools/click.ts
export const clickTool = {
  name: "click",
  description: "Click on an element using CSS selector or text",
  parameters: {
    type: "object",
    properties: {
      selector: {
        type: "string",
        description: "CSS selector of element to click"
      },
      waitAfter: {
        type: "number",
        description: "Milliseconds to wait after click"
      }
    },
    required: ["selector"]
  },
  execute: async (params, context) => {
    const page = context.getBrowserManager().getPage();
    await page.click(params.selector);
    if (params.waitAfter) {
      await page.waitForTimeout(params.waitAfter);
    }
    return { success: true };
  }
};
```

**Prompt Engineering:**
```typescript
// src/llm/prompts/system.ts
export const SYSTEM_PROMPT = `
You are a browser automation expert. Your job is to help users 
accomplish tasks on websites by controlling a web browser.

You have access to browser control tools. Use them to:
1. Navigate to websites
2. Fill forms
3. Click buttons
4. Extract information
5. Handle dynamic content

IMPORTANT RULES:
- Always wait for elements to be visible before interacting
- Use specific CSS selectors (prefer IDs, data attributes)
- Take screenshots when debugging
- If a selector fails, try alternative selectors
- Detect repeating patterns and use Loop Engine for efficiency

Available tools: ${tools.map(t => t.name).join(', ')}
`;
```

**Deliverables:**
- LLM can plan multi-step tasks
- All 12 tools working
- `orbiter run "Navigate to example.com and click login"` works
- Token usage tracked and displayed

---

### Phase 3: Flow Recorder & Basic Replay
**Duration:** 3-4 days

**Goals:**
- Record all execution steps
- Save as JSON flow files
- Basic replay without LLM
- Parameterization support

**Key Components:**

1. **FlowRecorder** (`src/recorder/recorder.ts`)
   - Record each step with metadata
   - Capture selectors, actions, results
   - Save failed attempts
   - Generate flow ID
   - Export to `.raw.json`

2. **FlowReplayer** (`src/recorder/replayer.ts`)
   - Load flow from JSON
   - Execute steps sequentially
   - Parameter substitution
   - Error handling
   - Progress tracking

3. **Flow Schema** (`src/recorder/schema.ts`)
```typescript
interface Flow {
  id: string;
  name: string;
  version: number;
  createdAt: number;
  parameters: string[];
  steps: FlowStep[];
  metadata: {
    originalPrompt: string;
    llmModel: string;
    totalTokens: number;
    duration: number;
  };
}

interface FlowStep {
  id: number;
  action: string;
  tool: string;
  params: Record<string, any>;
  selector?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  timestamp: number;
  duration: number;
  screenshot?: string;
  metadata?: {
    wasRetry: boolean;
    retryOf?: number;
    llmReasoning?: string;
  };
}
```

**Flow File Example:**
```json
{
  "id": "flow_abc123",
  "name": "Login to Example Site",
  "version": 1,
  "createdAt": 1705315425000,
  "parameters": ["EMAIL", "PASSWORD"],
  "steps": [
    {
      "id": 1,
      "action": "navigate",
      "tool": "navigate",
      "params": { "url": "https://example.com/login" },
      "status": "success",
      "timestamp": 1705315425100,
      "duration": 1234
    },
    {
      "id": 2,
      "action": "fill",
      "tool": "fill",
      "params": {
        "selector": "input[name='email']",
        "value": "{{EMAIL}}"
      },
      "status": "success",
      "timestamp": 1705315426334,
      "duration": 456
    }
  ]
}
```

**Replay Command:**
```bash
# Replay with parameters
orbiter replay flows/login.flow.json \
  --params '{"EMAIL":"user@example.com","PASSWORD":"secret"}'

# Or from file
orbiter replay flows/login.flow.json \
  --params-file params.json
```

**Deliverables:**
- All executions automatically recorded
- Flows saved to `./flows/` directory
- `orbiter replay <flow>` works
- Parameters can be substituted
- Replay progress shown in CLI

---

### Phase 4: Loop Engine (KEY DIFFERENTIATOR)
**Duration:** 5-6 days

**Goals:**
- Pattern detection system
- Repetitive extraction without LLM
- Pagination handling
- Detail page navigation
- Human-like delays

**Key Components:**

1. **Pattern Detector** (`src/loop-engine/detector.ts`)
   - Analyze page DOM
   - Identify repeating structures
   - Extract schema from first item
   - Validate pattern consistency

2. **Loop Executor** (`src/loop-engine/executor.ts`)
   - Execute pattern-based extraction
   - Handle pagination (scroll/click-next)
   - Navigate to detail pages
   - Return to list view
   - Apply random delays

3. **Pagination Handlers** (`src/loop-engine/pagination/`)
   - `infinite-scroll.ts` - Scroll to load more
   - `click-next.ts` - Click next page button
   - `url-based.ts` - Change URL parameters

4. **Loop Tool** (`src/tools/detect-pattern.ts`)
```typescript
export const detectPatternTool = {
  name: "detect_repetitive_pattern",
  description: `
    When you identify a page with REPEATING elements 
    (list of products, hotels, search results, etc.),
    use this tool to define the pattern ONCE.
    The Loop Engine will then extract all items WITHOUT 
    further LLM calls, saving time and cost.
  `,
  parameters: {
    type: "object",
    properties: {
      containerSelector: {
        type: "string",
        description: "CSS selector for container"
      },
      itemSelector: {
        type: "string",
        description: "CSS selector for each item"
      },
      extractSchema: {
        type: "object",
        description: "Fields to extract from each item"
      },
      pagination: {
        type: "object",
        properties: {
          type: { enum: ["scroll", "click-next", "url"] },
          nextSelector: { type: "string" },
          maxPages: { type: "number" }
        }
      },
      detailAction: {
        type: "object",
        description: "If need to click into detail page"
      }
    }
  }
};
```

**Example LLM Response:**
```json
{
  "tool": "detect_repetitive_pattern",
  "params": {
    "containerSelector": "div[role='feed']",
    "itemSelector": "div[role='article']",
    "extractSchema": {
      "name": ".fontHeadlineSmall",
      "rating": ".MW4etd",
      "reviews": ".UY7F9",
      "category": ".W4Efsd:nth-child(1)",
      "address": ".W4Efsd:nth-child(2)"
    },
    "pagination": {
      "type": "scroll",
      "container": ".m6QErb",
      "maxPages": 5
    },
    "detailAction": null
  }
}
```

**Loop Execution Flow:**
```
1. LLM detects pattern → Returns schema
2. Loop Engine validates pattern on first item
3. For each page:
   4. Get all items on current page
   5. For each item:
      6. Extract data using schema
      7. If detailAction: click → extract → back
      8. Random delay (800-1500ms)
   9. If pagination: scroll/click next → wait → repeat
10. Return all extracted data
11. Save to CSV/JSON
```

**Deliverables:**
- `detect_repetitive_pattern` tool works
- Loop Engine can extract 100+ items
- Pagination (scroll & click-next) works
- Detail page navigation works
- Data exported to CSV/JSON
- Performance: 95%+ cost savings vs per-item LLM calls

---

### Phase 5: Error Context & Recovery System
**Duration:** 4-5 days

**Goals:**
- Rich error context capture
- LLM-guided error recovery
- Automatic retry strategies
- Error recording in flows

**Key Components:**

1. **ErrorContextManager** (`src/core/error-context.ts`)
```typescript
class ErrorContextManager {
  async buildContext(
    error: Error,
    step: ExecutionStep,
    page: Page,
    history: ExecutionHistory
  ): Promise<ErrorContext> {
    return {
      errorId: generateErrorId(),
      timestamp: Date.now(),
      
      // What failed
      error: {
        type: this.categorizeError(error),
        message: error.message,
        stack: error.stack
      },
      
      // Where we are
      currentStep: step.id,
      stepName: step.name,
      toolUsed: step.tool,
      
      // Browser state
      browserState: {
        url: page.url(),
        title: await page.title(),
        domSummary: await this.analyzeDom(page),
        screenshotPath: await this.captureScreenshot(page),
        networkStatus: await this.checkNetwork(page)
      },
      
      // Execution context
      executionContext: {
        originalGoal: history.originalGoal,
        currentObjective: step.objective,
        collectedData: history.collectedData,
        previousSteps: history.getLastN(3)
      },
      
      recoveryAttempts: []
    };
  }
}
```

2. **ErrorRecoveryHandler** (`src/core/error-recovery.ts`)
   - Send error context to LLM
   - Parse recovery suggestions
   - Execute recovery action
   - Record recovery attempt
   - Retry or escalate

3. **DOM Analyzer** (`src/browser/dom-analyzer.ts`)
   - Extract visible elements (top 50)
   - Identify clickable elements
   - Find input fields
   - Generate simple selectors
   - Return structured summary

4. **Recovery Strategies:**
   - `try_alternative_selector` - LLM suggests different selector
   - `wait_longer` - Increase timeout and retry
   - `refresh_page` - Reload and retry from earlier step
   - `navigate_alternative` - Try different URL/path
   - `abort_with_partial` - Stop but return partial results
   - `ask_user` - Pause and prompt for manual intervention

**Error Recovery Flow:**
```
Step 5: Click "button[type='submit']" → ERROR (timeout)
    ↓
ErrorContextManager.buildContext()
    ↓
{
  error: "Selector not found",
  url: "checkout.example.com",
  visibleElements: ["button#pay-now", "a.complete-order"],
  screenshot: "errors/error-step5-xxx.png",
  previousSteps: [navigate, fill_form, select_option]
}
    ↓
Send to LLM with prompt:
"An error occurred. Analyze context and suggest recovery."
    ↓
LLM Response:
{
  strategy: "try_alternative_selector",
  reasoning: "Site changed HTML. I see button#pay-now",
  action: {
    tool: "click",
    selector: "button#pay-now"
  },
  confidence: "high"
}
    ↓
Execute recovery action → SUCCESS
    ↓
Record in flow:
{
  step: 5,
  originalSelector: "button[type='submit']",
  status: "failed",
  recovery: {
    attempt: 1,
    strategy: "llm_alternative_selector",
    newSelector: "button#pay-now",
    result: "success"
  }
}
```

**CLI Output Example:**
```
[5/8] CLICK
  → Tool: click
  → Selector: button[type="submit"]
  
  ❌ ERROR: Selector not found
  
  ┌─────────────────────────────────────────────┐
  │ 🔍 ERROR ANALYSIS                            │
  ├─────────────────────────────────────────────┤
  │ Type:     selector_not_found                │
  │ Current:  checkout.example.com/payment      │
  │ Elements: 127 visible                       │
  │                                             │
  │ Screenshot: errors/error-step5-xxx.png      │
  └─────────────────────────────────────────────┘
  
  🤖 LLM analyzing error context...
  
  ┌─────────────────────────────────────────────┐
  │ 💡 RECOVERY SUGGESTION                      │
  ├─────────────────────────────────────────────┤
  │ "Found alternative: button#pay-now"         │
  │ Confidence: High                            │
  └─────────────────────────────────────────────┘
  
  🔁 Retrying with new selector...
  
[5-R1/8] CLICK (Recovery Attempt 1)
  ✓ Completed in 0.3s
```

**Deliverables:**
- All errors captured with rich context
- LLM provides recovery suggestions
- Automatic retry with alternatives
- Errors recorded in flow files
- Recovery success rate tracked
- Screenshots saved for all errors

---

### Phase 6: Flow Refiner & Optimizer
**Duration:** 3-4 days

**Goals:**
- Clean up recorded flows
- Remove failed attempts
- LLM-powered optimization
- Interactive review mode
- Generate production-ready flows

**Key Components:**

1. **FlowRefiner** (`src/recorder/flow-refiner.ts`)

**Phase 1 - Rule-Based Auto-Cleanup:**
```typescript
class FlowRefiner {
  autoClean(rawSteps: RawStep[]): RawStep[] {
    let steps = [...rawSteps];
    
    // Remove failed attempts (keep successful retries)
    steps = this.removeFailedAttempts(steps);
    
    // Remove debug screenshots
    steps = steps.filter(s => 
      !(s.action === 'screenshot' && s.metadata?.debug)
    );
    
    // Merge consecutive type actions
    steps = this.mergeConsecutiveTypes(steps);
    
    // Remove redundant waits
    steps = this.optimizeWaits(steps);
    
    // Remove duplicate navigations
    steps = this.removeDuplicateNavigations(steps);
    
    return steps;
  }
}
```

**Phase 2 - LLM Optimization:**
```typescript
async llmOptimize(steps: RawStep[]): Promise<OptimizedFlow> {
  const prompt = `
    You are a browser automation flow optimizer.
    
    Raw flow (${steps.length} steps):
    ${JSON.stringify(steps, null, 2)}
    
    Please:
    1. Remove unnecessary steps
    2. Combine steps that can be merged
    3. Suggest more stable CSS selectors
    4. Add appropriate waits where needed
    5. Create fallback selector chains from errors
    
    Return optimized flow as JSON.
  `;
  
  const response = await llm.chat([
    { role: 'system', content: 'Flow optimizer' },
    { role: 'user', content: prompt }
  ]);
  
  return this.parseOptimizedFlow(response);
}
```

**Phase 3 - Interactive Review:**
```typescript
async interactiveRefine(steps: RawStep[]): Promise<RawStep[]> {
  console.log('\n📋 FLOW REVIEW MODE');
  
  for (const step of steps) {
    console.log(`\nStep ${step.id}: ${step.action}`);
    console.log(`  Selector: ${step.selector}`);
    console.log(`  Status: ${step.status}`);
    
    const action = await prompt(
      '[K]eep / [R]emove / [E]dit / [S]kip: '
    );
    
    if (action === 'r') {
      // Remove step
    } else if (action === 'e') {
      // Edit step (change selector, params)
    }
  }
  
  return steps;
}
```

2. **Selector Optimizer** (`src/recorder/selector-optimizer.ts`)
   - Analyze failed selectors
   - Suggest more stable alternatives
   - Create fallback chains
   - Prefer: data-testid > id > class > complex CSS

**Refine Command:**
```bash
# Auto-cleanup only
orbiter refine flows/google-maps-hotels.raw.json

# With LLM optimization
orbiter refine flows/google-maps-hotels.raw.json

# Interactive mode
orbiter refine flows/google-maps-hotels.raw.json -i

# Custom output
orbiter refine flows/google-maps-hotels.raw.json \
  -o flows/optimized/hotels.flow.json
```

**CLI Output:**
```
$ orbiter refine flows/google-maps-hotels.raw.json

📋 FLOW REFINEMENT
═══════════════════════════════════════════════════

📊 Raw flow: 23 steps
🔧 After auto-cleanup: 15 steps (removed 8)

Removed automatically:
  ❌ Step 4:  click .wrong-btn (failed)
  ❌ Step 5:  screenshot (debug)
  ❌ Step 9:  wait 5000ms (redundant)
  ❌ Step 12: navigate (duplicate)
  ...

🤖 Run LLM optimization? [Y/n]: Y

🤖 LLM analyzing flow...

💡 LLM Suggestions:
  • Step 3: Merge "click" + "type" → "fill"
  • Step 7: Selector ".Nv2PK" fragile 
           → suggest "[data-value='Hotels']"
  • Step 11: Add waitForSelector after scroll

Apply suggestions? [Y/n]: Y

✅ Optimized flow: 12 steps
💾 Saved: flows/google-maps-hotels.flow.json

Performance:
  Steps reduced: 23 → 12 (48% reduction)
  Estimated replay time: 58s → 28s
```

**Optimized Flow Output:**
```json
{
  "id": "flow_optimized_abc",
  "name": "Google Maps Hotels Extraction",
  "version": 1,
  "steps": [
    {
      "id": 1,
      "action": "navigate",
      "params": { "url": "https://maps.google.com" }
    },
    {
      "id": 2,
      "action": "fill",
      "params": {
        "selector": "input#searchboxinput",
        "value": "{{SEARCH_QUERY}}"
      }
    },
    {
      "id": 3,
      "action": "click",
      "selectors": [
        "[data-value='Hotels']",
        ".Nv2PK",
        "text=Hotels"
      ],
      "strategy": "try_all_until_success"
    },
    {
      "id": 4,
      "action": "detect_repetitive_pattern",
      "params": {
        "itemSelector": "[role='article']",
        "extractSchema": { ... }
      }
    }
  ]
}
```

**Deliverables:**
- `orbiter refine` command works
- Auto-cleanup removes 30-50% of noise
- LLM optimization improves selectors
- Interactive mode allows manual review
- Fallback selector chains created
- Optimized flows significantly faster to replay

---

### Phase 7: Professional CLI & Logging
**Duration:** 2-3 days

**Goals:**
- Polish CLI experience
- Professional output formatting
- Real-time progress updates
- Execution summaries
- Export capabilities

**Key Components:**

1. **Enhanced Logger** (`src/cli/ui/logger.ts`)
   - Color-coded log levels
   - Step progress indicators
   - Token usage display
   - Performance metrics
   - Box drawing for sections

2. **Progress Indicators:**
   - Spinner for initialization
   - Progress bar for loops
   - Step counter (5/12)
   - Real-time status updates

3. **Execution Summary:**
```
✅ TASK COMPLETED

  Results:
  ┌─────────────────────────────────────────────┐
  │ Total items extracted: 51                   │
  │ Success rate: 100%                          │
  │ Output: hotels-colombo.json                 │
  │ Screenshots: 3 saved                        │
  └─────────────────────────────────────────────┘

  Performance:
  ┌─────────────────────────────────────────────┐
  │ Total time: 58.4s                           │
  │ LLM calls: 2                                │
  │ Tokens: 1,247 in / 312 out                  │
  │ Estimated cost: $0.04                       │
  │                                             │
  │ vs. Traditional approach:                   │
  │   Would have cost: $1.20                    │
  │   Cost saved: 96.7% 💰                      │
  └─────────────────────────────────────────────┘
```

4. **Export Formats:**
   - JSON (structured data)
   - CSV (tabular data)
   - Markdown (execution report)
   - Text logs (debugging)

**Deliverables:**
- Beautiful, professional CLI output
- No images in terminal (text only)
- Real-time progress updates
- Comprehensive execution summaries
- Multiple export formats
- Log files for debugging

---

### Phase 8: Testing & Documentation
**Duration:** 3-4 days

**Goals:**
- Unit tests for core components
- Integration tests
- Example flows
- User documentation
- API documentation

**Key Components:**

1. **Unit Tests** (Vitest)
   - Config loader
   - Tool registry
   - Flow recorder/replayer
   - Pattern detector
   - Error context builder

2. **Integration Tests:**
   - End-to-end flow execution
   - Profile loading
   - LLM integration
   - Loop engine on real sites

3. **Example Flows:**
   - `flows/examples/login-example.flow.json`
   - `flows/examples/google-maps-extract.flow.json`
   - `flows/examples/form-filling.flow.json`

4. **Documentation:**

**README.md:**
```markdown
# 🚀 Orbiter

AI-powered browser automation with LLM brain.

## Features
- 🤖 LLM-guided browser control
- 🔄 Pattern-based extraction (Loop Engine)
- 📝 Flow recording & replay
- 🧹 Intelligent flow optimization
- 🔴 Advanced error recovery
- 💰 95%+ cost savings vs traditional LLM automation

## Quick Start
```bash
# Install
npm install -g orbiter

# Configure
orbiter config --init

# Run task
orbiter run "Extract hotels from Google Maps in Tokyo"

# Replay flow
orbiter replay flows/hotels.flow.json \
  --params '{"CITY":"Paris"}'
```

## Documentation
- [Installation](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Creating Flows](docs/flows.md)
- [Loop Engine](docs/loop-engine.md)
- [Error Recovery](docs/error-recovery.md)
- [API Reference](docs/api.md)
```

**Deliverables:**
- 80%+ test coverage
- Example flows work
- Complete user documentation
- API documentation
- Contribution guidelines

---

## Project Structure (Complete)

```
orbiter/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── .gitignore
│
├── config/
│   └── default.yaml
│
├── src/
│   ├── index.ts
│   │
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── run.ts
│   │   │   ├── replay.ts
│   │   │   ├── refine.ts
│   │   │   ├── config.ts
│   │   │   └── profile.ts
│   │   └── ui/
│   │       ├── logger.ts
│   │       ├── spinner.ts
│   │       └── progress.ts
│   │
│   ├── config/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── defaults.ts
│   │
│   ├── core/
│   │   ├── execution-context.ts
│   │   ├── planner.ts
│   │   ├── executor.ts
│   │   ├── error-context.ts
│   │   └── error-recovery.ts
│   │
│   ├── browser/
│   │   ├── manager.ts
│   │   ├── stealth.ts
│   │   ├── profile-manager.ts
│   │   ├── page-utils.ts
│   │   └── dom-analyzer.ts
│   │
│   ├── llm/
│   │   ├── interfaces.ts
│   │   ├── openrouter.ts
│   │   ├── openai.ts (future)
│   │   ├── anthropic.ts (future)
│   │   └── prompts/
│   │       ├── system.ts
│   │       └── templates.ts
│   │
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── navigate.ts
│   │   ├── click.ts
│   │   ├── type.ts
│   │   ├── fill.ts
│   │   ├── scroll.ts
│   │   ├── hover.ts
│   │   ├── select.ts
│   │   ├── screenshot.ts
│   │   ├── extract-text.ts
│   │   ├── extract-data.ts
│   │   ├── wait.ts
│   │   ├── evaluate.ts
│   │   └── detect-pattern.ts
│   │
│   ├── loop-engine/
│   │   ├── detector.ts
│   │   ├── executor.ts
│   │   ├── pagination/
│   │   │   ├── infinite-scroll.ts
│   │   │   ├── click-next.ts
│   │   │   └── url-based.ts
│   │   └── types.ts
│   │
│   ├── recorder/
│   │   ├── recorder.ts
│   │   ├── replayer.ts
│   │   ├── flow-refiner.ts
│   │   ├── selector-optimizer.ts
│   │   └── schema.ts
│   │
│   └── utils/
│       ├── index.ts
│       ├── id.ts
│       └── fs.ts
│
├── flows/
│   ├── examples/
│   │   ├── login.flow.json
│   │   ├── google-maps.flow.json
│   │   └── form-filling.flow.json
│   └── .gitkeep
│
├── output/
│   └── .gitkeep
│
├── logs/
│   └── .gitkeep
│
├── errors/
│   └── .gitkeep
│
├── tests/
│   ├── setup.ts
│   ├── unit/
│   │   ├── config.test.ts
│   │   ├── tools.test.ts
│   │   └── flow-refiner.test.ts
│   └── integration/
│       ├── browser.test.ts
│       └── execution.test.ts
│
└── docs/
    ├── installation.md
    ├── configuration.md
    ├── flows.md
    ├── loop-engine.md
    ├── error-recovery.md
    └── api.md
```

---

## Configuration Reference

### config/default.yaml

```yaml
version: 1

# LLM Settings
llm:
  provider: openrouter              # openrouter | openai | anthropic
  model: anthropic/claude-sonnet-4  # Model identifier
  maxTokens: 4096
  temperature: 0.7

# Browser Settings
browser:
  headless: false                   # Run browser in background
  defaultTimeout: 30000             # Default wait timeout (ms)
  viewport:
    width: 1280
    height: 720
  profilePath: null                 # Path to Chrome profile
  stealth: true                     # Apply anti-detection

# Execution Settings
execution:
  maxRetries: 3                     # Max retry attempts
  retryDelay: 1000                  # Delay between retries (ms)
  screenshotOnError: true           # Capture screenshot on error
  screenshotOnStep: false           # Capture screenshot per step

# Loop Engine Settings
loop:
  defaultDelay:
    min: 800                        # Min delay between items (ms)
    max: 1500                       # Max delay between items (ms)
  maxItems: 100                     # Max items to extract
  scrollPauseTime: 1000             # Wait after scroll (ms)

# Recording Settings
recording:
  enabled: true                     # Auto-record flows
  outputDir: ./flows                # Save location
  includeScreenshots: false         # Embed screenshots in flow

# Output Settings  
output:
  dir: ./output                     # Output directory
  formats:
    - json
    - csv

# Logging Settings
logging:
  level: info                       # error|warn|info|debug|trace
  file:
    enabled: true
    path: ./logs
    maxSize: 10mb
    maxFiles: 10
  console:
    enabled: true
    colorize: true
```

---

## Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Optional Overrides
DEFAULT_MODEL=anthropic/claude-sonnet-4
BROWSER_HEADLESS=false
CHROME_PROFILE_PATH=/path/to/profile
LOG_LEVEL=info

# For other providers (V2)
OPENAI_API_KEY=sk-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

---

## CLI Command Reference

### Main Commands

```bash
# Run a task with LLM
orbiter run <prompt> [options]

  Options:
    -m, --model <model>       LLM model to use
    -p, --profile <path>      Browser profile path
    --headless                Run in headless mode
    --no-record               Disable flow recording
    --max-steps <number>      Maximum steps (default: 50)

  Examples:
    orbiter run "Login to example.com"
    orbiter run "Extract hotels in Paris" --headless
    orbiter run "Fill form" --profile ~/chrome-profile


# Replay a saved flow
orbiter replay <flow> [options]

  Options:
    --params <json>           Parameters as JSON string
    --params-file <path>      Parameters from file
    --headless                Run in headless mode

  Examples:
    orbiter replay flows/login.flow.json
    orbiter replay flows/extract.flow.json \
      --params '{"CITY":"Tokyo"}'
    orbiter replay flows/form.flow.json \
      --params-file params.json


# Refine a recorded flow
orbiter refine <flow> [options]

  Options:
    --no-llm                  Skip LLM optimization
    -i, --interactive         Interactive review mode
    -o, --output <path>       Output path

  Examples:
    orbiter refine flows/raw-flow.raw.json
    orbiter refine flows/raw-flow.raw.json -i
    orbiter refine flows/raw-flow.raw.json \
      -o flows/optimized/clean.flow.json


# Manage browser profiles
orbiter profile [options]

  Options:
    -l, --list                List available profiles
    -v, --validate <path>     Validate profile path

  Examples:
    orbiter profile --list
    orbiter profile --validate ~/Library/.../Chrome


# Configuration management
orbiter config [options]

  Options:
    -s, --show                Show current config
    --init                    Create default config file

  Examples:
    orbiter config --show
    orbiter config --init
```

---

## Development Timeline

**Total Estimated Time: 28-37 days (solo developer, full-time)**

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 0: Setup | 1-2 days | ✅ Complete |
| Phase 1: Browser Engine | 3-4 days | ✅ Complete |
| Phase 2: LLM Integration | 4-5 days | 🔜 Next |
| Phase 3: Flow Recording | 3-4 days | ⏳ Pending |
| Phase 4: Loop Engine | 5-6 days | ⏳ Pending |
| Phase 5: Error Recovery | 4-5 days | ⏳ Pending |
| Phase 6: Flow Refiner | 3-4 days | ⏳ Pending |
| Phase 7: Polish CLI | 2-3 days | ⏳ Pending |
| Phase 8: Testing & Docs | 3-4 days | ⏳ Pending |

**Adjusted for part-time (4 hours/day): ~2-3 months**

---

## Key Design Decisions & Rationale

### 1. Why OpenRouter for V1?
- Single API for multiple models (Claude, GPT-4, Llama)
- Easy switching without code changes
- Cost-effective for testing
- V2 will add direct provider support

### 2. Why Playwright over Puppeteer?
- Better stealth capabilities
- Native support for persistent contexts (Chrome profiles)
- Cross-browser support (future-proof)
- Better documentation
- More active development

### 3. Why TypeScript?
- Type safety critical for complex orchestration
- Better IDE support
- Easier refactoring
- Self-documenting code
- Catches errors at compile time

### 4. Why YAML for config?
- More readable than JSON
- Supports comments
- Popular in DevOps tools
- Easy for non-developers

### 5. Why Pattern Detection (Loop Engine)?
- **95%+ cost savings** - LLM calls are expensive
- **10x faster** - No network latency per item
- **More reliable** - Deterministic extraction
- **Key differentiator** - Most tools don't have this

### 6. Why Flow Recording?
- **Reusability** - Run same task with different params
- **No LLM needed for replay** - Zero cost, instant
- **Debugging** - Review what happened
- **Optimization** - Learn from errors

### 7. Why Error Context System?
- **Better recovery** - LLM makes informed decisions
- **Learning** - Failed attempts improve future flows
- **Debugging** - Screenshots + context help diagnose
- **Robustness** - Graceful handling vs crashing

---

## Performance Benchmarks (Projected)

### Traditional LLM-Per-Action Approach
```
Task: Extract 50 hotels from Google Maps

- LLM calls: ~52 (navigate, search, 50x extract)
- Tokens: ~65,000
- Cost: ~$1.20
- Time: ~4 minutes
- Reliability: ~70% (selectors may fail)
```

### Orbiter with Loop Engine
```
Task: Extract 50 hotels from Google Maps

- LLM calls: 2 (plan, detect pattern)
- Tokens: ~1,500
- Cost: ~$0.04
- Time: ~25 seconds
- Reliability: ~95% (pattern-based)

Savings: 96.7% cost, 90% time
```

### Flow Replay (No LLM)
```
Task: Extract 50 hotels (using saved flow)

- LLM calls: 0
- Tokens: 0
- Cost: $0.00
- Time: ~15 seconds
- Reliability: ~98% (optimized selectors)

Savings: 100% cost vs traditional
```

---

## Common Use Cases

### 1. Data Extraction
```bash
orbiter run "Extract all products from this e-commerce site" \
  --headless
```
- Loop Engine detects product cards
- Extracts name, price, image, URL
- Handles pagination automatically
- Outputs to CSV/JSON

### 2. Form Automation
```bash
orbiter run "Fill out contact form with my details"
```
- LLM identifies form fields
- Maps fields to data
- Handles dropdowns, checkboxes
- Submits form
- Records flow for future use

### 3. Testing Workflows
```bash
orbiter replay flows/checkout-test.flow.json \
  --params-file test-data.json
```
- Replay saved checkout flow
- Use different test data each run
- Screenshot on each step
- Verify success

### 4. Monitoring Tasks
```bash
# Cron job (future V2)
0 9 * * * orbiter replay flows/check-stock.flow.json
```
- Check website for changes
- Extract specific data
- Compare with previous run
- Send alert if different

### 5. Account Management
```bash
orbiter run "Login to all my accounts and check notifications"
```
- Loop through account list
- Login to each (using profiles)
- Extract notifications
- Aggregate results

---

## Troubleshooting Guide

### Browser won't launch
```
Error: Failed to launch browser

Solutions:
1. Check Playwright installation:
   pnpm exec playwright install chromium

2. Check permissions (Linux):
   sudo apt-get install libnss3 libatk-bridge2.0-0 libxcomposite1

3. Try headless mode:
   orbiter run "task" --headless
```

### Selector not found
```
Error: Timeout waiting for selector

Solutions:
1. Increase timeout in config:
   browser.defaultTimeout: 60000

2. Let LLM recover:
   (automatic with error recovery system)

3. Check network speed:
   Slow connections need longer waits

4. Use interactive mode to inspect:
   Take screenshot and review
```

### LLM API errors
```
Error: OpenRouter API key invalid

Solutions:
1. Check .env file:
   OPENROUTER_API_KEY=sk-or-v1-xxxxx

2. Verify key at openrouter.ai

3. Check rate limits:
   Wait and retry

4. Check credits/billing
```

### Profile won't load
```
Error: Invalid profile path

Solutions:
1. List available profiles:
   orbiter profile --list

2. Validate path:
   orbiter profile --validate /path/to/profile

3. Use absolute path

4. Ensure Chrome is closed
   (can't use profile while Chrome is running)
```

---

## API Integration (Future V2)

```typescript
// Server mode (future)
import { OrbiterServer } from 'orbiter/server';

const server = new OrbiterServer({
  port: 3000,
  auth: { apiKey: 'secret' }
});

// REST endpoints
POST /api/tasks
  Body: { prompt: "Extract data", params: {...} }
  
GET /api/tasks/:id
  Returns: { status, progress, result }

POST /api/flows/:id/replay
  Body: { params: {...} }

GET /api/flows
  Returns: List of saved flows
```

---

## Contributing Guidelines (Future)

```markdown
# Contributing to Orbiter

## Development Setup
1. Fork repository
2. Clone: `git clone https://github.com/you/orbiter`
3. Install: `pnpm install`
4. Run tests: `pnpm test`

## Adding a New Tool
1. Create file: `src/tools/my-tool.ts`
2. Implement interface:
   ```typescript
   export const myTool = {
     name: "my_tool",
     description: "...",
     parameters: {...},
     execute: async (params, context) => {...}
   };
   ```
3. Register in `src/tools/registry.ts`
4. Add tests: `tests/unit/my-tool.test.ts`
5. Update docs: `docs/tools.md`

## Code Style
- Use Prettier (auto-format)
- Follow ESLint rules
- Add JSDoc comments
- Write tests for new features

## Pull Request Process
1. Create feature branch
2. Make changes
3. Add tests
4. Update docs
5. Submit PR with description
```

---

## License & Credits

```
MIT License

Copyright (c) 2024 Orbiter

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

---

## Next Steps for Development

### Immediate (Phase 2):
1. Implement OpenRouter client
2. Create LLM provider interface
3. Build tool registry
4. Implement 12 core tools
5. Create task planner
6. Build task executor
7. Test end-to-end execution

### Questions to Answer:
- Which LLM model for V1? (Claude Sonnet 4 recommended)
- Tool naming convention? (snake_case vs camelCase)
- How to handle tool failures? (retry, skip, ask user)
- Max steps per execution? (50 default)
- Token budget limits? (configurable)

---

## Resources & References

### Documentation Links:
- Playwright: https://playwright.dev/
- OpenRouter: https://openrouter.ai/docs
- Commander: https://github.com/tj/commander.js
- Winston: https://github.com/winstonjs/winston
- Zod: https://zod.dev/

### Similar Projects (for inspiration):
- Browser Use: LLM browser automation
- LaVague: Web navigation with LLM
- Agent-E: AI web agent
- Playwright with GPT: Various examples

### Our Differentiators:
1. ✅ Loop Engine (pattern detection)
2. ✅ Flow Refiner (self-learning)
3. ✅ Error Context System (smart recovery)
4. ✅ Professional CLI (production-ready)
5. ✅ Chrome Profile Support (real cookies/sessions)

---

## Save This Document

**This document contains:**
- ✅ Complete project vision
- ✅ All 8 development phases
- ✅ Architecture details
- ✅ Code examples
- ✅ Implementation guidelines
- ✅ Configuration reference
- ✅ Troubleshooting guide
- ✅ Performance benchmarks

**Use this to:**
- Continue development in new AI sessions
- Onboard collaborators
- Remember design decisions
- Track progress
- Generate documentation

**File name suggestion:** `ORBITER_MASTER_PLAN.md`

---

**Current Status:** Phase 1 Complete ✅  
**Next Phase:** Phase 2 - LLM Integration & Tool Registry  
**Command to continue:** "Let's go Phase 2"

---

*Document version: 1.0*  
*Last updated: 2024*  
*Total word count: ~8,500 words*  
*Estimated reading time: 35 minutes*

---

Good luck with your project! 🚀