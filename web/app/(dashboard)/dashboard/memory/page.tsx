"use client"

import * as React from "react"
import {
  Brain,
  Database,
  Info,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MemoryRecord {
  key: string
  namespace: "user-preferences" | "billing-records" | "context-summaries"
  value: string
  score?: number // Simulating vector closeness score
  updatedAt: string
}

const initialMemories: MemoryRecord[] = [
  { key: "pref:theme", namespace: "user-preferences", value: "dark", score: 0.98, updatedAt: "2m ago" },
  { key: "pref:editor_mode", namespace: "user-preferences", value: "vim", score: 0.94, updatedAt: "12m ago" },
  { key: "bill:plan", namespace: "billing-records", value: "enterprise_tiered_annual", score: 0.89, updatedAt: "1h ago" },
  { key: "bill:token_limit", namespace: "billing-records", value: "10,000,000", score: 0.82, updatedAt: "4h ago" },
  { key: "context:summarize_project", namespace: "context-summaries", value: "The Orbiter platform builds next-generation multi-agent execution graphs...", score: 0.76, updatedAt: "1d ago" },
  { key: "context:recent_errors", namespace: "context-summaries", value: "Errors related to node-link Bezier curves on smaller mobile screens.", score: 0.72, updatedAt: "2d ago" },
]

export default function MemoryPage() {
  const [memories, setMemories] = React.useState<MemoryRecord[]>(initialMemories)
  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"All" | "user-preferences" | "billing-records" | "context-summaries">("All")
  
  // New Memory Modal/Form state
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newKey, setNewKey] = React.useState("")
  const [newNamespace, setNewNamespace] = React.useState<"user-preferences" | "billing-records" | "context-summaries">("user-preferences")
  const [newValue, setNewValue] = React.useState("")

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKey || !newValue) return

    const newRecord: MemoryRecord = {
      key: newKey,
      namespace: newNamespace,
      value: newValue,
      score: 1.0,
      updatedAt: "Just now"
    }

    setMemories([newRecord, ...memories])
    setNewKey("")
    setNewValue("")
    setShowAddForm(false)
  }

  const handleDeleteMemory = (keyToDelete: string) => {
    setMemories(memories.filter(m => m.key !== keyToDelete))
  }

  const filteredMemories = memories.filter(m => {
    const matchesSearch = m.key.toLowerCase().includes(search.toLowerCase()) || m.value.toLowerCase().includes(search.toLowerCase())
    if (activeTab === "All") return matchesSearch
    return m.namespace === activeTab && matchesSearch
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Memory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, inspect, and update the long-term context memory stores and vector keys utilized by your workflows.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all cursor-pointer shadow-xs shadow-primary/10"
        >
          <Plus className="size-4" />
          Inject Memory Record
        </button>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { name: "Long-term Vector Index", val: "4,821 keys", info: "99.8% precision index" },
          { name: "Active Namespace Spaces", val: "3 databases", info: "In-memory Redis cached" },
          { name: "Recent Cache Hit Rate", val: "94.2%", info: "+2.5% vs last week" }
        ].map((stat, i) => (
          <div key={i} className="border border-border/50 bg-card/45 backdrop-blur-md p-5 rounded-xl shadow-xs">
            <span className="text-xs font-medium text-muted-foreground">{stat.name}</span>
            <p className="text-2xl font-bold mt-1 tracking-tight">{stat.val}</p>
            <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">{stat.info}</span>
          </div>
        ))}
      </div>

      {/* Add Memory Modal/Form Overlay (collapsible panel) */}
      {showAddForm && (
        <div className="border border-primary/25 bg-primary/5 p-6 rounded-xl space-y-4 animate-slide-down">
          <div className="flex items-center gap-2 text-primary">
            <Brain className="size-5" />
            <h3 className="text-sm font-semibold">Inject Custom Memory Key</h3>
          </div>
          <form onSubmit={handleAddMemory} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Namespace</label>
              <select
                value={newNamespace}
                onChange={(e) => setNewNamespace(e.target.value as any)}
                className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg outline-hidden focus:border-primary transition-all"
              >
                <option value="user-preferences">User Preferences</option>
                <option value="billing-records">Billing Records</option>
                <option value="context-summaries">Context Summaries</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Key Identifier</label>
              <input
                type="text"
                placeholder="e.g. pref:timezone"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                required
                className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg outline-hidden focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Value</label>
              <input
                type="text"
                placeholder="e.g. America/New_York"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                required
                className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg outline-hidden focus:border-primary transition-all"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-8 px-4 rounded-lg text-xs font-semibold hover:bg-muted transition-all cursor-pointer border border-border bg-background"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all cursor-pointer"
              >
                Save Memory Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Memory Inspector Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card/45 backdrop-blur-md">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search keys, values or descriptors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border text-xs font-medium text-muted-foreground">
          {(["All", "user-preferences", "billing-records", "context-summaries"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap capitalize",
                activeTab === tab ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
              )}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Table / Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMemories.length > 0 ? (
          filteredMemories.map((mem) => (
            <div
              key={mem.key}
              className="border border-border/50 bg-card/45 backdrop-blur-md p-5 rounded-xl shadow-xs flex flex-col justify-between gap-4 hover:border-border transition-all duration-200"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-semibold text-primary break-all font-mono">{mem.key}</span>
                  <span className={cn(
                    "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border capitalize",
                    mem.namespace === "user-preferences" ? "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400" :
                    mem.namespace === "billing-records" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" :
                    "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400"
                  )}>
                    <Tag className="size-2.5" />
                    {mem.namespace.replace("-", " ")}
                  </span>
                </div>
                <div className="p-3 bg-background/50 rounded-lg border border-border/40 text-xs text-foreground font-medium break-words leading-relaxed">
                  {mem.value}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/30">
                <span className="flex items-center gap-1">
                  <Database className="size-3.5 text-primary" />
                  Vector score: <strong className="text-foreground">{mem.score ? mem.score.toFixed(2) : "1.00"}</strong>
                </span>
                <div className="flex items-center gap-3">
                  <span>Updated {mem.updatedAt}</span>
                  <button
                    onClick={() => handleDeleteMemory(mem.key)}
                    className="p-1 rounded-sm hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-all cursor-pointer"
                    title="Delete Memory"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 border border-dashed border-border py-12 text-center text-muted-foreground rounded-xl">
            No memories found matching the filter or search query.
          </div>
        )}
      </div>

      <div className="border border-border/40 p-4 rounded-xl bg-muted/10 flex items-center gap-2.5">
        <Info className="size-4.5 text-primary shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-normal">
          Memories are persistently read by agent models during multi-hop reasoning loops. Vector closeness score measures relevance relative to current conversation parameters.
        </p>
      </div>
    </div>
  )
}
