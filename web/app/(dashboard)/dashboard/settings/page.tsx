"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { orbiterApi } from "@/lib/endpoint"
import {
  Check,
  Cpu,
  Eye,
  Info,
  Save,
  Sliders,
  Loader2,
  Settings,
  FolderOpen,
  Camera,
  Terminal,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState<"llm" | "browser" | "execution" | "recording" | "logging">("llm")
  const [toastMessage, setToastMessage] = React.useState("")

  // --- State for all dynamic settings ---
  const [llmProvider, setLlmProvider] = React.useState("openrouter")
  const [llmModel, setLlmModel] = React.useState("anthropic/claude-sonnet-4")
  const [llmMaxTokens, setLlmMaxTokens] = React.useState(4096)
  const [llmTemperature, setLlmTemperature] = React.useState(0.7)
  const [llmVision, setLlmVision] = React.useState("auto")

  const [browserHeadless, setBrowserHeadless] = React.useState(false)
  const [browserTimeout, setBrowserTimeout] = React.useState(30000)
  const [browserViewportWidth, setBrowserViewportWidth] = React.useState(1280)
  const [browserViewportHeight, setBrowserViewportHeight] = React.useState(720)

  const [execMaxSteps, setExecMaxSteps] = React.useState(100)
  const [execMaxRetries, setExecMaxRetries] = React.useState(3)
  const [execRetryDelay, setExecRetryDelay] = React.useState(1000)
  const [execScreenshotOnError, setExecScreenshotOnError] = React.useState(true)
  const [execScreenshotOnStep, setExecScreenshotOnStep] = React.useState(false)

  const [promptEnhancerEnabled, setPromptEnhancerEnabled] = React.useState(false)

  const [loopDelayMin, setLoopDelayMin] = React.useState(800)
  const [loopDelayMax, setLoopDelayMax] = React.useState(1500)
  const [loopMaxItems, setLoopMaxItems] = React.useState(100)
  const [loopScrollPause, setLoopScrollPause] = React.useState(1000)

  const [recordingEnabled, setRecordingEnabled] = React.useState(true)
  const [recordingScreenshots, setRecordingScreenshots] = React.useState(false)

  const [logLevel, setLogLevel] = React.useState("info")
  const [logConsoleEnabled, setLogConsoleEnabled] = React.useState(true)

  // 1. Fetch User Settings
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ["userSettings"],
    queryFn: () => orbiterApi.getSettings(),
  })

  // 2. Fetch Models for the active provider
  const { data: modelsData, isLoading: loadingModels } = useQuery({
    queryKey: ["systemModels", llmProvider],
    queryFn: () => orbiterApi.getModels(llmProvider),
    enabled: !!llmProvider,
  })

  // 3. Fetch Browser Profiles
  const { data: profilesData } = useQuery({
    queryKey: ["systemProfiles"],
    queryFn: () => orbiterApi.getProfiles(),
  })

  // 4. Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: { key: string; value: string }[]) => orbiterApi.updateSettings(settings),
    onSuccess: (data) => {
      setToastMessage(data.message || "Settings updated successfully!")
      queryClient.invalidateQueries({ queryKey: ["userSettings"] })
      setTimeout(() => setToastMessage(""), 3000)
    }
  })

  // Sync settings when loaded
  React.useEffect(() => {
    if (settingsData?.success && settingsData.settings) {
      const sMap = new Map<string, string>()
      for (const s of settingsData.settings) {
        sMap.set(s.key, s.value)
      }

      const getStr = (k: string, def: string) => sMap.get(k) ?? def
      const getNum = (k: string, def: number) => {
        const val = sMap.get(k)
        return val ? parseInt(val, 10) : def
      }
      const getFloat = (k: string, def: number) => {
        const val = sMap.get(k)
        return val ? parseFloat(val) : def
      }
      const getBool = (k: string, def: boolean) => {
        const val = sMap.get(k)
        return val ? val === "true" : def
      }

      setLlmProvider(getStr("llm.provider", "openrouter"))
      setLlmModel(getStr("llm.model", "anthropic/claude-sonnet-4"))
      setLlmMaxTokens(getNum("llm.maxTokens", 4096))
      setLlmTemperature(getFloat("llm.temperature", 0.7))
      setLlmVision(getStr("llm.vision", "auto"))

      setBrowserHeadless(getBool("browser.headless", false))
      setBrowserTimeout(getNum("browser.defaultTimeout", 30000))
      setBrowserViewportWidth(getNum("browser.viewport.width", 1280))
      setBrowserViewportHeight(getNum("browser.viewport.height", 720))

      setExecMaxSteps(getNum("execution.maxSteps", 100))
      setExecMaxRetries(getNum("execution.maxRetries", 3))
      setExecRetryDelay(getNum("execution.retryDelay", 1000))
      setExecScreenshotOnError(getBool("execution.screenshotOnError", true))
      setExecScreenshotOnStep(getBool("execution.screenshotOnStep", false))

      setPromptEnhancerEnabled(getBool("promptEnhancer.enabled", false))

      setLoopDelayMin(getNum("loop.defaultDelay.min", 800))
      setLoopDelayMax(getNum("loop.defaultDelay.max", 1500))
      setLoopMaxItems(getNum("loop.maxItems", 100))
      setLoopScrollPause(getNum("loop.scrollPauseTime", 1000))

      setRecordingEnabled(getBool("recording.enabled", true))
      setRecordingScreenshots(getBool("recording.includeScreenshots", false))

      setLogLevel(getStr("logging.level", "info"))
      setLogConsoleEnabled(getBool("logging.console.enabled", true))
    }
  }, [settingsData])

  // Automatically select first model when provider changes
  React.useEffect(() => {
    if (modelsData?.success && modelsData.models.length > 0) {
      const activeModels = modelsData.models.map((m: any) => m.id)
      if (!activeModels.includes(llmModel)) {
        setLlmModel(activeModels[0])
      }
    }
  }, [modelsData, llmModel])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    const payload = [
      { key: "llm.provider", value: llmProvider },
      { key: "llm.model", value: llmModel },
      { key: "llm.maxTokens", value: llmMaxTokens.toString() },
      { key: "llm.temperature", value: llmTemperature.toString() },
      { key: "llm.vision", value: llmVision },

      { key: "browser.headless", value: browserHeadless.toString() },
      { key: "browser.defaultTimeout", value: browserTimeout.toString() },
      { key: "browser.viewport.width", value: browserViewportWidth.toString() },
      { key: "browser.viewport.height", value: browserViewportHeight.toString() },

      { key: "execution.maxSteps", value: execMaxSteps.toString() },
      { key: "execution.maxRetries", value: execMaxRetries.toString() },
      { key: "execution.retryDelay", value: execRetryDelay.toString() },
      { key: "execution.screenshotOnError", value: execScreenshotOnError.toString() },
      { key: "execution.screenshotOnStep", value: execScreenshotOnStep.toString() },

      { key: "promptEnhancer.enabled", value: promptEnhancerEnabled.toString() },

      { key: "loop.defaultDelay.min", value: loopDelayMin.toString() },
      { key: "loop.defaultDelay.max", value: loopDelayMax.toString() },
      { key: "loop.maxItems", value: loopMaxItems.toString() },
      { key: "loop.scrollPauseTime", value: loopScrollPause.toString() },

      { key: "recording.enabled", value: recordingEnabled.toString() },
      { key: "recording.includeScreenshots", value: recordingScreenshots.toString() },

      { key: "logging.level", value: logLevel },
      { key: "logging.console.enabled", value: logConsoleEnabled.toString() },
    ]

    updateSettingsMutation.mutate(payload)
  }

  if (loadingSettings) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-semibold">Reading user configuration...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-emerald-500 text-white rounded-xl shadow-xl flex items-center gap-2 border border-emerald-400/20 font-semibold text-xs animate-slide-down">
          <Check className="size-4" />
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your browser automation and LLM preferences. These configurations are bound specifically to your account.
        </p>
      </div>

      {/* Settings Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="flex flex-col gap-1 bg-card/45 border border-border/50 p-3 rounded-xl backdrop-blur-md shadow-xs">
          {[
            { id: "llm", label: "LLM Engine", icon: Cpu },
            { id: "browser", label: "Browser Profiles", icon: FolderOpen },
            { id: "execution", label: "Agent Execution", icon: Sliders },
            { id: "recording", label: "Screen Recording", icon: Camera },
            { id: "logging", label: "System Logging", icon: Terminal }
          ].map((tab) => {
            const Icon = tab.icon
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Settings Form Card */}
        <form onSubmit={handleSave} className="md:col-span-3 border border-border/50 bg-card/45 backdrop-blur-md p-6 rounded-xl shadow-xs space-y-6">
          
          {/* TAB 1: LLM ENGINE */}
          {activeTab === "llm" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">LLM Inference Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Customize default inference node engines and routing parameters.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">LLM Provider</label>
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25 font-semibold"
                    >
                      <option value="openrouter">OpenRouter</option>
                      <option value="opencode-go">OpenCode Go</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Default Agent Model</label>
                    {loadingModels ? (
                      <div className="w-full h-10 flex items-center justify-center bg-background/50 border border-border rounded-lg">
                        <Loader2 className="size-4 animate-spin text-primary" />
                      </div>
                    ) : (
                      <select
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25 font-semibold"
                      >
                        {modelsData?.success && modelsData.models.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Model Vision Capability</label>
                  <select
                    value={llmVision}
                    onChange={(e) => setLlmVision(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25 font-semibold"
                  >
                    <option value="auto">Auto (Detect modal abilities dynamically)</option>
                    <option value="enabled">Enabled (Force capture & vision updates)</option>
                    <option value="disabled">Disabled (Text-only run context)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-medium text-muted-foreground">Model Temperature</label>
                      <span className="font-mono font-bold text-primary">{llmTemperature.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={llmTemperature}
                      onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
                      className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                      <span>Deterministic</span>
                      <span>Creative / Exploratory</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-medium text-muted-foreground">Max Output Token Limit</label>
                      <span className="font-mono font-bold text-primary">{llmMaxTokens} tokens</span>
                    </div>
                    <input
                      type="range"
                      min="256"
                      max="8192"
                      step="256"
                      value={llmMaxTokens}
                      onChange={(e) => setLlmMaxTokens(parseInt(e.target.value))}
                      className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BROWSER PROFILES */}
          {activeTab === "browser" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Browser Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Define browser parameters, headless execution, and viewports.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/20">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold">Run Headless Mode</label>
                    <p className="text-[10px] text-muted-foreground">Execute browser runs in the background without UI display.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={browserHeadless}
                    onChange={(e) => setBrowserHeadless(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Viewport Width (px)</label>
                    <input
                      type="number"
                      value={browserViewportWidth}
                      onChange={(e) => setBrowserViewportWidth(parseInt(e.target.value) || 1280)}
                      className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Viewport Height (px)</label>
                    <input
                      type="number"
                      value={browserViewportHeight}
                      onChange={(e) => setBrowserViewportHeight(parseInt(e.target.value) || 720)}
                      className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Timeout (ms)</label>
                    <input
                      type="number"
                      value={browserTimeout}
                      onChange={(e) => setBrowserTimeout(parseInt(e.target.value) || 30000)}
                      className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Detected Chrome Profiles</label>
                  <div className="p-3 bg-background/30 rounded-lg border border-border/40 space-y-1 text-xs">
                    {profilesData?.success && profilesData.profiles.length > 0 ? (
                      profilesData.profiles.map((p: any) => (
                        <div key={p.name} className="flex justify-between font-mono text-[10px] text-muted-foreground">
                          <span>{p.name}</span>
                          <span>{p.hasSavedState ? "Active cookie context" : "Default context"}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">No persistent browser profiles generated yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AGENT EXECUTION */}
          {activeTab === "execution" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Agent Workflow Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Control execution limits, retries, and browser loop delays.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Max Steps Per Session</label>
                    <input
                      type="number"
                      value={execMaxSteps}
                      onChange={(e) => setExecMaxSteps(parseInt(e.target.value) || 100)}
                      className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Tool Action Retries</label>
                    <input
                      type="number"
                      value={execMaxRetries}
                      onChange={(e) => setExecMaxRetries(parseInt(e.target.value) || 3)}
                      className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Retry Delay (ms)</label>
                    <input
                      type="number"
                      value={execRetryDelay}
                      onChange={(e) => setExecRetryDelay(parseInt(e.target.value) || 1000)}
                      className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/20">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold">Prompt Enhancer (AI)</label>
                      <p className="text-[10px] text-muted-foreground">Automatically refine task objectives before running them.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={promptEnhancerEnabled}
                      onChange={(e) => setPromptEnhancerEnabled(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/20">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold">Screenshot on Step Success</label>
                      <p className="text-[10px] text-muted-foreground">Capture snapshots after every successful action step.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={execScreenshotOnStep}
                      onChange={(e) => setExecScreenshotOnStep(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
                    />
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 mt-2">
                  <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Activity className="size-3.5 text-primary" /> Loop Extraction Tuning
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Min Loop Action Delay (ms)</label>
                      <input
                        type="number"
                        value={loopDelayMin}
                        onChange={(e) => setLoopDelayMin(parseInt(e.target.value) || 800)}
                        className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Max Loop Action Delay (ms)</label>
                      <input
                        type="number"
                        value={loopDelayMax}
                        onChange={(e) => setLoopDelayMax(parseInt(e.target.value) || 1500)}
                        className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCREEN RECORDING */}
          {activeTab === "recording" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Flow Recording Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure replay action recorders and artifacts settings.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/20">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold">Enable Flow Recording</label>
                    <p className="text-[10px] text-muted-foreground">Export session outcomes into replayable flows.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={recordingEnabled}
                    onChange={(e) => setRecordingEnabled(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/20">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold">Export Step Screenshots</label>
                    <p className="text-[10px] text-muted-foreground">Bundle screenshot outputs directly into saved flow JSONs.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={recordingScreenshots}
                    onChange={(e) => setRecordingScreenshots(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM LOGGING */}
          {activeTab === "logging" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Logging Attributes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Control debug logs, verbose telemetry, and output verbosity.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Internal Log Level</label>
                    <select
                      value={logLevel}
                      onChange={(e) => setLogLevel(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25 font-semibold"
                    >
                      <option value="error">Error</option>
                      <option value="warn">Warn</option>
                      <option value="info">Info</option>
                      <option value="debug">Debug</option>
                      <option value="trace">Trace</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/20 mt-6">
                    <div className="space-y-0.5">
                      <label className="text-xs font-semibold">Console Colorization</label>
                      <p className="text-[10px] text-muted-foreground">Apply colors to terminal debugging outputs.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={logConsoleEnabled}
                      onChange={(e) => setLogConsoleEnabled(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Footer Bar */}
          <div className="flex items-center justify-between pt-5 border-t border-border/50 mt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="size-4 text-primary shrink-0" />
              <span className="text-[10px] leading-normal font-semibold">Settings are dynamically updated for subsequent agent runs.</span>
            </div>
            
            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all disabled:opacity-60 cursor-pointer shadow-xs shadow-primary/10"
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
