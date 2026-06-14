"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { orbiterApi } from "@/lib/endpoint"
import {
  Check,
  Eye,
  EyeOff,
  Info,
  Key,
  Save,
  Settings,
  Sliders,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState<"general" | "keys" | "parameters">("general")
  
  // Local Form state
  const [workspaceName, setWorkspaceName] = React.useState("Admin Developer Workspace")
  const [defaultModel, setDefaultModel] = React.useState("")
  const [temperature, setTemperature] = React.useState(0.7)
  const [maxTokens, setMaxTokens] = React.useState(4096)
  
  // API Credentials
  const [geminiKey, setGeminiKey] = React.useState("gsk_••••••••••••••••••••••••••••")
  const [showGemini, setShowGemini] = React.useState(false)
  const [openaiKey, setOpenaiKey] = React.useState("sk-proj-••••••••••••••••••••••••")
  const [showOpenai, setShowOpenai] = React.useState(false)

  const [toastMessage, setToastMessage] = React.useState("")

  // 1. Fetch Config
  const { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ["systemConfig"],
    queryFn: () => orbiterApi.getConfig(),
  })

  // 2. Fetch Models
  const { data: modelsData, isLoading: loadingModels } = useQuery({
    queryKey: ["systemModels"],
    queryFn: () => orbiterApi.getModels(),
  })

  // 3. Fetch Profiles
  const { data: profilesData } = useQuery({
    queryKey: ["systemProfiles"],
    queryFn: () => orbiterApi.getProfiles(),
  })

  // 4. Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: { key: string; value: string }[]) => orbiterApi.updateSettings(settings),
    onSuccess: (data) => {
      setToastMessage(data.message || "Settings updated successfully!")
      queryClient.invalidateQueries({ queryKey: ["systemConfig"] })
      setTimeout(() => setToastMessage(""), 3000)
    }
  })

  // Sync details when config is loaded
  React.useEffect(() => {
    if (configData?.success && configData.config) {
      const c = configData.config
      if (c.workspaceName) setWorkspaceName(c.workspaceName)
      if (c.llm?.defaultModel) setDefaultModel(c.llm.defaultModel)
      if (c.llm?.temperature) setTemperature(parseFloat(c.llm.temperature))
      if (c.llm?.maxTokens) setMaxTokens(parseInt(c.llm.maxTokens))
    }
  }, [configData])

  React.useEffect(() => {
    if (modelsData?.success && modelsData.models.length > 0 && !defaultModel) {
      setDefaultModel(modelsData.models[0].id)
    }
  }, [modelsData, defaultModel])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    const payload = [
      { key: "workspace.name", value: workspaceName },
      { key: "llm.defaultModel", value: defaultModel },
      { key: "llm.temperature", value: temperature.toString() },
      { key: "llm.maxTokens", value: maxTokens.toString() }
    ]

    // Key updates if modified
    if (!geminiKey.includes("••••")) {
      payload.push({ key: "llm.geminiKey", value: geminiKey })
    }
    if (!openaiKey.includes("••••")) {
      payload.push({ key: "llm.openaiKey", value: openaiKey })
    }

    updateSettingsMutation.mutate(payload)
  }

  const isLoading = loadingConfig || loadingModels

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-semibold">Reading configuration settings...</p>
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
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure default LLM settings, manage API secret keys, and customize workflow properties.
        </p>
      </div>

      {/* Settings Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="flex flex-col gap-1 bg-card/45 border border-border/50 p-3 rounded-xl backdrop-blur-md shadow-xs">
          {[
            { id: "general", label: "General Workspace", icon: Settings },
            { id: "keys", label: "LLM API Credentials", icon: Key },
            { id: "parameters", label: "Agent Parameters", icon: Sliders }
          ].map((tab) => {
            const Icon = tab.icon
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
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
          
          {/* TAB 1: GENERAL SETTINGS */}
          {activeTab === "general" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">General Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Customize global workspace settings.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Workspace Alias</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full h-10 px-3.5 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all dark:bg-background/25"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Default Agent Model Engine</label>
                  <select
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25 font-semibold"
                  >
                    {modelsData?.success && modelsData.models.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Available Browser Profiles</label>
                  <div className="p-3 bg-background/30 rounded-lg border border-border/40 space-y-1 text-xs">
                    {profilesData?.success && profilesData.profiles.map((p: any) => (
                      <div key={p.name} className="flex justify-between font-mono text-[10px] text-muted-foreground">
                        <span>Profile: {p.name}</span>
                        <span>{p.hasSavedState ? "Saved state active" : "Empty profile"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LLM KEYS */}
          {activeTab === "keys" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">API Credentials</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Define API keys to allow agents access to external inference engines.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Google Gemini API Key</label>
                  <div className="relative group">
                    <input
                      type={showGemini ? "text" : "password"}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full h-10 pl-3.5 pr-10 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all dark:bg-background/25 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGemini(!showGemini)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showGemini ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">OpenAI Secret Key</label>
                  <div className="relative group">
                    <input
                      type={showOpenai ? "text" : "password"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="w-full h-10 pl-3.5 pr-10 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all dark:bg-background/25 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenai(!showOpenai)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showOpenai ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AGENT PARAMETERS */}
          {activeTab === "parameters" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Inference parameters</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Fine-tune token and temperature attributes for default routing nodes.</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-medium text-muted-foreground">Model Temperature</label>
                    <span className="font-mono font-bold text-primary">{temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                    <span>Deterministic</span>
                    <span>Creative / Agentic</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-medium text-muted-foreground">Max Output Token Limit</label>
                    <span className="font-mono font-bold text-primary">{maxTokens} tokens</span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="8192"
                    step="256"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Footer Bar */}
          <div className="flex items-center justify-between pt-5 border-t border-border/50 mt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="size-4 text-primary shrink-0" />
              <span className="text-[10px] leading-normal font-semibold">API secrets are masked for safety.</span>
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
