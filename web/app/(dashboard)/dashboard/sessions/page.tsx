"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import { orbiterApi } from "@/lib/endpoint"
import {
  Activity,
  Cpu,
  Filter,
  Plus,
  Search,
  Terminal,
  Trash2,
  Loader2,
  Calendar,
  Layers,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Bot,
  User as UserIcon,
  Sparkles,
  Settings2,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SearchableSelect } from "@/components/ui/searchable-select"

interface Session {
  id: string
  goal: string
  model: string
  provider: string
  status: "queued" | "running" | "completed" | "failed"
  stepCount: number
  createdAt: number
  completedAt: number | null
}

interface Step {
  stepNumber: number
  toolName: string
  resultSummary: string
  success: boolean
  duration: number
  fullResult?: any
}

interface ExtractedData {
  stepNumber: number
  toolName: string
  itemCount: number
  data: any[]
}

function JsonColorizer({ data }: { data: any }) {
  const jsonString = JSON.stringify(data, null, 2)
  const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g
  
  const parts: Array<{ text: string; className: string }> = []
  let lastIndex = 0
  let match
  
  while ((match = regex.exec(jsonString)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: jsonString.slice(lastIndex, match.index),
        className: "text-muted-foreground"
      })
    }
    
    const token = match[0]
    let className = "text-foreground"
    
    if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        className = "text-sky-400 font-semibold"
      } else {
        className = "text-emerald-400 font-semibold"
      }
    } else if (/^(true|false)$/.test(token)) {
      className = "text-purple-400 font-bold"
    } else if (token === 'null') {
      className = "text-rose-400 italic"
    } else {
      className = "text-amber-400 font-bold"
    }
    
    parts.push({
      text: token,
      className
    })
    
    lastIndex = regex.lastIndex
  }
  
  if (lastIndex < jsonString.length) {
    parts.push({
      text: jsonString.slice(lastIndex),
      className: "text-muted-foreground"
    })
  }
  
  return (
    <pre className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) => (
        <span key={i} className={p.className}>
          {p.text}
        </span>
      ))}
    </pre>
  )
}

function SessionsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialId = searchParams.get("id")
  const queryClient = useQueryClient()

  // Local search and filter states
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<"All" | "running" | "completed" | "failed">("All")

  // Spawning form configuration states
  const [prompt, setPrompt] = React.useState("")
  const [selectedModel, setSelectedModel] = React.useState("")
  const [selectedProfile, setSelectedProfile] = React.useState("default")
  const [headless, setHeadless] = React.useState(true)
  const [maxSteps, setMaxSteps] = React.useState(20)
  const [showConfigPanel, setShowConfigPanel] = React.useState(false)
  const [isCreatingNewChat, setIsCreatingNewChat] = React.useState(false)

  // Selection state
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(initialId)
  const [selectedStepNumber, setSelectedStepNumber] = React.useState<number | null>(null)
  
  // SSE stream local states
  const [streamLogs, setStreamLogs] = React.useState<{ type: string; message: string; timestamp: number }[]>([])
  const [showLogsPanel, setShowLogsPanel] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // 1. Fetch sessions list using useInfiniteQuery for infinite scroll pagination
  const {
    data: infiniteSessionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingList,
  } = useInfiniteQuery({
    queryKey: ["sessions", search, filter],
    queryFn: ({ pageParam = 1 }) => orbiterApi.getSessions(pageParam, 15, search, filter),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.pagination;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    refetchInterval: (query) => {
      // Poll if there is any active session in any of the fetched pages
      const hasActive = query.state.data?.pages?.some((page: any) =>
        page.sessions?.some((s: Session) => s.status === "running" || s.status === "queued")
      );
      return hasActive ? 3000 : false;
    }
  })

  // Flat map the paginated session records
  const sessions = React.useMemo(() => {
    return infiniteSessionsData
      ? infiniteSessionsData.pages.flatMap((page) => page.sessions)
      : [];
  }, [infiniteSessionsData]);

  // 2. Fetch selected session details
  const { data: detailsData, isLoading: loadingDetails } = useQuery({
    queryKey: ["sessionDetails", selectedSessionId],
    queryFn: () => selectedSessionId ? orbiterApi.getSessionDetails(selectedSessionId, true) : Promise.resolve(null),
    enabled: !!selectedSessionId
  })

  // 3. Fetch selected session data
  const { data: extractedDataResponse } = useQuery({
    queryKey: ["sessionData", selectedSessionId],
    queryFn: () => selectedSessionId ? orbiterApi.getSessionData(selectedSessionId) : Promise.resolve(null),
    enabled: !!selectedSessionId && (detailsData?.session?.status === "completed" || detailsData?.session?.status === "failed")
  })

  // 4. Fetch spawn models list
  const { data: modelsData } = useQuery({
    queryKey: ["systemModels"],
    queryFn: () => orbiterApi.getModels()
  })

  // 5. Fetch spawn profiles list
  const { data: profilesData } = useQuery({
    queryKey: ["systemProfiles"],
    queryFn: () => orbiterApi.getProfiles()
  })

  // 6. Spawn Mutation
  const spawnMutation = useMutation({
    mutationFn: (payload: any) => orbiterApi.runTask(payload),
    onSuccess: (data) => {
      setPrompt("")
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      router.push(`/dashboard/sessions?id=${data.sessionId}`)
    }
  })

  // 7. Delete Session Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => orbiterApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      if (selectedSessionId) {
        router.push("/dashboard/sessions")
      }
    }
  })

  // Set default model once loaded
  React.useEffect(() => {
    if (modelsData?.success && modelsData.models.length > 0 && !selectedModel) {
      setSelectedModel(modelsData.models[0].id)
    }
  }, [modelsData, selectedModel])

  // Sync selected session ID from URL query parameters
  React.useEffect(() => {
    const id = searchParams.get("id")
    setSelectedSessionId(id)
    if (id) {
      setIsCreatingNewChat(false)
    }
  }, [searchParams])

  // Reset selected step when selectedSessionId changes
  React.useEffect(() => {
    setSelectedStepNumber(null)
  }, [selectedSessionId])

  // Scroll to bottom on logs update or new steps
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [streamLogs, detailsData])

  // SSE Stream integration for running sessions
  React.useEffect(() => {
    let eventSource: EventSource | null = null

    if (!selectedSessionId) {
      setStreamLogs([])
      return
    }

    const isActive = detailsData?.session
      ? (detailsData.session.status === "running" || detailsData.session.status === "queued")
      : true

    if (isActive) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('orbiter_token') : '';
      const sseUrl = token
        ? `/api/v1/execution/stream/${selectedSessionId}?token=${encodeURIComponent(token)}`
        : `/api/v1/execution/stream/${selectedSessionId}`;
      eventSource = new EventSource(sseUrl)

      eventSource.addEventListener("connected", () => {
        setStreamLogs(prev => [...prev, { type: "system", message: "SSE Connection established.", timestamp: Date.now() }])
      })

      eventSource.addEventListener("status", (e: any) => {
        const data = JSON.parse(e.data)
        setStreamLogs(prev => [...prev, { type: "status", message: `Status updated: ${data.status}`, timestamp: Date.now() }])
        queryClient.invalidateQueries({ queryKey: ["sessions"] })
        queryClient.invalidateQueries({ queryKey: ["sessionDetails", selectedSessionId] })
      })

      eventSource.addEventListener("step", (e: any) => {
        const data = JSON.parse(e.data)
        setStreamLogs(prev => [
          ...prev,
          { 
            type: "step", 
            message: `Step ${data.stepNumber}: Executed [${data.toolName}] - ${data.success ? 'Success' : 'Failed'}`, 
            timestamp: Date.now() 
          }
        ])
        queryClient.invalidateQueries({ queryKey: ["sessionDetails", selectedSessionId] })
      })

      eventSource.addEventListener("log", (e: any) => {
        const data = JSON.parse(e.data)
        setStreamLogs(prev => [...prev, { type: "log", message: data.message, timestamp: Date.now() }])
      })

      eventSource.onerror = () => {
        eventSource?.close()
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [selectedSessionId, detailsData, queryClient])

  const handleLaunchSession = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || prompt.length < 5) return

    spawnMutation.mutate({
      prompt,
      model: selectedModel || undefined,
      profile: selectedProfile || undefined,
      headless,
      maxSteps
    })
  }

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) return
    deleteMutation.mutate(id)
  }

  // Handle scroll event for infinite pagination trigger
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden animate-fade-in text-xs">
      
      {/* ─── LEFT SIDEBAR: CHAT THREADS HISTORY ─── */}
      <div className={cn(
        "w-full md:w-80 border-r border-border/50 bg-card/45 flex flex-col shrink-0",
        (selectedSessionId || isCreatingNewChat) ? "hidden md:flex" : "flex"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/50 flex flex-col gap-3">
          <button
            onClick={() => {
              router.push("/dashboard/sessions")
              setPrompt("")
              setIsCreatingNewChat(true)
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-primary/40 text-[11px] font-bold text-primary hover:text-primary-foreground hover:bg-primary transition-all cursor-pointer shadow-xs shadow-primary/5"
          >
            <Plus className="size-4" />
            New Automation Chat
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-[11px] bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all font-semibold"
            />
          </div>

          <div className="flex gap-1 bg-muted/40 p-0.5 rounded-lg border text-[10px] font-bold text-muted-foreground">
            {(["All", "running", "completed", "failed"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={cn(
                  "flex-1 py-1 rounded-md transition-all cursor-pointer capitalize text-center",
                  filter === opt ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Chat List */}
        <div 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-2.5 space-y-1"
        >
          {loadingList && sessions.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-5 text-primary animate-spin" />
              <span className="text-[10px] text-muted-foreground">Loading chats...</span>
            </div>
          ) : sessions.length > 0 ? (
            <>
              {sessions.map((session: Session) => {
                const isSelected = selectedSessionId === session.id
                return (
                  <div
                    key={session.id}
                    onClick={() => router.push(`/dashboard/sessions?id=${session.id}`)}
                    className={cn(
                      "group relative p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1 border border-transparent",
                      isSelected 
                        ? "bg-primary/10 border-primary/20 text-foreground" 
                        : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold font-mono">
                        <span className={cn(
                          "size-1.5 rounded-full",
                          session.status === "running" ? "bg-emerald-500 animate-pulse" :
                          session.status === "completed" ? "bg-blue-500" :
                          session.status === "queued" ? "bg-amber-500" : "bg-rose-500"
                        )} />
                        <span className="truncate max-w-[120px]">{session.id}</span>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        disabled={deleteMutation.isPending}
                        className="p-0.5 rounded-md hover:bg-rose-500/15 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                    
                    <p className="text-[11px] font-semibold leading-snug line-clamp-2 pr-2">
                      {session.goal}
                    </p>

                    <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/60 pt-1 border-t border-border/10 mt-1">
                      <span className="flex items-center gap-0.5"><Clock className="size-2.5" /> {session.stepCount} steps</span>
                      <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })}

              {/* Infinite load status */}
              {isFetchingNextPage && (
                <div className="py-3 text-center flex items-center justify-center gap-1.5 text-muted-foreground text-[10px] font-semibold">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  <span>Loading more...</span>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">No chats found.</div>
          )}
        </div>
      </div>

      {/* ─── MAIN CONVERSATION PANE ─── */}
      <div className={cn(
        "flex-1 flex flex-col bg-background/30 overflow-hidden relative",
        (!selectedSessionId && !isCreatingNewChat) ? "hidden md:flex" : "flex"
      )}>
        
        {!selectedSessionId ? (
          /* ─── LANDING SCREEN: CHAT CONFIG / SPAWN ─── */
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 max-w-2xl mx-auto space-y-6 w-full relative">
            {isCreatingNewChat && (
              <button
                type="button"
                onClick={() => setIsCreatingNewChat(false)}
                className="md:hidden self-start flex items-center gap-1 text-muted-foreground hover:text-foreground font-bold text-xs mb-2"
              >
                <ChevronLeft className="size-4" /> Back to History
              </button>
            )}
            <div className="text-center space-y-2">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary shadow-xs">
                <Sparkles className="size-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Orbiter Agent Studio</h2>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Describe a web automation goal, and the AI agent will spawn a browser instance and perform steps to extract data or complete tasks.
              </p>
            </div>

            <form onSubmit={handleLaunchSession} className="w-full space-y-4">
              <div className="p-4 rounded-xl border border-border/60 bg-card/65 space-y-4 shadow-sm">
                
                {/* Custom Configuration Trigger */}
                <div className="flex items-center justify-between text-[11px] border-b border-border/30 pb-2.5 font-bold">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Settings2 className="size-4 text-primary" /> Configuration Settings
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowConfigPanel(!showConfigPanel)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {showConfigPanel ? "Hide Config" : "Show Config"}
                  </button>
                </div>

                {showConfigPanel && (
                  <div className="grid grid-cols-2 gap-4 text-[11px] font-semibold animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">LLM Engine</label>
                      {modelsData?.provider === "openrouter" ? (
                        <SearchableSelect
                          options={modelsData?.success ? modelsData.models : []}
                          value={selectedModel}
                          onChange={setSelectedModel}
                          placeholder="Select LLM Engine..."
                          size="sm"
                        />
                      ) : (
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full h-8 px-2 text-[11px] bg-background/50 border border-border rounded-lg text-foreground font-semibold"
                        >
                          {modelsData?.success && modelsData.models.length > 0 ? (
                            modelsData.models.map((m: any) => (
                              <option key={m.id} value={m.id} className="bg-neutral-950">
                                {m.name}
                              </option>
                            ))
                          ) : (
                            <option value="">No models available</option>
                          )}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Chrome Profile</label>
                      <select
                        value={selectedProfile}
                        onChange={(e) => setSelectedProfile(e.target.value)}
                        className="w-full h-8 px-2 text-[11px] bg-background/50 border border-border rounded-lg text-foreground font-semibold"
                      >
                        {profilesData?.success && profilesData.profiles.length > 0 ? (
                          profilesData.profiles.map((p: any) => (
                            <option key={p.name} value={p.name} className="bg-neutral-950">
                              {p.name}
                            </option>
                          ))
                        ) : (
                          <option value="default">default</option>
                        )}
                      </select>
                    </div>

                    <div className="col-span-2 flex items-center justify-between border-t border-border/20 pt-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id="headless-mode-setup"
                          checked={headless}
                          onChange={(e) => setHeadless(e.target.checked)}
                          className="size-3.5 rounded border-border text-primary"
                        />
                        <label htmlFor="headless-mode-setup" className="text-[11px] text-muted-foreground cursor-pointer select-none">
                          Run Headless (no visual browser popup)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Max Steps:</span>
                        <input
                          type="number"
                          min="5"
                          max="100"
                          value={maxSteps}
                          onChange={(e) => setMaxSteps(parseInt(e.target.value))}
                          className="w-12 h-6 px-1 text-center bg-background/50 border border-border rounded-md font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Prompt Chat Box Input */}
                <div className="relative flex items-end bg-background/40 border border-border rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary transition-all">
                  <textarea
                    required
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask the agent to automate something... e.g. Navigate to google, search for deepmind, grab recent links"
                    className="flex-1 w-full p-0 bg-transparent border-0 outline-hidden resize-none text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:ring-0 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={spawnMutation.isPending || !prompt.trim()}
                    className="shrink-0 size-8 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer shadow-xs shadow-primary/10 ml-2"
                  >
                    {spawnMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          /* ─── CONVERSATION CHAT TIMELINE VIEW ─── */
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Portion: Chat Message Stream */}
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-background/10">
              
              {/* Chat Session Header */}
              <div className="px-4 py-3 border-b border-border/50 bg-card/45 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => {
                      router.push("/dashboard/sessions")
                      setIsCreatingNewChat(false)
                    }}
                    className="md:hidden p-1 -ml-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer mr-1"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                    detailsData?.session?.status === "running" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                    detailsData?.session?.status === "completed" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                    detailsData?.session?.status === "queued" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                    "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  )}>
                    {detailsData?.session?.status}
                  </span>
                  
                  <div className="truncate text-xs font-semibold text-muted-foreground/80 font-mono">
                    Session: {selectedSessionId}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLogsPanel(!showLogsPanel)}
                    className={cn(
                      "h-7 px-3 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all cursor-pointer",
                      showLogsPanel ? "bg-primary/10 border-primary/20 text-primary" : "border-border hover:bg-muted"
                    )}
                  >
                    <Terminal className="size-3" /> Logs Console
                  </button>
                </div>
              </div>

              {/* Chat Message Scroll Window */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {loadingDetails ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-6 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Fetching trace history...</span>
                  </div>
                ) : detailsData?.success ? (
                  <>
                    {/* User Prompt (Initial Message) */}
                    <div className="flex gap-3 max-w-[85%] ml-auto justify-end">
                      <div className="bg-primary/95 text-primary-foreground p-3.5 rounded-2xl rounded-tr-none shadow-md space-y-1">
                        <span className="text-[8px] uppercase tracking-wider font-extrabold opacity-60 flex items-center gap-1"><UserIcon className="size-2.5" /> User Goal</span>
                        <p className="text-xs leading-relaxed font-semibold">{detailsData.session.goal}</p>
                      </div>
                    </div>

                    {/* Agent Chronological Step Messages */}
                    {detailsData.session.steps.length > 0 ? (
                      detailsData.session.steps.map((step: Step) => {
                        const isSelected = selectedStepNumber === step.stepNumber
                        return (
                          <div
                            key={step.stepNumber}
                            onClick={() => setSelectedStepNumber(step.stepNumber)}
                            className={cn(
                              "flex gap-3 max-w-[85%] transition-all cursor-pointer",
                              isSelected ? "scale-[1.01]" : ""
                            )}
                          >
                            <div className="size-7 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 shadow-xs text-primary">
                              <Bot className="size-4" />
                            </div>

                            <div className={cn(
                              "p-4 rounded-2xl rounded-tl-none shadow-sm space-y-3 flex-1 border",
                              isSelected 
                                ? "bg-muted/30 border-primary/60 shadow-md ring-1 ring-primary/10" 
                                : "bg-card/45 border-border/40 hover:bg-muted/10"
                            )}>
                              {/* Bubble Header */}
                              <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground border-b border-border/10 pb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[8px] font-mono">
                                    Step {step.stepNumber}
                                  </span>
                                  <span className="text-foreground truncate">{step.toolName}</span>
                                </div>

                                <div className="flex items-center gap-2 font-mono">
                                  {step.success ? (
                                    <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle className="size-2.5" /> Success</span>
                                  ) : (
                                    <span className="text-rose-500 flex items-center gap-0.5"><XCircle className="size-2.5" /> Failed</span>
                                  )}
                                  <span>{step.duration}ms</span>
                                </div>
                              </div>

                              {/* Result Summary */}
                              <p className="text-xs leading-relaxed text-foreground font-semibold break-words">{step.resultSummary}</p>

                              {/* Collapsible JSON payload */}
                              {step.fullResult && (
                                <details className="group text-[10px] bg-black/5 dark:bg-black/35 rounded-lg border border-border/30 overflow-hidden font-semibold">
                                  <summary className="px-2.5 py-1.5 hover:bg-muted/30 cursor-pointer list-none flex items-center justify-between text-muted-foreground font-bold">
                                    <span>Technical Execution Result</span>
                                    <span className="text-[8px] font-mono group-open:hidden">SHOW JSON</span>
                                    <span className="text-[8px] font-mono hidden group-open:inline">HIDE JSON</span>
                                  </summary>
                                  <div className="p-2.5 border-t border-border/20 overflow-x-auto">
                                    <JsonColorizer data={step.fullResult} />
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : null}

                    {/* Extracted Data Bubble (Only rendered if session finished and has data) */}
                    {extractedDataResponse?.success && extractedDataResponse.records.length > 0 && (
                      <div className="flex gap-3 max-w-[85%]">
                        <div className="size-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="size-4" />
                        </div>
                        <div className="p-4 rounded-2xl rounded-tl-none bg-emerald-500/5 border border-emerald-500/20 shadow-xs space-y-3 flex-1 text-xs">
                          <div className="font-bold flex items-center justify-between border-b border-emerald-500/10 pb-1.5 text-emerald-500">
                            <span className="flex items-center gap-1"><FileSpreadsheet className="size-3.5" /> Extracted Structured Results</span>
                            <span>{extractedDataResponse.records.reduce((acc: number, r: any) => acc + r.itemCount, 0)} items</span>
                          </div>

                          {extractedDataResponse.records.map((record: ExtractedData, idx: number) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="font-bold text-[10px] text-muted-foreground">Step {record.stepNumber} ({record.toolName}):</div>
                              <div className="overflow-x-auto bg-black/5 dark:bg-black/35 rounded-lg p-2.5 border border-border/20">
                                <JsonColorizer data={record.data} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Running Streaming Bubble */}
                    {(detailsData.session.status === "running" || detailsData.session.status === "queued") && (
                      <div className="flex gap-3 max-w-[85%]">
                        <div className="size-7 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 text-primary">
                          <Loader2 className="size-4 animate-spin" />
                        </div>
                        <div className="p-4 rounded-2xl rounded-tl-none bg-card/45 border border-border/40 shadow-xs flex-1 space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-primary font-bold">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Agent is executing tools in the browser...</span>
                          </div>
                          
                          {/* Live Console streaming panel inside the stream card */}
                          {streamLogs.length > 0 && (
                            <div className="bg-black/5 dark:bg-black/40 border border-border/40 rounded-lg p-3 font-mono text-[9px] text-foreground space-y-1 max-h-36 overflow-y-auto">
                              {streamLogs.slice(-5).map((log, idx) => (
                                <div key={idx} className="leading-relaxed truncate">
                                  <span className="text-muted-foreground font-bold select-none">
                                    [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                                  </span>{" "}
                                  <span className={cn(
                                    log.type === "step" ? "text-blue-400 font-bold" :
                                    log.type === "status" ? "text-amber-400 font-bold" :
                                    log.type === "system" ? "text-emerald-400" : "text-muted-foreground"
                                  )}>
                                    {log.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-20 text-center text-xs text-muted-foreground">Session trace not found.</div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Collapsible Sidebar Logs Panel */}
              {showLogsPanel && (
                <div className="h-44 border-t border-border/50 bg-card/65 flex flex-col shrink-0">
                  <div className="px-3 py-1.5 border-b border-border/20 flex items-center justify-between text-[10px] font-bold text-muted-foreground bg-muted/20 shrink-0">
                    <span className="flex items-center gap-1"><Terminal className="size-3" /> Streaming Console logs</span>
                    <button onClick={() => setShowLogsPanel(false)} className="hover:text-foreground">Close</button>
                  </div>
                  <div className="flex-1 p-3 overflow-y-auto font-mono text-[9px] space-y-1 bg-black/10 text-foreground">
                    {streamLogs.length > 0 ? (
                      streamLogs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed break-all">
                          <span className="text-muted-foreground select-none">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>{" "}
                          <span className={cn(
                            log.type === "step" ? "text-blue-500 font-bold" :
                            log.type === "status" ? "text-amber-500 font-bold" :
                            log.type === "system" ? "text-emerald-500" : "text-foreground"
                          )}>
                            {log.message}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground font-sans">
                        {detailsData?.session?.status !== "running" ? "No active log stream." : "Listening for live logs..."}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SessionsPage() {
  return (
    <React.Suspense fallback={
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-semibold">Loading agent sessions...</p>
      </div>
    }>
      <SessionsContent />
    </React.Suspense>
  )
}
