# Orbiter REST API සැලසුම්කරණය සහ තාක්ෂණික පිරිවිතර (REST API Technical Specification & Plan)

මෙම ලේඛනය මඟින් දැනට පවතින Orbiter CLI විශේෂාංග REST API එකක් ලෙස පරිවර්තනය කිරීමේ සම්පූර්ණ සැලැස්ම විස්තර කෙරේ. මෙහි payload schemas, response formats, validations සහ pagination පිළිබඳ සවිස්තරාත්මක විග්‍රහයක් අඩංගු වේ.

---

## 1. ඩොමේන් අනුව API ව්‍යුහය (Domain-Based API Grouping)

පහසු කළමනාකරණය සඳහා API එක ප්‍රධාන ඩොමේන් (domains) 4කට බෙදා ඇත:
1. **Execution Domain (`/api/v1/execution`):** CLI හි `run` විධානයට අදාළ සජීවී කාර්යයන් ධාවනය, නැවත නැවත ධාවනය සහ තත්ත්වයන් නිරීක්ෂණය.
2. **Flows Domain (`/api/v1/flows`):** CLI හි `replay` සහ `refine` විධානයන්ට අදාළ flows සුරැකීම, සංස්කරණය සහ ප්‍රශස්තකරණය.
3. **Memory Domain (`/api/v1/memory`):** CLI හි `memory` විධානයට අදාළ selectors, error patterns, සහ vector memories කළමනාකරණය.
4. **System Domain (`/api/v1/system`):** CLI හි `config`, `profile`, සහ `models` විධානයන්ට අදාළ සැකසුම්, බ්‍රවුසර් පැතිකඩ සහ LLM මාදිලි කළමනාකරණය.

---

## 2. සවිස්තරාත්මක API අන්ත ලක්ෂ්‍ය සහ ස්කීමා (Detailed API Endpoints & Schemas)

### A. Execution Domain (`/api/v1/execution`)

#### 1. Start Task Execution (`POST /api/v1/execution/run`)
CLI හි `orbiter run "<prompt>"` ක්‍රියාවලිය ඇරඹීම.

* **Payload Validation (Zod Schema):**
  ```json
  {
    "prompt": "string (required, min: 5)",
    "model": "string (optional)",
    "profile": "string (optional)",
    "headless": "boolean (optional, default: true)",
    "maxSteps": "number (optional, min: 1, max: 100)",
    "record": "boolean (optional, default: true)",
    "enhance": "boolean (optional, default: true)",
    "highlight": "boolean (optional, default: false)"
  }
  ```
* **Success Response Schema (`202 Accepted`):**
  ```json
  {
    "success": true,
    "sessionId": "sess_uuid_12345",
    "status": "queued",
    "message": "Task execution started in background"
  }
  ```

#### 2. Get Live Execution Stream (`GET /api/v1/execution/stream/:sessionId`)
සජීවීව පියවරවල් (steps), screenshots සහ console logs ලබා ගැනීම (Server-Sent Events - SSE මඟින්).
* **Response Stream:**
  ```text
  event: step
  data: {"stepNumber": 1, "toolName": "browser_navigate", "success": true}
  
  event: screenshot
  data: {"imageBase64": "data:image/png;base64,... "}
  ```

---

### B. Flows Domain (`/api/v1/flows`)

#### 1. List Flows (`GET /api/v1/flows`)
සුරකින ලද flows ලැයිස්තුව. මෙයට පිටුකරණය (pagination) ඇතුළත් වේ.
* **Query Parameters:**
  - `page`: default `1`
  - `limit`: default `10`
  - `type`: `raw` හෝ `optimized`
* **Success Response Schema (`200 OK`):**
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

#### 2. Refine Flow (`POST /api/v1/flows/:id/refine`)
CLI හි `orbiter refine` ක්‍රියාවලිය ක්‍රියාත්මක කිරීම.
* **Payload Schema:**
  ```json
  {
    "mode": "auto" | "llm" | "interactive",
    "options": {
      "removeFailures": "boolean",
      "mergeSteps": "boolean"
    }
  }
  ```

---

### C. Memory Domain (`/api/v1/memory`)

#### 1. Retrieve Domain Selectors (`GET /api/v1/memory/selectors`)
* **Query Parameters:**
  - `domain`: "booking.com" (required)
  - `elementName`: "search-button" (optional)
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "success": true,
    "selectors": [
      {
        "id": "sel_999",
        "elementName": "search-button",
        "primarySelector": "button[type='submit']",
        "fallbacks": [
          {"selector": "button.submit-btn", "priority": 1, "successRate": 0.95}
        ]
      }
    ]
  }
  ```

#### 2. Query Vector Memory (`POST /api/v1/memory/vector/search`)
* **Payload Schema:**
  ```json
  {
    "domain": "string (required)",
    "query": "string (required)",
    "limit": "number (optional, default: 3)"
  }
  ```

---

### D. System Domain (`/api/v1/system`)

#### 1. List Profiles (`GET /api/v1/system/profiles`)
පවතින Chrome Profiles ලැයිස්තුව.
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "success": true,
    "profiles": ["default", "work", "twitter_scraper"]
  }
  ```

#### 2. Update Settings (`PUT /api/v1/system/settings`)
* **Payload Schema:**
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

---

## 3. පිටුකරණය සහ පෙරහන් ප්‍රමිතිකරණය (Pagination & Filter Standards)

සියලුම සෙවීම් (sessions, flows, outputs, app_logs) සඳහා පොදු පිටුකරණ රටාවක් භාවිතා කරනු ලැබේ:
* **Request URL Example:** `/api/v1/execution/sessions?page=2&limit=20&status=completed&search=booking`
* **Response Validation Meta:**
  ```json
  {
    "meta": {
      "total": 105,
      "page": 2,
      "limit": 20,
      "pages": 6
    }
  }
  ```

## 4. තාක්ෂණික ක්‍රියාත්මක කිරීමේ සැලැස්ම (Implementation Plan)
1. **Express Server Setup:** `src/server/app.ts` සහ `src/server/routes/` සකස් කිරීම.
2. **SSE Implementation:** සජීවී බ්‍රවුසර් ලොග් සහ තිර රූ (live terminal highlights) SSE මඟින් ඉදිරිපත් කිරීම.
3. **Zod Validation Middleware:** වැරදි දත්ත API එකට ඇතුල් වීම වැළැක්වීම.
4. **Error Handling Middleware:** අසාර්ථක ධාවන සහ දත්ත ගබඩා දෝෂ වලදී නිවැරදි HTTP codes (`400`, `404`, `500`) ලබා දීම.
