"use client"

import * as React from "react"
import {
  Check,
  Eye,
  EyeOff,
  Info,
  Key,
  Save,
  Settings,
  Sliders,
  Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState<"general" | "keys" | "parameters">("general")
  const [workspaceName, setWorkspaceName] = React.useState("Admin Developer Workspace")
  const [defaultModel, setDefaultModel] = React.useState("gemini-3.5-flash")
  const [temperature, setTemperature] = React.useState(0.7)
  const [maxTokens, setMaxTokens] = React.useState(4096)

  // API Key fields
  const [geminiKey, setGeminiKey] = React.useState("gsk_••••••••••••••••••••••••••••")
  const [showGemini, setShowGemini] = React.useState(false)
  const [openaiKey, setOpenaiKey] = React.useState("sk-proj-••••••••••••••••••••••••")
  const [showOpenai, setShowOpenai] = React.useState(false)

  // Loading/Save feedback state
  const [isSaving, setIsSaving] = React.useState(false)
  const [showToast, setShowToast] = React.useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }, 1000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-emerald-500 text-white rounded-xl shadow-xl flex items-center gap-2 border border-emerald-400/20 font-semibold text-xs animate-slide-down">
          <Check className="size-4" />
          Settings updated successfully!
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
                    className="w-full h-10 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25"
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default)</option>
                    <option value="gemini-3.5-pro">Gemini 3.5 Pro</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="gpt-4o">GPT-4o Engine</option>
                  </select>
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
                <p className="text-xs text-muted-foreground mt-0.5">Fine-tune token and heat attributes for default routing nodes.</p>
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
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all disabled:opacity-60 cursor-pointer shadow-xs shadow-primary/10"
            >
              {isSaving ? (
                <div className="size-4 border-2 border-primary-foreground/35 border-t-primary-foreground rounded-full animate-spin" />
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
