"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import { orbiterApi } from "@/lib/endpoint"
import {
  Activity,
  Cpu,
  Filter,
  Play,
  Pause,
  Square,
  RotateCcw,
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
  title?: string
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
  const [customTitle, setCustomTitle] = React.useState("")
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [editedTitle, setEditedTitle] = React.useState("")

  // Selection state
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(initialId)
  const [selectedStepNumber, setSelectedStepNumber] = React.useState<number | null>(null)
  


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

  // 2. Fetch selected session details (with short polling when active)
  const { data: detailsData, isLoading: loadingDetails } = useQuery({
    queryKey: ["sessionDetails", selectedSessionId],
    queryFn: () => selectedSessionId ? orbiterApi.getSessionDetails(selectedSessionId, true) : Promise.resolve(null),
    enabled: !!selectedSessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.session?.status;
      return (status === "running" || status === "queued") ? 2000 : false;
    }
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

  // 5.5 Fetch user settings
  const { data: settingsData } = useQuery({
    queryKey: ["userSettings"],
    queryFn: () => orbiterApi.getSettings()
  })

  const isInitialSyncDoneRef = React.useRef(false)

  // Sync initial configuration from database user settings
  React.useEffect(() => {
    if (settingsData?.success && settingsData.settings && !isInitialSyncDoneRef.current) {
      const sMap = new Map<string, string>()
      for (const s of settingsData.settings) {
        sMap.set(s.key, s.value)
      }
      
      const dbModel = sMap.get("llm.model")
      const dbProfile = sMap.get("browser.profile")
      const dbHeadless = sMap.get("browser.headless")
      const dbMaxSteps = sMap.get("execution.maxSteps")

      if (dbModel) setSelectedModel(dbModel)
      if (dbProfile) setSelectedProfile(dbProfile)
      if (dbHeadless !== undefined) setHeadless(dbHeadless === "true")
      if (dbMaxSteps) setMaxSteps(parseInt(dbMaxSteps, 10))

      isInitialSyncDoneRef.current = true
    }
  }, [settingsData])

  // Debounced auto-save config settings to database on state change
  React.useEffect(() => {
    if (!isInitialSyncDoneRef.current) return

    const timer = setTimeout(() => {
      orbiterApi.updateSettings([
        { key: "llm.model", value: selectedModel },
        { key: "browser.profile", value: selectedProfile },
        { key: "browser.headless", value: headless.toString() },
        { key: "execution.maxSteps", value: maxSteps.toString() },
      ]).then(() => {
        queryClient.invalidateQueries({ queryKey: ["userSettings"] })
      }).catch((err) => {
        console.error("Failed to auto-save settings:", err)
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [selectedModel, selectedProfile, headless, maxSteps, queryClient])


  // 6. Spawn Mutation
  const spawnMutation = useMutation({
    mutationFn: (payload: any) => orbiterApi.runTask(payload),
    onSuccess: (data) => {
      setPrompt("")
      setCustomTitle("")
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

  // 7.6. Pause Session Mutation
  const pauseMutation = useMutation({
    mutationFn: (id: string) => orbiterApi.pauseSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      queryClient.invalidateQueries({ queryKey: ["sessionDetails", selectedSessionId] })
    }
  })

  // 7.7. Resume Session Mutation
  const resumeMutation = useMutation({
    mutationFn: (id: string) => orbiterApi.resumeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      queryClient.invalidateQueries({ queryKey: ["sessionDetails", selectedSessionId] })
    }
  })

  // 7.8. Stop Session Mutation
  const stopMutation = useMutation({
    mutationFn: (id: string) => orbiterApi.stopSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      queryClient.invalidateQueries({ queryKey: ["sessionDetails", selectedSessionId] })
    }
  })

  // 7.9. Rerun Session Mutation
  const rerunMutation = useMutation({
    mutationFn: (id: string) => orbiterApi.rerunSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      queryClient.invalidateQueries({ queryKey: ["sessionDetails", selectedSessionId] })
      queryClient.invalidateQueries({ queryKey: ["sessionLogs", selectedSessionId] })
    }
  })


  // 7.5. Rename Session Mutation
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => orbiterApi.updateSessionTitle(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      queryClient.invalidateQueries({ queryKey: ["sessionDetails", selectedSessionId] })
      setIsEditingTitle(false)
    }
  })

  const handleSaveTitle = () => {
    if (!selectedSessionId || !editedTitle.trim()) {
      setIsEditingTitle(false)
      return
    }
    renameMutation.mutate({ id: selectedSessionId, title: editedTitle.trim() })
  }

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
  }, [detailsData])



  const handleLaunchSession = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || prompt.length < 5) return

    spawnMutation.mutate({
      prompt,
      model: selectedModel || undefined,
      profile: selectedProfile || undefined,
      headless,
      maxSteps,
      title: customTitle.trim() || undefined
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
                        <span className="truncate max-w-[120px]">{session.title || session.id}</span>
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
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-muted-foreground">Session Name (optional)</label>
                      <input
                        type="text"
                        placeholder="Give your session a short name (defaults to 'New Session')"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="w-full h-8 px-2 text-[11px] bg-background/50 border border-border rounded-lg text-foreground font-semibold placeholder:text-muted-foreground/50"
                      />
                    </div>
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
                    detailsData?.session?.status === "paused" ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                    detailsData?.session?.status === "stopped" ? "bg-neutral-500/10 text-neutral-600 border-neutral-500/20" :
                    "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  )}>
                    {detailsData?.session?.status}
                  </span>
                  
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') setIsEditingTitle(false)
                      }}
                      autoFocus
                      className="px-2 py-0.5 text-xs bg-background border border-primary rounded-md outline-hidden font-semibold max-w-[180px] md:max-w-xs"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditedTitle(detailsData?.session?.title || detailsData?.session?.id || "")
                        setIsEditingTitle(true)
                      }}
                      className="truncate text-xs font-semibold hover:text-primary hover:bg-muted/30 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all text-left"
                      title="Click to rename session"
                    >
                      <span>{detailsData?.session?.title || "New Session"}</span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">({selectedSessionId})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Real-time execution controls */}
                  {selectedSessionId && detailsData?.session && (
                    <div className="flex items-center gap-1.5 border-r border-border/40 pr-2 mr-1">
                      {/* Pause button */}
                      {(detailsData.session.status === "running" || detailsData.session.status === "queued") && (
                        <button
                          onClick={() => pauseMutation.mutate(selectedSessionId)}
                          disabled={pauseMutation.isPending}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
                          title="Pause execution"
                        >
                          <Pause className="size-3.5" />
                        </button>
                      )}

                      {/* Resume button */}
                      {detailsData.session.status === "paused" && (
                        <button
                          onClick={() => resumeMutation.mutate(selectedSessionId)}
                          disabled={resumeMutation.isPending}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-emerald-500 hover:text-emerald-600 flex items-center justify-center transition-all cursor-pointer"
                          title="Resume execution"
                        >
                          <Play className="size-3.5" />
                        </button>
                      )}

                      {/* Stop button */}
                      {(detailsData.session.status === "running" || detailsData.session.status === "queued" || detailsData.session.status === "paused") && (
                        <button
                          onClick={() => stopMutation.mutate(selectedSessionId)}
                          disabled={stopMutation.isPending}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-rose-500 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
                          title="Stop execution"
                        >
                          <Square className="size-3.5 fill-rose-500/10" />
                        </button>
                      )}

                      {/* Re-run button */}
                      {(detailsData.session.status === "completed" || detailsData.session.status === "failed" || detailsData.session.status === "stopped") && (
                        <button
                          onClick={() => rerunMutation.mutate(selectedSessionId)}
                          disabled={rerunMutation.isPending}
                          className="h-7 px-2.5 gap-1.5 rounded-lg hover:bg-muted text-primary hover:text-primary/80 flex items-center justify-center transition-all cursor-pointer text-[10px] font-bold border border-border"
                          title="Re-run session"
                        >
                          <RotateCcw className="size-3" /> Re-run
                        </button>
                      )}
                    </div>
                  )}
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

                    {/* Active Running/Paused Streaming Bubble */}
                    {(detailsData.session.status === "running" || detailsData.session.status === "queued" || detailsData.session.status === "paused") && (
                      <div className="flex gap-3 max-w-[85%]">
                        <div className="size-7 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 text-primary">
                          {detailsData.session.status === "paused" ? (
                            <Pause className="size-3.5 text-amber-500 animate-pulse" />
                          ) : (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                        </div>
                        <div className="p-4 rounded-2xl rounded-tl-none bg-card/45 border border-border/40 shadow-xs flex-1 space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-primary font-bold">
                            {detailsData.session.status === "paused" ? (
                              <>
                                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-amber-500">Agent execution is paused.</span>
                              </>
                            ) : (
                              <>
                                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Agent is executing tools in the browser...</span>
                              </>
                            )}
                          </div>

                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-20 text-center text-xs text-muted-foreground">Session trace not found.</div>
                )}
                <div ref={messagesEndRef} />
              </div>


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
