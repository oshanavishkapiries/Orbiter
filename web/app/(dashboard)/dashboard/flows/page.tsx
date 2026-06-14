"use client"

import * as React from "react"
import {
  ArrowRight,
  GitFork,
  HelpCircle,
  Info,
  Layers,
  Play,
  Plus,
  Settings,
  Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FlowNode {
  id: string
  label: string
  type: "trigger" | "action" | "agent" | "condition" | "output"
  x: number
  y: number
}

interface FlowLink {
  from: string
  to: string
}

interface Flow {
  id: string
  name: string
  desc: string
  nodeCount: number
  status: "Active" | "Draft" | "Archived"
  successRate: string
  nodes: FlowNode[]
  links: FlowLink[]
}

const initialFlows: Flow[] = [
  {
    id: "fl-101",
    name: "Ingest & Vector Sync",
    desc: "Fetches user data from APIs, filters attributes, converts to embeddings, and updates Vector memory.",
    nodeCount: 5,
    status: "Active",
    successRate: "99.4%",
    nodes: [
      { id: "n1", label: "Cron Trigger (1h)", type: "trigger", x: 40, y: 100 },
      { id: "n2", label: "Fetch Profile API", type: "action", x: 170, y: 100 },
      { id: "n3", label: "Orion Filtering Agent", type: "agent", x: 300, y: 100 },
      { id: "n4", label: "Vector DB Insert", type: "output", x: 440, y: 60 },
      { id: "n5", label: "Log Error Notification", type: "action", x: 440, y: 140 },
    ],
    links: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n3", to: "n5" },
    ]
  },
  {
    id: "fl-102",
    name: "Feedback Synthesis Pipeline",
    desc: "Monitors Zendesk ticket submissions, parses language sentiments, triggers automated agent responses, and updates dashboard.",
    nodeCount: 4,
    status: "Active",
    successRate: "97.1%",
    nodes: [
      { id: "f1", label: "Webhook Inbound", type: "trigger", x: 50, y: 100 },
      { id: "f2", label: "Sentiment Analyzer", type: "agent", x: 180, y: 100 },
      { id: "f3", label: "Negative Ticket?", type: "condition", x: 310, y: 100 },
      { id: "f4", label: "Auto-Generate Draft", type: "action", x: 440, y: 100 },
    ],
    links: [
      { from: "f1", to: "f2" },
      { from: "f2", to: "f3" },
      { from: "f3", to: "f4" },
    ]
  },
  {
    id: "fl-103",
    name: "Weekly PDF Summary Dispatcher",
    desc: "Runs weekly to compile workspace analytics, invokes generator engine, publishes summary report PDF, and emails admin.",
    nodeCount: 3,
    status: "Draft",
    successRate: "100%",
    nodes: [
      { id: "d1", label: "Weekly Schedule", type: "trigger", x: 60, y: 100 },
      { id: "d2", label: "Compile Analytics", type: "action", x: 220, y: 100 },
      { id: "d3", label: "PDF Email Dispatcher", type: "output", x: 380, y: 100 },
    ],
    links: [
      { from: "d1", to: "d2" },
      { from: "d2", to: "d3" },
    ]
  }
]

export default function FlowsPage() {
  const [flows, setFlows] = React.useState<Flow[]>(initialFlows)
  const [selectedFlow, setSelectedFlow] = React.useState<Flow>(initialFlows[0])
  const [isRunning, setIsRunning] = React.useState(false)
  const [runMessage, setRunMessage] = React.useState("")

  const handleTriggerFlow = (flow: Flow) => {
    setIsRunning(true)
    setRunMessage(`Initializing workflow ${flow.name}...`)
    
    setTimeout(() => {
      setRunMessage("Running trigger stage...")
      setTimeout(() => {
        setRunMessage("Invoking agent execution modules...")
        setTimeout(() => {
          setRunMessage(`Workflow ${flow.name} completed successfully!`)
          setIsRunning(false)
          setTimeout(() => setRunMessage(""), 3000)
        }, 1200)
      }, 1000)
    }, 800)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Flows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and orchestrate structured automation graphs connecting custom agents and service hooks.
          </p>
        </div>
        <button
          className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all cursor-pointer shadow-xs shadow-primary/10"
          onClick={() => {
            const newFlowId = `fl-${100 + flows.length + 1}`
            const newFlow: Flow = {
              id: newFlowId,
              name: `Custom Flow ${flows.length + 1}`,
              desc: "A custom user flow connected with default triggers.",
              nodeCount: 2,
              status: "Draft",
              successRate: "N/A",
              nodes: [
                { id: "n1", label: "Manual Trigger", type: "trigger", x: 80, y: 100 },
                { id: "n2", label: "Agent Dispatcher", type: "agent", x: 320, y: 100 },
              ],
              links: [
                { from: "n1", to: "n2" }
              ]
            }
            setFlows([...flows, newFlow])
            setSelectedFlow(newFlow)
          }}
        >
          <Plus className="size-4" />
          Create New Flow
        </button>
      </div>

      {/* Main Grid: Left List, Right Graph Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left List of Flows */}
        <div className="lg:col-span-2 space-y-4">
          {flows.map((flow) => {
            const isSelected = selectedFlow.id === flow.id
            return (
              <div
                key={flow.id}
                onClick={() => setSelectedFlow(flow)}
                className={cn(
                  "border p-5 rounded-xl shadow-xs transition-all cursor-pointer duration-200 flex flex-col justify-between gap-4",
                  isSelected
                    ? "bg-card border-primary/50 ring-2 ring-primary/10 dark:bg-card/40"
                    : "bg-card/40 border-border/50 hover:border-border hover:bg-card/65"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">{flow.id}</span>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border",
                      flow.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" :
                      "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                    )}>
                      {flow.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mt-2 text-foreground">{flow.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-normal">{flow.desc}</p>
                </div>

                <div className="flex items-center justify-between border-t border-border/30 pt-3 text-[10px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1">
                    <Layers className="size-3 text-primary" />
                    {flow.nodeCount} nodes
                  </span>
                  <span>Success rate: <strong className="text-foreground">{flow.successRate}</strong></span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right Node Graph Visualizer */}
        <div className="lg:col-span-3 border border-border/50 bg-card/45 backdrop-blur-md p-6 rounded-xl flex flex-col justify-between min-h-[420px] shadow-xs relative">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-1.5">
                  <GitFork className="size-4.5 text-primary" />
                  {selectedFlow.name} Canvas
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Visual representation of execution path</p>
              </div>

              <button
                onClick={() => handleTriggerFlow(selectedFlow)}
                disabled={isRunning}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all disabled:opacity-60 cursor-pointer shadow-xs shadow-primary/10"
              >
                <Play className="size-3.5 fill-current" />
                Run Flow
              </button>
            </div>

            {/* Run Logs Overlay */}
            {runMessage && (
              <div className="mt-3 p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold flex items-center gap-2 animate-pulse">
                <Info className="size-3.5 shrink-0" />
                {runMessage}
              </div>
            )}
          </div>

          {/* Node Graph Sandbox Grid */}
          <div className="flex-1 border border-border/40 bg-background/45 rounded-lg my-6 relative overflow-hidden h-72">
            {/* Grid dot pattern background */}
            <div className="absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

            {/* SVG connections paths */}
            <svg className="absolute inset-0 size-full pointer-events-none z-10">
              {selectedFlow.links.map((link, idx) => {
                const fromNode = selectedFlow.nodes.find(n => n.id === link.from)
                const toNode = selectedFlow.nodes.find(n => n.id === link.to)
                if (!fromNode || !toNode) return null

                // Drawing a curved Bezier line between nodes
                const x1 = fromNode.x + 110 // Half of block width (220px)
                const y1 = fromNode.y + 20 // Half of block height (40px)
                const x2 = toNode.x
                const y2 = toNode.y + 20
                const midX = (x1 + x2) / 2
                
                return (
                  <path
                    key={idx}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isRunning ? "var(--color-primary, #6366f1)" : "var(--color-border, #e2e8f0)"}
                    strokeWidth={isRunning ? "2.5" : "1.5"}
                    className={cn(
                      "transition-all duration-300",
                      isRunning && "animate-dash stroke-dashoffset-20"
                    )}
                    strokeDasharray={isRunning ? "5,5" : "none"}
                  />
                )
              })}
            </svg>

            {/* Nodes Elements */}
            {selectedFlow.nodes.map((node) => (
              <div
                key={node.id}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className={cn(
                  "absolute z-20 w-28 h-10 rounded-md border text-[10px] font-semibold flex items-center justify-center text-center px-2.5 transition-all shadow-xs hover:scale-105 select-none",
                  node.type === "trigger" ? "bg-amber-500/10 border-amber-500/35 text-amber-600 dark:text-amber-400" :
                  node.type === "agent" ? "bg-primary/10 border-primary/35 text-primary" :
                  node.type === "condition" ? "bg-sky-500/10 border-sky-500/35 text-sky-600 dark:text-sky-400" :
                  node.type === "output" ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-600 dark:text-emerald-400" :
                  "bg-card border-border text-foreground"
                )}
              >
                {node.label}
              </div>
            ))}
          </div>

          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="size-3 text-primary" />
            Connections reflect real execution routes. Use "Create New Flow" to add customizable templates.
          </div>
        </div>
      </div>
    </div>
  )
}
