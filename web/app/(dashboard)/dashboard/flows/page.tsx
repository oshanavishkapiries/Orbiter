"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { orbiterApi } from "@/lib/endpoint"
import {
  GitFork,
  Info,
  Layers,
  Play,
  Sparkles,
  Loader2,
  FolderOpen
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Flow {
  id: string
  name: string
  type: "raw" | "optimized"
  stepCount: number
  createdAt: number
}

export default function FlowsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedFlow, setSelectedFlow] = React.useState<Flow | null>(null)
  
  // Replay & Refine progress logs
  const [successMessage, setSuccessMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  // Refine options form local state
  const [refineMode, setRefineMode] = React.useState<"auto" | "llm" | "interactive">("llm")
  const [removeFailures, setRemoveFailures] = React.useState(true)
  const [mergeSteps, setMergeSteps] = React.useState(true)

  // 1. Fetch flows with TanStack Query
  const { data: flowsData, isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: () => orbiterApi.getFlows(1, 20),
  })

  // Set default selected flow
  React.useEffect(() => {
    if (flowsData?.success && flowsData.data.length > 0 && !selectedFlow) {
      setSelectedFlow(flowsData.data[0])
    }
  }, [flowsData, selectedFlow])

  // 2. Replay Flow Mutation
  const replayMutation = useMutation({
    mutationFn: (payload: any) => orbiterApi.replayFlow(payload),
    onSuccess: (data) => {
      setSuccessMessage(`Flow replay queued successfully. Redirecting to execution monitor...`)
      setTimeout(() => {
        router.push(`/dashboard/sessions?id=${data.sessionId}`)
      }, 1500)
    },
    onError: (err: any) => {
      setErrorMessage(err.message || "Failed to trigger replay.")
    }
  })

  // 3. Refine Flow Mutation
  const refineMutation = useMutation({
    mutationFn: ({ id, mode, options }: { id: string; mode: any; options: any }) => 
      orbiterApi.refineFlow(id, mode, options),
    onSuccess: (data) => {
      setSuccessMessage(`Refinement complete! Saved output to: ${data.outputPath}`)
      queryClient.invalidateQueries({ queryKey: ["flows"] })
    },
    onError: (err: any) => {
      setErrorMessage(err.message || "Failed to refine flow.")
    }
  })

  const handleRunReplay = () => {
    if (!selectedFlow) return
    setSuccessMessage("")
    setErrorMessage("")

    replayMutation.mutate({
      flowPath: selectedFlow.id,
      headless: true,
      stopOnError: true
    })
  }

  const handleRefineFlow = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFlow) return
    setSuccessMessage("")
    setErrorMessage("")

    refineMutation.mutate({
      id: selectedFlow.id,
      mode: refineMode,
      options: {
        removeFailures,
        mergeSteps
      }
    })
  }

  const flowsList = flowsData?.data || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Flows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and optimize structured automation graphs connecting custom agents and service hooks.
          </p>
        </div>
      </div>

      {/* Toast logs feedback */}
      {(successMessage || errorMessage) && (
        <div className={cn(
          "p-4 rounded-xl border font-semibold text-xs animate-slide-down flex items-center gap-2",
          successMessage ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
        )}>
          <Info className="size-4 shrink-0" />
          <span>{successMessage || errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Left List, Right Graph Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left List of Flows */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2 border border-border/50 bg-card/45 backdrop-blur-md rounded-xl">
              <Loader2 className="size-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Reading flow logs...</span>
            </div>
          ) : flowsList.length > 0 ? (
            flowsList.map((flow: Flow) => {
              const isSelected = selectedFlow?.id === flow.id
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
                      <span className="text-xs font-bold text-muted-foreground truncate max-w-[150px] font-mono">{flow.id}</span>
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border capitalize",
                        flow.type === "optimized" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" :
                        "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                      )}>
                        {flow.type}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold mt-2 text-foreground truncate">{flow.name}</h3>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/30 pt-3 text-[10px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3 text-primary" />
                      {flow.stepCount} nodes
                    </span>
                    <span>Created: {new Date(flow.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              No saved flows found. Record browser flows to populate this list.
            </div>
          )}
        </div>

        {/* Right Canvas: Replay & Optimizer Panel */}
        <div className="lg:col-span-3 space-y-6">
          {selectedFlow ? (
            <div className="border border-border/50 bg-card/45 backdrop-blur-md p-6 rounded-xl shadow-xs space-y-6">
              
              {/* Top metadata */}
              <div className="flex items-start justify-between border-b border-border/50 pb-4">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-1.5">
                    <GitFork className="size-4.5 text-primary" />
                    {selectedFlow.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    ID: {selectedFlow.id}
                  </p>
                </div>

                <button
                  onClick={handleRunReplay}
                  disabled={replayMutation.isPending}
                  className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/95 transition-all disabled:opacity-50 cursor-pointer shadow-xs shadow-primary/10"
                >
                  {replayMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
                  Replay Flow
                </button>
              </div>

              {/* Refinement Panel */}
              <form onSubmit={handleRefineFlow} className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary">
                  <Sparkles className="size-4" />
                  <span>Refine & Optimize Flow</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Refining analyzes steps, filters failures, and leverages LLM evaluation to condense recorded routes into optimized workflows.
                </p>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Refinement Mode</label>
                    <select
                      value={refineMode}
                      onChange={(e) => setRefineMode(e.target.value as any)}
                      className="w-full h-9 px-3 text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all font-semibold"
                    >
                      <option value="llm">LLM Optimize (Recommended)</option>
                      <option value="auto">Auto-Clean Failures</option>
                      <option value="interactive">Dry Run / Interactive</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end space-y-2 pb-1 text-xs">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="rem-failures"
                        checked={removeFailures}
                        onChange={(e) => setRemoveFailures(e.target.checked)}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="rem-failures" className="font-semibold text-muted-foreground cursor-pointer select-none">
                        Remove Failures
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="merge-steps"
                        checked={mergeSteps}
                        onChange={(e) => setMergeSteps(e.target.checked)}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="merge-steps" className="font-semibold text-muted-foreground cursor-pointer select-none">
                        Merge Adjacent Steps
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/30 flex justify-end">
                  <button
                    type="submit"
                    disabled={refineMutation.isPending}
                    className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-foreground border border-border bg-background hover:bg-muted transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {refineMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Optimize Flow File
                  </button>
                </div>
              </form>

              {/* Detail Info footer */}
              <div className="border-t border-border/30 pt-4 flex items-center gap-2.5 text-[10px] text-muted-foreground">
                <Info className="size-4 text-primary shrink-0" />
                <p className="leading-normal">
                  Recorded raw sessions map to exact user interaction logs. Replay reproduces steps to save token overhead costs.
                </p>
              </div>

            </div>
          ) : (
            <div className="border border-border/50 bg-card/45 backdrop-blur-md p-24 rounded-xl text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <FolderOpen className="size-8 text-muted-foreground/30" />
              <p className="text-xs">Select a flow to trigger execution or start refinement.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
