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
  Clock,
  ChevronDown,
  Maximize2,
  Copy,
  Check,
  X
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

function StepResultCard({ step, isSelected, onClick }: { step: Step; isSelected: boolean; onClick: () => void }) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [showModal, setShowModal] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"text" | "json">("text")
  const [copied, setCopied] = React.useState(false)

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Get the first meaningful line of resultSummary
  const getFirstMeaningfulLine = (text: string): string => {
    if (!text) return ""
    const lines = text.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
    return ""
  }

  const firstLine = getFirstMeaningfulLine(step.resultSummary)

  const toggleExpand = (e: React.MouseEvent) => {
    // Prevent toggle if clicking on interactive buttons/modal inside
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('pre')) return
    setIsExpanded(!isExpanded)
    onClick()
  }

  const rawJsonString = React.useMemo(() => {
    if (!step.fullResult) return ""
    return JSON.stringify(step.fullResult, null, 2)
  }, [step.fullResult])

  return (
    <div
      onClick={toggleExpand}
      className={cn(
        "rounded-xl border shadow-xs flex flex-col overflow-hidden select-text cursor-pointer flex-1 font-mono transition-all duration-300 ease-in-out",
        step.success
          ? "border-border/40 hover:bg-muted/10"
          : "border-l-4 border-l-rose-500 border-border/40 hover:bg-muted/10",
        isSelected
          ? "bg-muted/30 border-primary/60 shadow-md ring-1 ring-primary/10"
          : "bg-card/45",
      )}
      style={{
        maxHeight: isExpanded ? "450px" : "56px"
      }}
    >
      {/* Summary Header Row (max-h-14 / 56px collapsed area) */}
      <div className="h-[54px] px-3 flex flex-col justify-center shrink-0">
        <div className="flex items-center justify-between text-[11px] font-semibold font-mono">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">
              Step {step.stepNumber}
            </span>
            <span className="text-foreground font-bold truncate font-mono max-w-[150px] sm:max-w-[200px]">
              {step.toolName}
            </span>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-bold font-mono shrink-0",
              step.success
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-rose-500/10 text-rose-500"
            )}>
              {step.success ? "Success" : "Failed"}
            </span>
            <span className="text-muted-foreground text-[9px] font-mono shrink-0">
              {step.duration}ms
            </span>
          </div>

          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2",
              isExpanded && "rotate-180"
            )}
          />
        </div>

        {/* First meaningful line only */}
        <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5 pr-6">
          {firstLine || "No summary details available."}
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-border/20 pt-2.5 flex flex-col gap-2 overflow-hidden flex-1">
          {/* Scrollable monospace code block for resultSummary */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <pre className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[200px] bg-black/5 dark:bg-black/35 p-2.5 rounded-lg border border-border/20 flex-1">
              {step.resultSummary || "No detailed summary."}
            </pre>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCopy(step.resultSummary)
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-[10px] font-bold font-mono transition-all"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {step.fullResult && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowModal(true)
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-[10px] font-bold font-mono transition-all"
              >
                <Maximize2 className="size-3" />
                Full screen / View JSON
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full screen modal / overlay */}
      {showModal && (
        <div
          onClick={(e) => {
            // Close modal if clicking overlay background
            if (e.target === e.currentTarget) {
              setShowModal(false)
            }
          }}
          className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 cursor-default"
        >
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden font-mono">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                  Step {step.stepNumber}
                </span>
                <span className="font-bold text-xs">Raw Execution Output ({step.toolName})</span>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex rounded-md bg-muted p-0.5 text-xs font-mono font-bold">
                  <button
                    onClick={() => setViewMode("text")}
                    className={cn(
                      "px-2 py-0.5 rounded-sm transition-all",
                      viewMode === "text"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Formatted Text
                  </button>
                  <button
                    onClick={() => setViewMode("json")}
                    className={cn(
                      "px-2 py-0.5 rounded-sm transition-all",
                      viewMode === "json"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Raw JSON
                  </button>
                </div>

                {/* Copy button */}
                <button
                  onClick={() => handleCopy(viewMode === "json" ? rawJsonString : (typeof step.fullResult === 'string' ? step.fullResult : rawJsonString))}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all"
                  title="Close Modal"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-y-auto bg-black/5 dark:bg-black/35 min-h-0">
              {viewMode === "json" ? (
                <JsonColorizer data={step.fullResult} />
              ) : (
                <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text">
                  {typeof step.fullResult === 'string' ? step.fullResult : rawJsonString}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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
  const [llmVision, setLlmVision] = React.useState("auto")
  const [llmTemperature, setLlmTemperature] = React.useState(0.7)
  const [llmMaxTokens, setLlmMaxTokens] = React.useState(4096)
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

  // 5.5 Fetch user settings
  const { data: settingsData } = useQuery({
    queryKey: ["userSettings"],
    queryFn: () => orbiterApi.getSettings()
  })

  const sMap = React.useMemo(() => {
    const map = new Map<string, string>()
    if (settingsData?.success && settingsData.settings) {
      for (const s of settingsData.settings) {
        map.set(s.key, s.value)
      }
    }
    return map
  }, [settingsData])

  const currentProvider = sMap.get("llm.provider") || "openrouter"

  // 4. Fetch spawn models list
  const { data: modelsData, isLoading: loadingModels } = useQuery({
    queryKey: ["systemModels", currentProvider],
    queryFn: () => orbiterApi.getModels(currentProvider),
    enabled: !!settingsData
  })

  // 5. Fetch spawn profiles list
  const { data: profilesData } = useQuery({
    queryKey: ["systemProfiles"],
    queryFn: () => orbiterApi.getProfiles()
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
      const dbVision = sMap.get("llm.vision")
      const dbTemperature = sMap.get("llm.temperature")
      const dbMaxTokens = sMap.get("llm.maxTokens")

      if (dbModel) setSelectedModel(dbModel)
      if (dbProfile) setSelectedProfile(dbProfile)
      if (dbHeadless !== undefined) setHeadless(dbHeadless === "true")
      if (dbMaxSteps) setMaxSteps(parseInt(dbMaxSteps, 10))
      if (dbVision) setLlmVision(dbVision)
      if (dbTemperature) setLlmTemperature(parseFloat(dbTemperature))
      if (dbMaxTokens) setLlmMaxTokens(parseInt(dbMaxTokens, 10))

      isInitialSyncDoneRef.current = true
    }
  }, [settingsData])

  const saveSetting = (key: string, value: string) => {
    orbiterApi.updateSettings([{ key, value }]).then(() => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] })
    }).catch((err) => {
      console.error(`Failed to save setting ${key}:`, err)
    })
  }


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

  // Set default model once loaded or when provider changes
  React.useEffect(() => {
    if (modelsData?.success && modelsData.models.length > 0) {
      const modelIds = modelsData.models.map((m: any) => m.id)
      if (!selectedModel || !modelIds.includes(selectedModel)) {
        setSelectedModel(modelsData.models[0].id)
      }
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
                          onChange={(val) => {
                            setSelectedModel(val)
                            saveSetting("llm.model", val)
                          }}
                          placeholder="Select LLM Engine..."
                          size="sm"
                        />
                      ) : (
                        <select
                          value={selectedModel}
                          onChange={(e) => {
                            const val = e.target.value
                            setSelectedModel(val)
                            saveSetting("llm.model", val)
                          }}
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
                        onChange={(e) => {
                          const val = e.target.value
                          setSelectedProfile(val)
                          saveSetting("browser.profile", val)
                        }}
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

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground">Vision Capability</label>
                      <select
                        value={llmVision}
                        onChange={(e) => {
                          const val = e.target.value
                          setLlmVision(val)
                          saveSetting("llm.vision", val)
                        }}
                        className="w-full h-8 px-2 text-[11px] bg-background/50 border border-border rounded-lg text-foreground font-semibold"
                      >
                        <option value="auto" className="bg-neutral-950">Auto</option>
                        <option value="enabled" className="bg-neutral-950">Enabled</option>
                        <option value="disabled" className="bg-neutral-950">Disabled</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-muted-foreground">LLM Temperature</label>
                        <span className="font-mono text-primary font-bold">{llmTemperature.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={llmTemperature}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setLlmTemperature(val)
                          saveSetting("llm.temperature", val.toString())
                        }}
                        className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none mt-2"
                      />
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-muted-foreground">Max Output Token Limit</label>
                        <span className="font-mono text-primary font-bold">{llmMaxTokens} tokens</span>
                      </div>
                      <input
                        type="range"
                        min="256"
                        max="8192"
                        step="256"
                        value={llmMaxTokens}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          setLlmMaxTokens(val)
                          saveSetting("llm.maxTokens", val.toString())
                        }}
                        className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none mt-2"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-between border-t border-border/20 pt-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id="headless-mode-setup"
                          checked={headless}
                          onChange={(e) => {
                            const val = e.target.checked
                            setHeadless(val)
                            saveSetting("browser.headless", val.toString())
                          }}
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
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 20
                            setMaxSteps(val)
                            saveSetting("execution.maxSteps", val.toString())
                          }}
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
                            className={cn(
                              "flex gap-3 max-w-[85%] transition-all w-full",
                              isSelected ? "scale-[1.01]" : ""
                            )}
                          >
                            <div className="size-7 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 shadow-xs text-primary">
                              <Bot className="size-4" />
                            </div>

                            <StepResultCard
                              step={step}
                              isSelected={isSelected}
                              onClick={() => setSelectedStepNumber(step.stepNumber)}
                            />
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
