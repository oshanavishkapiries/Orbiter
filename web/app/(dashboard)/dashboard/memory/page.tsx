"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { orbiterApi } from "@/lib/endpoint"
import {
  Brain,
  Database,
  Info,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  Bookmark
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectorRecord {
  id: string
  elementName: string
  elementType: string
  primarySelector: string
  confidence: number
  usageCount: number
  successCount: number
  fallbacks: any[]
}

interface VectorRecord {
  id: string
  sessionId: string | null
  domain: string
  taskSummary: string
  contextJson: any
  createdAt: number
}

export default function MemoryPage() {
  const queryClient = useQueryClient()
  const [domainInput, setDomainInput] = React.useState("google.com")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"selectors" | "vectors" | "search">("selectors")

  // Modal / Form state (Simulated UI Inject for display)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newKey, setNewKey] = React.useState("")
  const [newNamespace, setNewNamespace] = React.useState("user-preferences")
  const [newValue, setNewValue] = React.useState("")
  const [toastMessage, setToastMessage] = React.useState("")

  // Paginated Vectors state
  const [vectorPage, setVectorPage] = React.useState(1)

  // 1. Fetch Memory Stats
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["memoryStats"],
    queryFn: () => orbiterApi.getMemoryStats(),
  })

  // 2. Fetch selectors for active domain
  const { data: selectorsData, isLoading: loadingSelectors } = useQuery({
    queryKey: ["selectors", domainInput],
    queryFn: () => orbiterApi.getSelectors(domainInput, 30),
    enabled: activeTab === "selectors" && !!domainInput,
  })

  // 3. Search Selectors/Vector
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["selectorSearch", domainInput, searchQuery],
    queryFn: () => orbiterApi.searchSelectors(domainInput, searchQuery),
    enabled: activeTab === "search" && !!domainInput && !!searchQuery,
  })

  // 4. Fetch Long-term Vector Memories
  const { data: vectorsData, isLoading: loadingVectors } = useQuery({
    queryKey: ["vectors", vectorPage],
    queryFn: () => orbiterApi.getVectors(vectorPage, 10),
    enabled: activeTab === "vectors"
  })

  // 5. Clear Memory Mutation
  const clearMutation = useMutation({
    mutationFn: (params: { domain?: string; all: boolean }) => 
      orbiterApi.clearMemory(params.domain, params.all),
    onSuccess: (data) => {
      setToastMessage(data.message || "Memory cleared successfully.")
      queryClient.invalidateQueries({ queryKey: ["memoryStats"] })
      queryClient.invalidateQueries({ queryKey: ["selectors"] })
      queryClient.invalidateQueries({ queryKey: ["vectors"] })
      setTimeout(() => setToastMessage(""), 3000)
    }
  })

  const handleClearAll = () => {
    if (!confirm("Are you sure you want to clear ALL selector and context memories?")) return
    clearMutation.mutate({ all: true })
  }

  const handleClearDomain = () => {
    if (!confirm(`Are you sure you want to clear memory for domain: ${domainInput}?`)) return
    clearMutation.mutate({ domain: domainInput, all: false })
  }

  const handleInjectMemory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKey || !newValue) return
    setToastMessage(`Simulated injection of ${newKey} complete.`)
    setShowAddForm(false)
    setNewKey("")
    setNewValue("")
    setTimeout(() => setToastMessage(""), 3000)
  }

  const stats = statsData?.success ? statsData : null
  const vectorsList = vectorsData?.vectors || []
  const totalVectorPages = vectorsData?.pagination?.totalPages || 1

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast logs */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-emerald-500 text-white rounded-xl shadow-xl flex items-center gap-2 border border-emerald-400/20 font-semibold text-xs animate-slide-down">
          <Check className="size-4" />
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Memory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, inspect, and update the long-term context memory stores and vector keys utilized by your workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAll}
            disabled={clearMutation.isPending}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 border border-destructive/20 hover:bg-destructive/10 text-destructive rounded-lg text-xs font-semibold transition-all cursor-pointer bg-background/50 dark:bg-background/20"
          >
            Clear All Memory
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all cursor-pointer shadow-xs shadow-primary/10"
          >
            <Plus className="size-4" />
            Inject Memory Record
          </button>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { 
            name: "Long-term Vector Index", 
            val: loadingStats ? "..." : `${stats?.memory?.total ?? 0} keys`, 
            info: stats?.database?.host ? `Connected: ${stats.database.host}` : "Disconnected" 
          },
          { 
            name: "Memory Table Entries", 
            val: loadingStats ? "..." : `${stats?.database?.tables?.memories ?? 0} rows`, 
            info: "Postgres memories table" 
          },
          { 
            name: "Selector Memory Cache", 
            val: loadingStats ? "..." : `${stats?.database?.tables?.selectors ?? 0} selectors`, 
            info: "Postgres selectors table" 
          }
        ].map((item, i) => (
          <div key={i} className="border border-border/50 bg-card/45 backdrop-blur-md p-5 rounded-xl shadow-xs">
            <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
            <p className="text-2xl font-bold mt-1 tracking-tight">{item.val}</p>
            <span className="text-[10px] text-muted-foreground font-semibold mt-1 block">{item.info}</span>
          </div>
        ))}
      </div>

      {/* Inject Memory collapsible panel */}
      {showAddForm && (
        <div className="border border-primary/25 bg-primary/5 p-6 rounded-xl space-y-4 animate-slide-down">
          <div className="flex items-center gap-2 text-primary">
            <Brain className="size-5" />
            <h3 className="text-sm font-semibold">Inject Custom Memory Key</h3>
          </div>
          <form onSubmit={handleInjectMemory} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Namespace</label>
              <select
                value={newNamespace}
                onChange={(e) => setNewNamespace(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg outline-hidden focus:border-primary transition-all font-semibold"
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

      {/* Memory Domain Selector, Tab selector and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card/45 backdrop-blur-md">
        
        {/* Domain Target Input */}
        <div className="flex items-center gap-2">
          <Database className="size-4.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground">Target Domain:</span>
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            className="w-36 px-2.5 py-1 text-xs bg-background border border-border rounded-lg focus:border-primary outline-hidden font-bold"
          />
          <button
            onClick={handleClearDomain}
            className="text-[10px] text-destructive hover:underline font-semibold ml-1"
          >
            Clear Domain
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border text-xs font-medium text-muted-foreground">
          {(["selectors", "vectors", "search"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap capitalize",
                activeTab === tab ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
              )}
            >
              {tab === "vectors" ? "Vector Memories" : tab === "selectors" ? "Selectors list" : "Search Selectors"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab details: Selectors list */}
      {activeTab === "selectors" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingSelectors ? (
            <div className="col-span-2 py-20 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Retrieving selector memories...</span>
            </div>
          ) : selectorsData?.selectors && selectorsData.selectors.length > 0 ? (
            selectorsData.selectors.map((sel: SelectorRecord) => (
              <div
                key={sel.id}
                className="border border-border/50 bg-card/45 backdrop-blur-md p-5 rounded-xl shadow-xs flex flex-col justify-between gap-4 hover:border-border transition-all duration-200"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-primary break-all font-mono">
                      {sel.elementName} ({sel.elementType})
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border capitalize bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                      <Sparkles className="size-2.5" />
                      Confidence {sel.confidence.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 bg-black/5 dark:bg-black/40 rounded-lg border border-border/40 text-xs font-mono break-all leading-normal">
                    {sel.primarySelector}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/30">
                  <span>Usage: {sel.successCount} / {sel.usageCount} successful</span>
                  <span>ID: {sel.id.slice(0, 15)}...</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 border border-dashed border-border py-16 text-center text-muted-foreground rounded-xl">
              No selector memories found for domain "{domainInput}". Try navigating on this domain with Orbiter.
            </div>
          )}
        </div>
      )}

      {/* Tab details: Vector Memories (New Feature) */}
      {activeTab === "vectors" && (
        <div className="space-y-4">
          {loadingVectors ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Loading long-term vector context...</span>
            </div>
          ) : vectorsList.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {vectorsList.map((vec: VectorRecord) => (
                <div
                  key={vec.id}
                  className="border border-border/50 bg-card/45 backdrop-blur-md p-5 rounded-xl shadow-xs space-y-4 hover:border-border transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Bookmark className="size-4 text-emerald-500" />
                      <span className="text-xs font-bold text-foreground font-mono">{vec.id}</span>
                      <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {vec.domain}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      Created: {new Date(vec.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block tracking-wider">
                      Task Summary Context
                    </span>
                    <p className="text-xs text-foreground bg-background/50 p-3 rounded-lg border border-border/40 leading-relaxed font-semibold">
                      {vec.taskSummary}
                    </p>
                  </div>

                  {vec.contextJson && (
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block tracking-wider">
                        Metadata JSON
                      </span>
                      <pre className="text-[10px] font-mono bg-black/5 dark:bg-black/40 p-3 rounded-lg border border-border/40 overflow-x-auto text-muted-foreground leading-normal">
                        {JSON.stringify(vec.contextJson, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}

              {/* Vector Pagination */}
              {totalVectorPages > 1 && (
                <div className="p-3 flex items-center justify-between bg-muted/10 rounded-xl border border-border/50">
                  <button
                    disabled={vectorPage <= 1}
                    onClick={() => setVectorPage(vectorPage - 1)}
                    className="p-1 px-2.5 rounded-lg border border-border hover:bg-muted text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="size-3" /> Prev
                  </button>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Page {vectorPage} of {totalVectorPages}
                  </span>
                  <button
                    disabled={vectorPage >= totalVectorPages}
                    onClick={() => setVectorPage(vectorPage + 1)}
                    className="p-1 px-2.5 rounded-lg border border-border hover:bg-muted text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    Next <ChevronRight className="size-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-border py-16 text-center text-muted-foreground rounded-xl">
              No vector context records saved in the database.
            </div>
          )}
        </div>
      )}

      {/* Tab: Search */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 max-w-md bg-card border border-border/50 rounded-xl p-2 shadow-xs">
            <Search className="size-4 text-muted-foreground ml-2" />
            <input
              type="text"
              placeholder="Type pattern to query selector matches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-hidden"
            />
          </div>

          <div className="space-y-3">
            {searching ? (
              <div className="py-10 text-center flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-5 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Searching database...</span>
              </div>
            ) : searchResults?.success && searchResults.results.length > 0 ? (
              searchResults.results.map((res: any, idx: number) => (
                <div key={idx} className="p-4 border border-border/40 bg-background/50 rounded-xl flex items-center justify-between gap-4 text-xs font-semibold">
                  <div className="space-y-1">
                    <span className="text-foreground">{res.elementName}</span>
                    <p className="text-muted-foreground font-mono font-medium truncate max-w-[450px]">
                      {res.primarySelector}
                    </p>
                  </div>
                </div>
              ))
            ) : searchQuery ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No matching selectors found.
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Enter a search term above.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border border-border/40 p-4 rounded-xl bg-muted/10 flex items-center gap-2.5">
        <Info className="size-4.5 text-primary shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-normal">
          Memories are persistently read by agent models during multi-hop reasoning loops. Selectors list retrieves stored element matches to prevent full LLM search calls on re-execution.
        </p>
      </div>
    </div>
  )
}
