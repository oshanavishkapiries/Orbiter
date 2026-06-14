# Orbiter REST API Server Implementation Plan

This document outlines the phased plan to implement a resource-efficient, lightweight REST API server for the Orbiter engine.

---

## 🛠️ Technology Stack Decisions

To satisfy the **resource-efficient** and **lightweight** design goals, the following technologies are selected:

1. **Framework: Fastify**
   - **Why:** Extremely low overhead compared to Express, native JSON schema rendering/parsing (up to 2-3x faster than Express), and a smaller memory footprint.
2. **Real-time Streaming: Server-Sent Events (SSE)**
   - **Why:** Lightweight, unidirectional HTTP-based streaming. Avoids the protocol overhead and handshake complexity of WebSockets since the browser only needs to read logs/state.
3. **Background Job Queue: PostgreSQL DB-Backed Queue (`SELECT ... FOR UPDATE SKIP LOCKED`)**
   - **Why:** PostgreSQL is already part of the infrastructure. Using PostgreSQL as a queue avoids external dependencies (like Redis or RabbitMQ), keeps deployment lightweight, prevents job loss on server crashes/restarts, and supports safe, concurrent worker processing using `SKIP LOCKED` natively.
4. **Validation: Zod + Fastify Type Provider Zod**
   - **Why:** Zero runtime compilation overhead during request processing, providing clean and strict API validation.
5. **Database Client: Reuse Existing `pg` Connection Pool**
   - **Why:** Avoids adding a heavy ORM. Reuses the existing PostgreSQL pool class already written in `src/memory/database/connection.ts`.


---

## 📅 Phased Implementation Plan

### Phase 1: Core Setup & Server Bootstrap (Estimated: 1-2 Days)
- **Tasks:**
  1. Add dependencies: `fastify`, `@fastify/cors`, `zod`, `fastify-type-provider-zod`.
  2. Create server entry point in `src/server/index.ts`.
  3. Initialize database connection pool on server start.
  4. Create standard error handler middleware and CORS setup.
  5. Register a health-check endpoint (`GET /health`).

### Phase 2: System & Configuration API (Estimated: 1 Day)
- **Tasks:**
  1. Implement routes under `/api/v1/system/`:
     - `GET /config` (Read local configurations).
     - `PUT /settings` (Update DB configuration settings).
     - `GET /profiles` (List Chrome profile data).
     - `POST /profiles` (Create a named profile directory).
     - `GET /profiles/:name` (Get description, status, path of a profile).
     - `GET /models` (Query available LLM models from OpenRouter/OpenCode Go).
  2. Validate payloads using Zod schemas.

### Phase 3: Memory & Flows API (Estimated: 2 Days)
- **Tasks:**
  1. Implement routes under `/api/v1/memory/`:
     - `GET /stats` (Retrieve pg/vector count stats).
     - `GET /selectors` (Get selectors by domain).
     - `GET /selectors/search` (Search selector name patterns).
     - `DELETE /` (Clear domain selectors/all memories).
     - `POST /vector/search` (Cosine similarity search via pgvector).
  2. Implement routes under `/api/v1/flows/`:
     - `GET /` (Paginated list of raw/optimized flows).
     - `POST/:id/refine` (Execute rule-based or LLM optimization).

### Phase 4: Execution Engine & SSE Streaming (Estimated: 3 Days)
- **Tasks:**
  1. Implement execution history endpoints:
     - `GET /api/v1/execution/sessions` (Paginated list of sessions).
     - `GET /api/v1/execution/sessions/:id` (Get session steps & details).
     - `GET /api/v1/execution/sessions/:id/data` (Get extracted CSV/JSON datasets).
  2. Implement async runner endpoints:
     - Setup database queue table `jobs` schema and worker polling logic using `SKIP LOCKED`.
     - `POST /api/v1/execution/run` (Initiate a task execution background job).
     - `POST /api/v1/execution/replay` (Initiate a replay background job).
  3. Implement SSE Endpoint:
     - `GET /api/v1/execution/stream/:sessionId` (Subscribe to live step notifications, console logs, and base64 screenshots).


### Phase 5: CLI Integration & Production Build (Estimated: 1 Day)
- **Tasks:**
  1. Create the `orbiter serve` command in `src/cli/commands/serve.ts` and register it in `src/cli/index.ts`.
  2. Add npm scripts (`npm run serve`) in `package.json`.
  3. Test build compiling (`npm run build`) and clean up all connections on server SIGINT/SIGTERM.
