# AI Agent Handover & Project Context

Welcome back! This document serves as the project memory cache and development handover. It outlines the project's overall architecture, the changes implemented today, key file locations, and guidance for next steps.

---

## 1. Project Overview & Architecture

**Orbiter** is an AI-powered browser automation framework that allows an LLM agent to execute steps on a real browser, capture logs, trace executions, and extract structured data.

### Stack Details
- **Backend**: TypeScript + Fastify (`src/`). Communicates with PostgreSQL database using the `pg` package. Uses Model Context Protocol (MCP) to interact with a Playwright browser instance via `@playwright/mcp`.
- **Frontend**: Next.js (App Router) + React Query + Tailwind CSS (`web/`). Accesses the backend endpoints proxying API requests to the Fastify port (`4040`).

---

## 2. Completed Tasks & Today's Commits

Below is the chronological log of achievements completed today:

1. **Root Layout & Global Styles Enhancements** (`7d6ae69`, `f30c874`, `65d091a`)
   - Configured custom theme fonts (Outfit, JetBrains Mono) and Next.js allowed CORS origin settings.
   - Integrated live styling updates and layout tweaks.
   
2. **Searchable LLM Select Dropdown** (`49322fe`)
   - Added a generic `SearchableSelect` combobox component inside [web/components/ui/searchable-select.tsx](file:///home/oshanavishka06/Orbiter/web/components/ui/searchable-select.tsx).
   - Replaced the standard HTML `<select>` element in the spawn agent form with this searchable select to make searching large sets of OpenRouter models simple and clean.

3. **Header Layout Cleanups** (`7bf2966`)
   - Removed the unnecessary global search bar component from the dashboard top header.

4. **Service Documentation & Bootstrapping Guide** (`9c323fb`)
   - Authored [SETUP.md](file:///home/oshanavishka06/Orbiter/SETUP.md) detailing the setup sequence, the structure of the `configuration.yml` bootstrap config, and step-by-step instructions to run the backend and frontend.

5. **Graceful Dangling Sessions Recovery** (`1bb53a4`)
   - Addressed the issue where crashing the backend server left sessions stuck in the `running` state in the database.
   - Implemented server startup checks that scan the database and automatically mark any dangling `running` or `queued` tasks as `failed` before starting the listener.

6. **Dynamic Root Paths Resolver** (`a7c7990`)
   - Patched path helper in [src/utils/paths.ts](file:///home/oshanavishka06/Orbiter/src/utils/paths.ts) to resolve the workspace directory dynamically by scanning up for `package.json` rather than relying on `process.cwd()`. This fixed profile and browser directory creation locations when executing commands from nested directories.

7. **Real-time Screenshot Streaming & Interactive Viewport redos** (`2c6b1ca`)
   - **Backend ([src/core/executor.ts](file:///home/oshanavishka06/Orbiter/src/core/executor.ts))**: Injected real-time screenshot capturing using the MCP client (`browser_screenshot`) after every successful browser step (such as clicks, navigation, typing). The base64 output is added directly into the step's database `full_result` structure and broadcasted to the SSE `screenshot` stream.
   - **Frontend ([web/app/(dashboard)/dashboard/sessions/page.tsx](file:///home/oshanavishka06/Orbiter/web/app/%28dashboard%29/dashboard/sessions/page.tsx))**:
     - Redesigned the session details workspace to split views cleanly between a browser viewport mock mockup frame (left) and the execution logs/timeline console (right).
     - Connected SSE listeners to update logs, status, and browser screenshots in real time.
     - Added **Interactive Step Trace Playback**: clicking any step in the trace log highlights that card and changes the browser viewport image to display the screen state captured at that specific step.
     - Added a `RESET TO LIVE` button inside the address bar to let the user jump back to the active runner output.
     - Implemented `JsonColorizer` to syntax-highlight structured JSON objects.

---

## 3. Key Files Reference

Here are the locations of the principal files modified:

- **Frontend Sessions Page**: [web/app/(dashboard)/dashboard/sessions/page.tsx](file:///home/oshanavishka06/Orbiter/web/app/%28dashboard%29/dashboard/sessions/page.tsx)
- **Backend Task Executor**: [src/core/executor.ts](file:///home/oshanavishka06/Orbiter/src/core/executor.ts)
- **Searchable Combobox**: [web/components/ui/searchable-select.tsx](file:///home/oshanavishka06/Orbiter/web/components/ui/searchable-select.tsx)
- **Startup Dangling Sessions Handler**: [src/server/index.ts](file:///home/oshanavishka06/Orbiter/src/server/index.ts) or where the Fastify app bootstraps.
- **Root Path Helpers**: [src/utils/paths.ts](file:///home/oshanavishka06/Orbiter/src/utils/paths.ts)
- **Setup & Running Guide**: [SETUP.md](file:///home/oshanavishka06/Orbiter/SETUP.md)

---

## 4. How to Start the Services

### Setup Configuration
Create a `configuration.yml` file at the root `/home/oshanavishka06/Orbiter/configuration.yml` with your database and API keys:
```yaml
version: 1
database:
  url: "postgresql://neondb_owner:npg_Tdb27EKIjaBL@ep-withered-band-aqlw2je3-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"
# (other options as shown in SETUP.md)
```

### Start Backend Server
```bash
# From project root
pnpm install
pnpm run serve:dev
```
*Port: `http://0.0.0.0:4040`*

### Start Frontend Dashboard
```bash
# From web directory
pnpm install
pnpm run dev
```
*Port: `http://localhost:3000`*

---

## 5. Next Steps for Tomorrow

When you resume development, focus on:
1. **Launch a test session**: Start both backend and frontend, login with default admin credentials (`admin` / `admin`), input OpenRouter keys, and launch a new agent run from the dashboard.
2. **Observe live streaming**: Verify that the browser viewport correctly streams base64 images on each step and that the trace list steps let you go back/forward in time interactively.
3. **Verify DB schema synchronization**: Double check that database records are saving the captured base64 data for historic playback.
