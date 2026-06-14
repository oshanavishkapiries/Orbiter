# Orbiter REST API Specification & Implementation Plan

This document details the transition of the existing Orbiter CLI features into a robust REST API service, providing the specifications, payloads, validation logic, and routing schemas.

---

## 1. Domain Separation
For high scalability, the REST API endpoints are grouped into 4 distinct domains:
1. **Execution (`/api/v1/execution`)**
2. **Flows (`/api/v1/flows`)**
3. **Memory (`/api/v1/memory`)**
4. **System (`/api/v1/system`)**

---

## 2. API Endpoints Specification

### A. Execution Domain (`/api/v1/execution`)

#### 1. Start Task Execution
Starts a background runner session representing CLI `orbiter run "<prompt>"`.
- **Method & Path:** `POST /api/v1/execution/run`
- **Validation (Zod):**
  ```json
  {
    "prompt": "string (required, minLength: 5)",
    "model": "string (optional)",
    "profile": "string (optional)",
    "headless": "boolean (optional, default: true)",
    "maxSteps": "number (optional, min: 1, max: 100)",
    "record": "boolean (optional, default: true)",
    "enhance": "boolean (optional, default: true)",
    "highlight": "boolean (optional, default: false)"
  }
  ```
- **Success Response (`202 Accepted`):**
  ```json
  {
    "success": true,
    "sessionId": "sess_uuid_12345",
    "status": "queued",
    "message": "Task execution started in background"
  }
  ```

#### 2. Get Live Execution Stream
Retrieves real-time steps, screenshots, and console logs via Server-Sent Events (SSE).
- **Method & Path:** `GET /api/v1/execution/stream/:sessionId`
- **Response Stream Event Formats:**
  ```text
  event: step
  data: {"stepNumber": 1, "toolName": "browser_navigate", "success": true}
  
  event: screenshot
  data: {"imageBase64": "data:image/png;base64,... "}
  ```

#### 3. Replay Flow
Replays a saved flow file without LLM cost (corresponds to `orbiter replay <flow>`).
- **Method & Path:** `POST /api/v1/execution/replay`
- **Validation (Zod):**
  ```json
  {
    "flowPath": "string (required)",
    "params": "object (optional)",
    "headless": "boolean (optional)",
    "profile": "string (optional)",
    "stopOnError": "boolean (optional, default: false)",
    "screenshotSteps": "boolean (optional, default: false)",
    "skipSteps": "array of numbers (optional)"
  }
  ```
- **Success Response (`202 Accepted`):**
  ```json
  {
    "success": true,
    "sessionId": "sess_uuid_67890",
    "message": "Flow replay started in background"
  }
  ```

#### 4. List Sessions
Lists recent automation sessions (corresponds to `orbiter session list`).
- **Method & Path:** `GET /api/v1/execution/sessions`
- **Query Params:**
  - `page`: number (default: 1)
  - `limit`: number (default: 15)
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "sessions": [
      {
        "id": "sess_uuid_12345",
        "goal": "Extract hotels",
        "model": "anthropic/claude-sonnet-4",
        "provider": "openrouter",
        "status": "completed",
        "stepCount": 12,
        "createdAt": 1718378511000,
        "completedAt": 1718378545000
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 40,
      "hasNext": true
    }
  }
  ```

#### 5. Get Session Details
Retrieves detailed step history and meta data for a session (corresponds to `orbiter session show <id>`).
- **Method & Path:** `GET /api/v1/execution/sessions/:id`
- **Query Params:**
  - `full`: boolean (optional, default: false - returns full step result payload if true)
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "session": {
      "id": "sess_uuid_12345",
      "goal": "Extract hotels",
      "model": "anthropic/claude-sonnet-4",
      "provider": "openrouter",
      "status": "completed",
      "createdAt": 1718378511000,
      "completedAt": 1718378545000,
      "steps": [
        {
          "stepNumber": 1,
          "toolName": "browser_navigate",
          "resultSummary": "Navigated to google.com",
          "success": true,
          "duration": 1500,
          "fullResult": {}
        }
      ],
      "domSnapshotsCount": 5,
      "collectedDataCount": 1
    }
  }
  ```

#### 6. Get Session Extracted Data
Retrieves collected data items for a session (corresponds to `orbiter session data <id>`).
- **Method & Path:** `GET /api/v1/execution/sessions/:id/data`
- **Query Params:**
  - `json`: boolean (optional, default: false - outputs format-specific results vs simple key-value formatting)
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "records": [
      {
        "stepNumber": 5,
        "toolName": "save_json",
        "itemCount": 10,
        "data": [
          { "name": "Hotel A", "price": "$120" }
        ]
      }
    ]
  }
  ```

---

### B. Flows Domain (`/api/v1/flows`)

#### 1. List Flows
Retrieves saved flows from the database.
- **Method & Path:** `GET /api/v1/flows`
- **Query Params:**
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
  - `type`: `raw` | `optimized`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "flow_123",
        "name": "Extract Booking Hotels",
        "type": "optimized",
        "stepCount": 12,
        "createdAt": 1718378511000
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 48,
      "hasNext": true
    }
  }
  ```

#### 2. Refine Flow
Cleans up and optimizes raw flow files (corresponds to `orbiter refine <flow>`).
- **Method & Path:** `POST /api/v1/flows/:id/refine`
- **Payload Schema:**
  ```json
  {
    "mode": "auto" | "llm" | "interactive",
    "options": {
      "removeFailures": "boolean",
      "mergeSteps": "boolean",
      "outputPath": "string (optional)",
      "dryRun": "boolean (optional)"
    }
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Flow refined successfully",
    "outputPath": "flows/optimized-flow.flow.json"
  }
  ```

---

### C. Memory Domain (`/api/v1/memory`)

#### 1. Retrieve Selector Memories
Lists stored selectors filtered by domain (corresponds to `orbiter memory list`).
- **Method & Path:** `GET /api/v1/memory/selectors`
- **Query Params:**
  - `domain`: string (required)
  - `limit`: number (optional, default: 20)
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "selectors": [
      {
        "id": "sel_999",
        "elementName": "search-button",
        "elementType": "button",
        "primarySelector": "button[type='submit']",
        "confidence": 0.95,
        "usageCount": 10,
        "successCount": 9,
        "fallbacks": [
          {"selector": "button.submit-btn", "priority": 1, "successRate": 0.95}
        ]
      }
    ]
  }
  ```

#### 2. Search Selectors
Searches stored selectors by name pattern (corresponds to `orbiter memory search`).
- **Method & Path:** `GET /api/v1/memory/selectors/search`
- **Query Params:**
  - `domain`: string (required)
  - `query`: string (required)
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "results": [
      {
        "elementName": "search-button",
        "primarySelector": "button[type='submit']"
      }
    ]
  }
  ```

#### 3. Query Vector Memory
Queries vector memories.
- **Method & Path:** `POST /api/v1/memory/vector/search`
- **Payload Schema:**
  ```json
  {
    "domain": "string (required)",
    "query": "string (required)",
    "limit": "number (optional, default: 3)"
  }
  ```

#### 4. Get Memory Statistics
Retrieves DB connection statistics and counts (corresponds to `orbiter memory stats`).
- **Method & Path:** `GET /api/v1/memory/stats`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "database": {
      "host": "localhost",
      "database": "orbiter",
      "tables": {
        "memories": 150,
        "selectors": 80
      }
    },
    "memory": {
      "total": 150,
      "averageConfidence": 0.88,
      "byType": {
        "selector": 80,
        "error_pattern": 70
      },
      "byDomain": {
        "google.com": 20
      }
    }
  }
  ```

#### 5. Clear Memory
Clears memory database (corresponds to `orbiter memory clear`).
- **Method & Path:** `DELETE /api/v1/memory`
- **Query Params:**
  - `domain`: string (optional - if provided, clears domain only)
  - `all`: boolean (optional - if true, clears all memories)
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "deletedCount": 42,
    "message": "Memory entries cleared successfully"
  }
  ```

---

### D. System Domain (`/api/v1/system`)

#### 1. List Profiles
Lists saved Chrome profiles (corresponds to `orbiter profile list`).
- **Method & Path:** `GET /api/v1/system/profiles`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "profiles": [
      {
        "name": "default",
        "path": "/profiles/default",
        "hasSavedState": true,
        "createdAt": 1718378511000,
        "lastUsedAt": 1718378545000,
        "description": "Default browser profile"
      }
    ]
  }
  ```

#### 2. Create Profile
Creates a new named profile (corresponds to `orbiter profile create`).
- **Method & Path:** `POST /api/v1/system/profiles`
- **Validation (Zod):**
  ```json
  {
    "name": "string (required, alphanumeric, hyphens)",
    "description": "string (optional)"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "profile": {
      "name": "work",
      "path": "/profiles/work"
    }
  }
  ```

#### 3. Get Profile Details
Retrieves details of a single named profile (corresponds to `orbiter profile info`).
- **Method & Path:** `GET /api/v1/system/profiles/:name`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "profile": {
      "name": "default",
      "path": "/profiles/default",
      "hasSavedState": true,
      "createdAt": 1718378511000,
      "lastUsedAt": 1718378545000,
      "description": "Default browser profile"
    }
  }
  ```

#### 4. List Available LLM Models
Lists supported LLM models for a provider (corresponds to `orbiter models`).
- **Method & Path:** `GET /api/v1/system/models`
- **Query Params:**
  - `provider`: string (optional, e.g., "openrouter" | "opencode-go")
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "provider": "openrouter",
    "models": [
      {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude 3.5 Sonnet",
        "contextLength": 200000
      }
    ]
  }
  ```

#### 5. Get Current Configuration
Shows current configuration values (corresponds to `orbiter config --show`).
- **Method & Path:** `GET /api/v1/system/config`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "config": {
      "version": 1,
      "database": {
        "url": "postgresql://..."
      },
      "browser": {
        "headless": true
      }
    }
  }
  ```

#### 6. Update Settings
Updates settings (corresponds to editing config or settings DB values).
- **Method & Path:** `PUT /api/v1/system/settings`
- **Payload Schema:**
  ```json
  {
    "settings": [
      {
        "key": "llm.temperature",
        "value": "0.5"
      }
    ]
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Settings updated successfully"
  }
  ```

---

## 3. Implementation Workflow & Tech Stack
- **Framework:** Express with TypeScript
- **Validation:** Zod schemas
- **SSE:** Standard Node.js stream events
- **Error Handler Middleware:** Catching all asynchronous exceptions and mapping them to HTTP status codes.
