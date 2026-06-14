"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2
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

function getScreenshotFromStep(step: Step): string | null {
  if (!step || !step.fullResult) return null;
  if (typeof step.fullResult.imageBase64 === 'string') {
    return step.fullResult.imageBase64;
  }
  if (step.fullResult.result && typeof step.fullResult.result.imageBase64 === 'string') {
    return step.fullResult.result.imageBase64;
  }
  if (step.fullResult.data && typeof step.fullResult.data.imageBase64 === 'string') {
    return step.fullResult.data.imageBase64;
  }
  return null;
}

function SessionsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialId = searchParams.get("id")
  const queryClient = useQueryClient()

  // Local state
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<"All" | "running" | "completed" | "failed">("All")
  const [page, setPage] = React.useState(1)

  // Spawning form local states
  const [showSpawnModal, setShowSpawnModal] = React.useState(false)
  const [prompt, setPrompt] = React.useState("")
  const [selectedModel, setSelectedModel] = React.useState("")
  const [selectedProfile, setSelectedProfile] = React.useState("default")
  const [headless, setHeadless] = React.useState(true)
  const [maxSteps, setMaxSteps] = React.useState(20)

  // Selection state
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(initialId)
  const [selectedStepNumber, setSelectedStepNumber] = React.useState<number | null>(null)
  
  // SSE stream local states
  const [streamLogs, setStreamLogs] = React.useState<{ type: string; message: string; timestamp: number }[]>([])
  const [streamScreenshot, setStreamScreenshot] = React.useState<string | null>(null)
  const [enlargeScreenshot, setEnlargeScreenshot] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"logs" | "steps" | "data">("logs")

  // 1. Fetch sessions list with TanStack Query
  const { data: sessionsData, isLoading: loadingList } = useQuery({
    queryKey: ["sessions", page],
    queryFn: () => orbiterApi.getSessions(page, 12),
    refetchInterval: (query) => {
      // Poll list if there is any active session in the state
      const hasActive = query.state.data?.sessions?.some((s: Session) => s.status === "running" || s.status === "queued")
      return hasActive ? 3000 : false
    }
  })

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
      setShowSpawnModal(false)
      setPrompt("")
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      router.push(`/dashboard/sessions?id=${data.sessionId}`)
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
  }, [searchParams])

  // Reset selected step when selectedSessionId changes
  React.useEffect(() => {
    setSelectedStepNumber(null)
  }, [selectedSessionId])

  // Determine the screenshot to display
  const displayScreenshot = React.useMemo(() => {
    if (selectedStepNumber && detailsData?.session?.steps) {
      const step = detailsData.session.steps.find((s: Step) => s.stepNumber === selectedStepNumber)
      if (step) {
        const screenshot = getScreenshotFromStep(step)
        if (screenshot) return screenshot
      }
    }

    const isRunning = detailsData?.session?.status === "running" || detailsData?.session?.status === "queued"
    if (isRunning && streamScreenshot) {
      return streamScreenshot
    }

    if (detailsData?.session?.steps) {
      for (let i = detailsData.session.steps.length - 1; i >= 0; i--) {
        const screenshot = getScreenshotFromStep(detailsData.session.steps[i])
        if (screenshot) return screenshot
      }
    }

    return streamScreenshot
  }, [detailsData, selectedStepNumber, streamScreenshot])

  // SSE Stream integration for running sessions
  React.useEffect(() => {
    let eventSource: EventSource | null = null

    if (!selectedSessionId) {
      setStreamLogs([])
      setStreamScreenshot(null)
      return
    }

    const sessionsList = sessionsData?.sessions || []
    const sessObj = sessionsList.find((s: Session) => s.id === selectedSessionId)
    const isActive = sessObj ? (sessObj.status === "running" || sessObj.status === "queued") : true

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

      eventSource.addEventListener("screenshot", (e: any) => {
        const data = JSON.parse(e.data)
        setStreamScreenshot(data.imageBase64)
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
  }, [selectedSessionId, sessionsData, queryClient])

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
    
    // UI Filtering since we don't have single DELETE endpoint
    queryClient.setQueryData(["sessions", page], (oldData: any) => {
      if (!oldData) return oldData
      return {
        ...oldData,
        sessions: oldData.sessions.filter((s: Session) => s.id !== id)
      }
    })
    
    if (selectedSessionId === id) {
      router.push("/dashboard/sessions")
    }
  }

  const sessionsList = sessionsData?.sessions || []
  const filteredSessions = sessionsList.filter((s: Session) => {
    const matchesSearch = s.goal.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())
    if (filter === "All") return matchesSearch
    return s.status === filter && matchesSearch
  })

  const totalPages = sessionsData?.pagination?.totalPages || 1

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[75vh]">
      {/* ─── CASE A: NO SESSION SELECTED (LIST/GRID VIEW) ─── */}
      {!selectedSessionId ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Agent Sessions</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Spawn, monitor, and manage the execution lifecycles of your background agent nodes.
              </p>
            </div>
            <button
              onClick={() => setShowSpawnModal(true)}
              className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all cursor-pointer shadow-xs shadow-primary/10"
            >
              <Plus className="size-4" />
              Spawn Agent Node
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 rounded-xl border border-border/50 bg-card/45 backdrop-blur-md">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border text-xs font-medium text-muted-foreground overflow-x-auto w-full md:w-auto mt-2 md:mt-0">
              {(["All", "running", "completed", "failed"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all cursor-pointer capitalize whitespace-nowrap",
                    filter === opt ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Sessions Grid */}
          {loadingList ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2 border border-border/50 bg-card/45 backdrop-blur-md rounded-xl">
              <Loader2 className="size-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Fetching session logs...</span>
            </div>
          ) : filteredSessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSessions.map((session: Session) => (
                <div
                  key={session.id}
                  onClick={() => router.push(`/dashboard/sessions?id=${session.id}`)}
                  className="p-5 border border-border/50 bg-card/45 hover:bg-card/75 hover:border-primary/45 backdrop-blur-md rounded-xl transition-all cursor-pointer relative flex flex-col justify-between min-h-[180px] group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold capitalize border shrink-0",
                        session.status === "running" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" :
                        session.status === "completed" ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" :
                        session.status === "queued" ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" :
                        "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                      )}>
                        <span className={cn(
                          "size-1.5 rounded-full",
                          session.status === "running" ? "bg-emerald-500 animate-pulse" :
                          session.status === "completed" ? "bg-blue-500" :
                          session.status === "queued" ? "bg-amber-500" : "bg-rose-500"
                        )} />
                        {session.status}
                      </span>

                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <h3 className="text-xs font-bold text-foreground leading-relaxed line-clamp-3">
                      {session.goal}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-3.5 mt-4 border-t border-border/20">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3 text-primary" />
                      {session.stepCount} steps
                    </span>
                    <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-muted-foreground border border-border/50 bg-card/45 backdrop-blur-md rounded-xl">
              No active runs or session logs found.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border border-border/50 rounded-xl flex items-center justify-between bg-card/45 backdrop-blur-md">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 px-2.5 rounded-lg border border-border hover:bg-muted text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="size-3" /> Prev
              </button>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 px-2.5 rounded-lg border border-border hover:bg-muted text-[10px] font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="size-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ─── CASE B: SESSION SELECTED (FULL CO-CONSOLE LIVE BROWSER WORKSPACE) ─── */
        <div className="space-y-6 animate-fade-in">
          {loadingDetails ? (
            <div className="border border-border/50 bg-card/45 backdrop-blur-md p-24 rounded-xl flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-7 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Retrieving session history & trace data...</span>
            </div>
          ) : detailsData?.success ? (
            <div className="space-y-6">
              {/* Header metadata bar */}
              <div className="flex flex-col gap-3 pb-5 border-b border-border/50">
                <button
                  onClick={() => router.push("/dashboard/sessions")}
                  className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
                >
                  <ChevronLeft className="size-4" />
                  Back to Sessions
                </button>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-primary tracking-wider font-mono">
                      Session UUID: {detailsData.session.id}
                    </span>
                    <h1 className="text-lg font-bold text-foreground leading-snug max-w-4xl">
                      {detailsData.session.goal}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground font-semibold pt-1">
                      <span className="flex items-center gap-1">
                        <Cpu className="size-3.5 text-primary" /> {detailsData.session.model || "Default Model"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5 text-primary" /> {new Date(detailsData.session.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize border",
                      detailsData.session.status === "running" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" :
                      detailsData.session.status === "completed" ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" :
                      detailsData.session.status === "queued" ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" :
                      "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                    )}>
                      <span className={cn(
                        "size-2 rounded-full",
                        detailsData.session.status === "running" ? "bg-emerald-500 animate-pulse" :
                        detailsData.session.status === "completed" ? "bg-blue-500" :
                        detailsData.session.status === "queued" ? "bg-amber-500" : "bg-rose-500"
                      )} />
                      {detailsData.session.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Console Workspace: Viewport and Console */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Viewport Frame */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-2xl flex flex-col">
                    {/* Browser chrome header */}
                    <div className="h-10 px-4 bg-muted/30 border-b border-border/50 flex items-center gap-3 select-none">
                      <div className="flex gap-1.5 shrink-0">
                        <span className="size-3 rounded-full bg-rose-500/80" />
                        <span className="size-3 rounded-full bg-amber-500/80" />
                        <span className="size-3 rounded-full bg-emerald-500/80" />
                      </div>
                      <div className="flex gap-2 text-muted-foreground shrink-0 ml-2">
                        <ChevronLeft className="size-3.5" />
                        <ChevronRight className="size-3.5" />
                      </div>
                      <div className="flex-1 max-w-lg h-6.5 px-3 bg-background/50 border border-border/40 rounded-md flex items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={cn(
                            "size-2 rounded-full shrink-0",
                            selectedStepNumber ? "bg-amber-500 animate-pulse" : "bg-emerald-500/80"
                          )} />
                          <span className="truncate">
                            {selectedStepNumber 
                              ? `Step ${selectedStepNumber} Preview: ${detailsData.session.steps.find((s: Step) => s.stepNumber === selectedStepNumber)?.toolName || ""}` 
                              : detailsData.session.status === "running" || detailsData.session.status === "queued"
                                ? "Orbiter Live Viewport" 
                                : "Orbiter Viewport (Session Ended)"
                            }
                          </span>
                        </div>
                        {selectedStepNumber && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedStepNumber(null)
                            }}
                            className="text-[8px] hover:text-foreground text-primary px-1.5 py-0.5 bg-primary/10 rounded-sm font-sans font-bold cursor-pointer transition-colors"
                          >
                            RESET TO LIVE
                          </button>
                        )}
                      </div>
                      <div className="flex-1" />
                      {displayScreenshot && (
                        <button
                          onClick={() => setEnlargeScreenshot(true)}
                          className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Maximize2 className="size-3" /> Enlarge
                        </button>
                      )}
                    </div>

                    {/* Viewport content */}
                    <div className="bg-black/20 dark:bg-black/50 aspect-video flex items-center justify-center relative overflow-hidden">
                      {displayScreenshot ? (
                        <img
                          src={displayScreenshot.startsWith('data:') ? displayScreenshot : `data:image/png;base64,${displayScreenshot}`}
                          alt="Browser viewport snapshot"
                          className="w-full h-full object-contain"
                        />
                      ) : detailsData.session.status === "running" ? (
                        <div className="text-center p-6 space-y-3">
                          <Loader2 className="size-8 text-primary animate-spin mx-auto" />
                          <p className="text-xs text-muted-foreground font-semibold">
                            Waiting for browser viewport paint event...
                          </p>
                        </div>
                      ) : (
                        <div className="text-center p-8 space-y-3 text-muted-foreground">
                          <Cpu className="size-10 text-muted-foreground/30 mx-auto" />
                          <p className="text-xs font-semibold">Browser viewport closed</p>
                          <p className="text-[10px] text-muted-foreground/60">This session has terminated.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side Console Panel */}
                <div className="lg:col-span-5 border border-border/50 bg-card/45 backdrop-blur-md p-6 rounded-xl shadow-xs space-y-6">
                  {/* Tab headers */}
                  <div className="flex items-center border-b border-border/50 text-xs font-semibold text-muted-foreground">
                    <button
                      onClick={() => setActiveTab("logs")}
                      className={cn(
                        "pb-2 px-4 border-b-2 transition-colors cursor-pointer",
                        activeTab === "logs" ? "border-primary text-foreground" : "border-transparent hover:text-foreground"
                      )}
                    >
                      Console Logs
                    </button>
                    <button
                      onClick={() => setActiveTab("steps")}
                      className={cn(
                        "pb-2 px-4 border-b-2 transition-colors cursor-pointer",
                        activeTab === "steps" ? "border-primary text-foreground" : "border-transparent hover:text-foreground"
                      )}
                    >
                      Trace Steps ({detailsData.session.steps.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("data")}
                      className={cn(
                        "pb-2 px-4 border-b-2 transition-colors cursor-pointer",
                        activeTab === "data" ? "border-primary text-foreground" : "border-transparent hover:text-foreground"
                      )}
                    >
                      Extracted Data
                    </button>
                  </div>

                  {/* Tab: Logs */}
                  {activeTab === "logs" && (
                    <div className="bg-black/5 dark:bg-black/40 border border-border/50 rounded-xl p-4 font-mono text-[10px] text-foreground space-y-1.5 h-96 overflow-y-auto">
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
                      ) : detailsData.session.status !== "running" ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground font-sans">
                          No active log stream.
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground font-sans animate-pulse">
                          Listening for live runner output events...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab: Trace Steps */}
                  {activeTab === "steps" && (
                    <div className="space-y-4 h-96 overflow-y-auto pr-1">
                      {detailsData.session.steps.length > 0 ? (
                        detailsData.session.steps.map((step: Step) => (
                          <div
                            key={step.stepNumber}
                            onClick={() => setSelectedStepNumber(step.stepNumber)}
                            className={cn(
                              "p-3.5 border rounded-xl flex items-start justify-between gap-3 text-xs shadow-xs transition-all cursor-pointer hover:bg-muted/40",
                              selectedStepNumber === step.stepNumber 
                                ? "border-primary/80 ring-1 ring-primary/30 bg-muted/20" 
                                : "border-border/40 bg-background/50"
                            )}
                          >
                            <div className="space-y-2.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 font-semibold">
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[9px] font-bold">
                                  Step {step.stepNumber}
                                </span>
                                <span className="text-foreground truncate font-bold">{step.toolName}</span>
                                {getScreenshotFromStep(step) && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
                                    <ImageIcon className="size-2.5" /> Screenshot
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground leading-relaxed break-words text-[11px]">{step.resultSummary}</p>
                              {step.fullResult && (
                                <div className="mt-2.5 p-2.5 bg-black/5 dark:bg-black/35 rounded-lg overflow-x-auto border border-border/30">
                                  <JsonColorizer data={step.fullResult} />
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end shrink-0 gap-1.5 font-semibold text-[10px]">
                              {step.success ? (
                                <span className="text-emerald-500 flex items-center gap-0.5 font-bold">
                                  <CheckCircle className="size-3" /> Success
                                </span>
                              ) : (
                                <span className="text-rose-500 flex items-center gap-0.5 font-bold">
                                  <XCircle className="size-3" /> Failed
                                </span>
                              )}
                              <span className="text-muted-foreground font-mono text-[9px]">{step.duration}ms</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-16 text-center text-xs text-muted-foreground">
                          No steps logged yet for this session.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab: Extracted Data */}
                  {activeTab === "data" && (
                    <div className="space-y-4 h-96 overflow-y-auto pr-1">
                      {extractedDataResponse?.success && extractedDataResponse.records.length > 0 ? (
                        extractedDataResponse.records.map((record: ExtractedData, idx: number) => (
                          <div key={idx} className="border border-border/40 rounded-xl bg-background/45 p-4 space-y-3 text-xs shadow-xs">
                            <div className="flex items-center justify-between border-b border-border/20 pb-2">
                              <div className="font-semibold flex items-center gap-1.5">
                                <FileSpreadsheet className="size-4 text-emerald-500" />
                                <span>Step {record.stepNumber} ({record.toolName})</span>
                              </div>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                                {record.itemCount} items
                              </span>
                            </div>
                            <div className="overflow-x-auto bg-black/5 dark:bg-black/35 rounded-lg p-3 border border-border/30">
                              <JsonColorizer data={record.data} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                          <FileSpreadsheet className="size-8 text-muted-foreground/40" />
                          <span>No JSON or structured output data collected.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-border/50 bg-card/45 backdrop-blur-md p-24 rounded-xl text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <Terminal className="size-8 text-muted-foreground/30" />
              <p className="text-xs">Select a session to load console workspace.</p>
            </div>
          )}
        </div>
      )}

      {/* Spawn Modal */}
      {showSpawnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-down">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Terminal className="size-4.5 text-primary" /> Spawn Agent Node
              </h3>
              <button
                onClick={() => setShowSpawnModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-bold text-xs"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleLaunchSession} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">What is the agent's goal?</label>
                <textarea
                  required
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Navigated to book.com, extract first 5 hotels in Paris under $200 and save output"
                  className="w-full p-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-medium leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground">Goal description must be at least 5 characters.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">LLM Engine</label>
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
                      className="w-full h-9 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all font-semibold text-foreground"
                    >
                      {modelsData?.success && modelsData.models.length > 0 ? (
                        modelsData.models.map((m: any) => (
                          <option key={m.id} value={m.id} className="bg-neutral-900 text-neutral-100">
                            {m.name}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled className="bg-neutral-900 text-neutral-100">
                          No models available (check API keys)
                        </option>
                      )}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Chrome Profile</label>
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all font-semibold text-foreground"
                  >
                    {profilesData?.success && profilesData.profiles.length > 0 ? (
                      profilesData.profiles.map((p: any) => (
                        <option key={p.name} value={p.name} className="bg-neutral-900 text-neutral-100">
                          {p.name}
                        </option>
                      ))
                    ) : (
                      <option value="default" className="bg-neutral-900 text-neutral-100">
                        default
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/30 pt-3">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="headless-mode"
                    checked={headless}
                    onChange={(e) => setHeadless(e.target.checked)}
                    className="size-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="headless-mode" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
                    Run Headless (no visual browser popup)
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-muted-foreground">Max Steps Limit</label>
                  <span className="font-mono font-bold text-primary">{maxSteps} steps</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(parseInt(e.target.value))}
                  className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowSpawnModal(false)}
                  className="h-8 px-4 rounded-lg text-xs font-semibold hover:bg-muted transition-all border border-border bg-background cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={spawnMutation.isPending}
                  className="h-8 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-primary/10"
                >
                  {spawnMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Launch Runner Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enlarge screenshot overlay modal */}
      {enlargeScreenshot && displayScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEnlargeScreenshot(false)}
        >
          <div className="max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl overflow-hidden relative p-1.5 flex flex-col justify-between" onClick={e => e.stopPropagation()}>
            <img 
              src={displayScreenshot.startsWith('data:') ? displayScreenshot : `data:image/png;base64,${displayScreenshot}`} 
              alt="Enlarged viewport paint" 
              className="object-contain max-h-[80vh] rounded-lg mx-auto" 
            />
            <button
              onClick={() => setEnlargeScreenshot(false)}
              className="absolute top-4 right-4 bg-black/60 text-white font-bold p-1 px-2.5 rounded-full hover:bg-black text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
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

