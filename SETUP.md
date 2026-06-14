# Setup Guide: Configuration & Service Deployment

This guide outlines the steps required to configure the bootstrap environment for Orbiter, initialize the database layer, and deploy both the backend REST API server and the Next.js frontend application.

---

## 1. Creating the Configuration File

Orbiter uses a single `configuration.yml` (or `configuration.yaml`) file at the root of the project directory to bootstrap the application. 

> [!IMPORTANT]
> Because Orbiter retrieves configuration dynamically from the database after initialization, the `configuration.yml` file is primarily used to bootstrap the database connection and specify default values for the initial settings seed. Subsequent updates are made dynamically via the Frontend UI.

### Step-by-Step Instructions
Create a file named `configuration.yml` in the root of your project workspace (`/home/oshanavishka06/Orbiter/configuration.yml`) and populate it with the following structure:

```yaml
# Orbiter Bootstrap Configuration
version: 1

# Database Settings (Required for startup)
database:
  url: "postgresql://<username>:<password>@<host>:<port>/<dbname>?sslmode=require"

# Browser Settings (Defaults for initial seeding)
browser:
  headless: false
  defaultTimeout: 30000
  viewport:
    width: 1280
    height: 720
  profilePath: null
  executablePath: null
  channel: null

# LLM Settings (Defaults for initial seeding)
llm:
  provider: openrouter
  model: anthropic/claude-sonnet-4
  openrouterApiKey: ""
  opencodeApiKey: ""
  maxTokens: 4096
  temperature: 0.7
  vision: auto

# Execution Workflow Settings (Defaults for initial seeding)
execution:
  maxRetries: 3
  retryDelay: 1000
  screenshotOnError: true
  screenshotOnStep: false

# Prompt Enhancement Settings (Defaults for initial seeding)
promptEnhancer:
  enabled: true

# Loop Extraction Settings (Defaults for initial seeding)
loop:
  defaultDelay:
    min: 800
    max: 1500
  maxItems: 100
  scrollPauseTime: 1000

# Screen Recording Settings (Defaults for initial seeding)
recording:
  enabled: true
  includeScreenshots: false

# System Logging Settings (Defaults for initial seeding)
logging:
  level: info
  console:
    enabled: true
    colorize: true
```

---

## 2. Starting the Backend Server

The backend is built with Fastify and TypeScript. It hosts the REST APIs, runs browser automation steps, and handles database interactions.

### Prerequisites
Make sure you have `pnpm` installed and the PostgreSQL database specified in `configuration.yml` is reachable.

### Step-by-Step Execution
1. **Navigate to the root directory**:
   Ensure you are in the project root:
   ```bash
   /home/oshanavishka06/Orbiter
   ```
2. **Install dependencies**:
   ```bash
   pnpm install
   ```
3. **Start the development server**:
   ```bash
   pnpm run serve:dev
   ```
   *Note: This starts the REST API server on `http://0.0.0.0:4040` using `tsx` for live compilation.*
4. **Compile and run in production mode (Alternative)**:
   ```bash
   pnpm run build
   pnpm run serve
   ```

---

## 3. Starting the Frontend Application

The frontend dashboard is built using React, Next.js, and Tailwind CSS. It communicates with the backend REST API server by proxying requests to port `4040`.

### Step-by-Step Execution
1. **Navigate to the frontend directory**:
   ```bash
   /home/oshanavishka06/Orbiter/web
   ```
2. **Install frontend dependencies**:
   ```bash
   pnpm install
   ```
3. **Start the frontend development server**:
   ```bash
   pnpm run dev
   ```
   *Note: This starts the Next.js server on `http://localhost:3000` (or the corresponding Cloud Shell preview URL).*
4. **Build and start in production mode (Alternative)**:
   ```bash
   pnpm run build
   pnpm run start
   ```

---

## 4. Post-Startup Configuration (API Keys)

Once both the backend server and frontend application are running:
1. Open your web browser and navigate to the dashboard (e.g. `http://localhost:3000` or the Cloud Shell Web Preview).
2. Log in with the default admin user:
   - **Username**: `admin`
   - **Password**: `admin`
3. Go to the **Settings** page in the left sidebar and select the **LLM Engine** tab.
4. Input your **OpenRouter API Key** and/or **OpenCode API Key** in the designated inputs under the *LLM Inference Settings* section.
5. Click **Save Settings**. 

Your keys will be dynamically encrypted/saved to the database and utilized for all subsequent agent runs.
