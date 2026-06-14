"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  ArrowRight,
  Brain,
  Cpu,
  GitFork,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const router = useRouter()

  const stats = [
    { name: "Active Sessions", value: "8 / 16", change: "+2 today", icon: Terminal, color: "text-blue-500 bg-blue-500/10" },
    { name: "Configured Flows", value: "14", change: "+1 this week", icon: GitFork, color: "text-violet-500 bg-violet-500/10" },
    { name: "Memory Nodes", value: "4,821", change: "+342 records", icon: Brain, color: "text-emerald-500 bg-emerald-500/10" },
    { name: "Token Throughput", value: "248.5K", change: "+18.2% vs avg", icon: Cpu, color: "text-amber-500 bg-amber-500/10" },
  ]

  const activeSessions = [
    { id: "sess-91", name: "Data Aggregator Agent", flow: "Ingest-User-Data", status: "Running", uptime: "14m 20s", tokens: "18,401" },
    { id: "sess-88", name: "NLP Summary Engine", flow: "Generate-Reports", status: "Idle", uptime: "2h 45m", tokens: "142,881" },
    { id: "sess-87", name: "Auto-CodeGen Helper", flow: "Dev-Assistant-V4", status: "Error", uptime: "4h 12m", tokens: "87,204" },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-500 tracking-wider uppercase">System fully operational</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Workspace Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor, orchestrate, and trace your autonomous agent networks.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/dashboard/flows")}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 border border-border rounded-lg text-xs font-semibold hover:bg-muted transition-all cursor-pointer bg-background/50 dark:bg-background/20"
          >
            <RefreshCw className="size-3.5" />
            Sync Workspace
          </button>
          <button
            onClick={() => router.push("/dashboard/sessions")}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all cursor-pointer shadow-xs shadow-primary/10"
          >
            <Plus className="size-3.5" />
            New Agent Session
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className="border border-border/50 bg-card/45 backdrop-blur-md p-5 rounded-xl shadow-xs hover:shadow-md transition-all hover:border-border duration-200 group cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-muted-foreground">{stat.name}</span>
                <div className={cn("p-2 rounded-lg transition-transform duration-200 group-hover:scale-105", stat.color)}>
                  <Icon className="size-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
              </div>
              <div className="mt-1">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <TrendingUp className="size-3 text-emerald-500" />
                  {stat.change}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Content Columns: Analytics & Active Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Activity Chart */}
        <div className="lg:col-span-2 border border-border/50 bg-card/45 backdrop-blur-md p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Token & Execution Activity</h2>
              <p className="text-xs text-muted-foreground">Historical token utilization per hour</p>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-md border text-[10px] font-semibold text-muted-foreground">
              <span className="px-2.5 py-1 rounded-sm bg-background text-foreground shadow-xs">24h</span>
              <span className="px-2.5 py-1 rounded-sm">7d</span>
              <span className="px-2.5 py-1 rounded-sm">30d</span>
            </div>
          </div>

          {/* Custom Stylized SVG Chart */}
          <div className="h-64 w-full flex items-end justify-between relative pt-6 px-2">
            {/* Chart Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 dark:opacity-10 text-[9px] text-muted-foreground">
              <div className="w-full border-t border-dashed border-foreground/60 pt-1">50k tokens</div>
              <div className="w-full border-t border-dashed border-foreground/60 pt-1">30k tokens</div>
              <div className="w-full border-t border-dashed border-foreground/60 pt-1">10k tokens</div>
              <div className="w-full" />
            </div>

            {/* Custom SVG line or bars */}
            <div className="absolute inset-x-0 bottom-0 top-6 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area path */}
                <path
                  d="M0,200 L0,150 L50,110 L100,160 L150,90 L200,60 L250,130 L300,70 L350,50 L400,100 L450,40 L500,80 L500,200 Z"
                  fill="url(#chart-gradient)"
                />
                {/* Line path */}
                <path
                  d="M0,150 L50,110 L100,160 L150,90 L200,60 L250,130 L300,70 L350,50 L400,100 L450,40 L500,80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-primary"
                />
              </svg>
            </div>

            {/* Chart Labels */}
            <div className="absolute inset-x-0 bottom-[-24px] flex justify-between px-2 text-[9px] text-muted-foreground font-semibold">
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>00:00</span>
              <span>04:00</span>
            </div>
          </div>
        </div>

        {/* Right Column: Sessions Overview */}
        <div className="border border-border/50 bg-card/45 backdrop-blur-md p-6 rounded-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Active Agents</h2>
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {activeSessions.filter(s => s.status === "Running").length} Running
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Currently processing workflows</p>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto mt-2">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/40 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{session.name}</span>
                    <span className={cn(
                      "text-[9px] font-medium px-1.5 py-0.2 rounded-sm border",
                      session.status === "Running" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" :
                      session.status === "Idle" ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" :
                      "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                    )}>
                      {session.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Flow: {session.flow}</p>
                </div>
                
                <div className="text-right">
                  <span className="text-[10px] font-medium block">{session.tokens} tokens</span>
                  <span className="text-[9px] text-muted-foreground">{session.uptime}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push("/dashboard/sessions")}
            className="w-full flex items-center justify-center gap-1 h-9 rounded-lg hover:bg-muted text-xs font-semibold text-primary transition-all border border-transparent hover:border-border cursor-pointer"
          >
            Manage Sessions
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Flow Launch section */}
      <div className="border border-border/50 bg-card/45 backdrop-blur-md p-6 rounded-xl">
        <h2 className="text-base font-semibold">Recommended Workflows</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Quickly trigger common automations in your environment.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {[
            { title: "Synthesize Feedback", desc: "Aggregate user reviews and output a concise PDF summary", active: true },
            { title: "Vector Knowledge Sync", desc: "Ingest latest docs updates and build memory vectors", active: true },
            { title: "Source Code Audit", desc: "Run static codebase analysis and file structural layout checks", active: false }
          ].map((flow, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-muted/40 transition-all hover:translate-y-[-2px] flex flex-col justify-between gap-3 group"
            >
              <div>
                <span className="text-xs font-semibold block">{flow.title}</span>
                <p className="text-[11px] text-muted-foreground mt-1 leading-normal">{flow.desc}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-muted-foreground">Flow ID: fl-rec-{i+1}</span>
                <button className="size-7 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-all cursor-pointer">
                  <Play className="size-3.5 fill-current" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
