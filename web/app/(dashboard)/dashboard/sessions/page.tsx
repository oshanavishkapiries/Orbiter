"use client"

import * as React from "react"
import {
  Activity,
  Cpu,
  Filter,
  Play,
  Plus,
  Search,
  StopCircle,
  Terminal,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Session {
  id: string
  name: string
  status: "Running" | "Completed" | "Failed" | "Paused"
  agent: string
  startTime: string
  tokens: number
  errors: number
}

const initialSessions: Session[] = [
  { id: "sess-102", name: "User Feedback Synthesizer", agent: "Orion-Summarizer", status: "Running", startTime: "2m ago", tokens: 4210, errors: 0 },
  { id: "sess-99", name: "Vector Database Sync", agent: "Brain-Ingestor", status: "Running", startTime: "12m ago", tokens: 14205, errors: 0 },
  { id: "sess-95", name: "Security Audit Scan", agent: "Guardrail-Sentinel", status: "Paused", startTime: "1h ago", tokens: 85910, errors: 1 },
  { id: "sess-91", name: "Data Aggregator Agent", agent: "Collector-Agent", status: "Completed", startTime: "3h ago", tokens: 120442, errors: 0 },
  { id: "sess-88", name: "NLP Summary Engine", agent: "GPT-Core-Wrapper", status: "Completed", startTime: "1d ago", tokens: 450121, errors: 3 },
  { id: "sess-87", name: "Auto-CodeGen Helper", agent: "Claude-Developer-Bypass", status: "Failed", startTime: "2d ago", tokens: 94812, errors: 12 },
]

export default function SessionsPage() {
  const [sessions, setSessions] = React.useState<Session[]>(initialSessions)
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<"All" | "Running" | "Completed" | "Failed">("All")
  const [isSpawning, setIsSpawning] = React.useState(false)

  const handleLaunchSession = () => {
    setIsSpawning(true)
    setTimeout(() => {
      const newSession: Session = {
        id: `sess-${Math.floor(Math.random() * 900) + 100}`,
        name: `Interactive Test Agent ${sessions.length + 1}`,
        agent: "Dev-Assistant-V4",
        status: "Running",
        startTime: "Just now",
        tokens: 0,
        errors: 0
      }
      setSessions([newSession, ...sessions])
      setIsSpawning(false)
    }, 1000)
  }

  const handleDeleteSession = (id: string) => {
    setSessions(sessions.filter(s => s.id !== id))
  }

  const handleToggleStatus = (id: string) => {
    setSessions(sessions.map(s => {
      if (s.id === id) {
        return {
          ...s,
          status: s.status === "Running" ? "Paused" : "Running"
        }
      }
      return s
    }))
  }

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.agent.toLowerCase().includes(search.toLowerCase())
    if (filter === "All") return matchesSearch
    return s.status === filter && matchesSearch
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spawn, monitor, and manage the execution lifecycles of your background agent nodes.
          </p>
        </div>
        <button
          onClick={handleLaunchSession}
          disabled={isSpawning}
          className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all disabled:opacity-60 cursor-pointer shadow-xs shadow-primary/10"
        >
          {isSpawning ? (
            <div className="size-4 border-2 border-primary-foreground/35 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Spawn Agent Node
        </button>
      </div>

      {/* Control Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card/45 backdrop-blur-md">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by session name or agent model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground hidden sm:block" />
          <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border text-xs font-medium text-muted-foreground">
            {(["All", "Running", "Completed", "Failed"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={cn(
                  "px-3 py-1 rounded-md transition-all cursor-pointer",
                  filter === opt ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="border border-border/50 bg-card/45 backdrop-blur-md rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 text-[10px] uppercase font-bold text-muted-foreground tracking-wider bg-muted/10">
                <th className="py-3.5 px-5">Session Node</th>
                <th className="py-3.5 px-5">Agent Class</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Uptime</th>
                <th className="py-3.5 px-5">Tokens Spent</th>
                <th className="py-3.5 px-5">Errors</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-xs">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <Terminal className="size-3.5 text-muted-foreground" />
                        {session.name}
                      </div>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">{session.id}</span>
                    </td>
                    <td className="py-4 px-5 text-muted-foreground font-medium">
                      {session.agent}
                    </td>
                    <td className="py-4 px-5">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        session.status === "Running" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" :
                        session.status === "Completed" ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" :
                        session.status === "Paused" ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" :
                        "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                      )}>
                        <span className={cn(
                          "size-1.5 rounded-full",
                          session.status === "Running" ? "bg-emerald-500 animate-pulse" :
                          session.status === "Completed" ? "bg-blue-500" :
                          session.status === "Paused" ? "bg-amber-500" :
                          "bg-rose-500"
                        )} />
                        {session.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-muted-foreground font-medium">
                      {session.startTime}
                    </td>
                    <td className="py-4 px-5 font-semibold text-foreground">
                      {session.tokens.toLocaleString()}
                    </td>
                    <td className="py-4 px-5">
                      <span className={cn(
                        "font-medium",
                        session.errors > 0 ? "text-rose-500" : "text-muted-foreground"
                      )}>
                        {session.errors}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-1 whitespace-nowrap">
                      {(session.status === "Running" || session.status === "Paused") && (
                        <button
                          onClick={() => handleToggleStatus(session.id)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center justify-center"
                          title={session.status === "Running" ? "Pause Session" : "Resume Session"}
                        >
                          {session.status === "Running" ? <StopCircle className="size-4" /> : <Play className="size-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer inline-flex items-center justify-center"
                        title="Delete Session Log"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No active sessions found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
