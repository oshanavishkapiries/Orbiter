"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Logo } from "@/components/logo"
import {
  Bell,
  Brain,
  ChevronLeft,
  ChevronRight,
  Database,
  GitFork,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Terminal,
  User,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const sidebarItems: SidebarItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Sessions", href: "/dashboard/sessions", icon: Terminal },
  { name: "Flows", href: "/dashboard/flows", icon: GitFork },
  { name: "Memory", href: "/dashboard/memory", icon: Brain },
  { name: "Outputs", href: "/dashboard/outputs", icon: Database },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [isCollapsed, setIsCollapsed] = React.useState(true)
  const [showNotifications, setShowNotifications] = React.useState(false)
  const [showProfileMenu, setShowProfileMenu] = React.useState(false)
  const [unreadNotifications, setUnreadNotifications] = React.useState(3)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const notifications = [
    { id: 1, title: "Flow Completed", desc: "Ingest-User-Data executed successfully", time: "5m ago", type: "success" },
    { id: 2, title: "Memory Threshold", desc: "Vector memory usage reached 82%", time: "1h ago", type: "warning" },
    { id: 3, title: "New Session Active", desc: "Agent-Orion-Beta spawned a new terminal", time: "2h ago", type: "info" }
  ]

  // Close dropdowns on click outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowNotifications(false)
      setShowProfileMenu(false)
    }
    window.addEventListener("click", handleClickOutside)
    return () => window.removeEventListener("click", handleClickOutside)
  }, [])

  return (
    <div className="h-screen w-screen flex bg-background text-foreground transition-colors duration-200 overflow-hidden">
      {/* SIDEBAR */}
      <aside
        className={cn(
          "h-screen border-r border-border/50 bg-card/45 backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out z-40 select-none shrink-0",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {/* Brand/Logo Header */}
        <div className="h-16 flex items-center justify-center border-b border-border/50 px-4 shrink-0">
          <Logo collapsed={isCollapsed} size="md" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center h-10 px-3 rounded-lg text-sm font-medium transition-all group/item overflow-hidden",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-primary-foreground" />
                )}
                
                <Icon
                  className={cn(
                    "size-5 shrink-0 transition-transform duration-200 group-hover/item:scale-105",
                    isCollapsed ? "mx-auto" : "mr-3"
                  )}
                />
                
                {!isCollapsed && (
                  <span className="truncate transition-opacity duration-200 animate-fade-in">
                    {item.name}
                  </span>
                )}

                {/* Collapsed Tooltip */}
                {isCollapsed && (
                  <div className="absolute left-20 scale-0 group-hover/item:scale-100 transition-all origin-left bg-popover text-popover-foreground text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-md border border-border pointer-events-none z-50 whitespace-nowrap">
                    {item.name}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>


      </aside>

      {/* MAIN LAYOUT WRAPPER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TOPBAR */}
        <header className="h-16 shrink-0 border-b border-border/50 bg-background/70 backdrop-blur-md flex items-center justify-between px-6 md:px-8 z-30">
          {/* Left section: Collapse toggle, Search & Help Tip */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <Menu className="size-5" /> : <ChevronLeft className="size-5" />}
            </button>

            {/* Left search */}
            <div className="relative w-64 max-w-xs hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workspaces..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-muted/40 border border-border rounded-lg outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <span className="font-semibold text-sm">Orbiter</span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4">


            {/* Notification Bell */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Bell className="size-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 size-2 bg-rose-500 rounded-full animate-ping" />
                )}
                {unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 size-2 bg-rose-500 rounded-full" />
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-slide-down">
                  <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
                    <span className="text-xs font-semibold">Notifications</span>
                    {unreadNotifications > 0 && (
                      <button
                        onClick={() => setUnreadNotifications(0)}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <span className={cn(
                              "size-1.5 rounded-full",
                              n.type === "success" ? "bg-emerald-500" :
                              n.type === "warning" ? "bg-amber-500" : "bg-sky-500"
                            )} />
                            {n.title}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-border/50 text-center">
                    <a href="#" className="text-[10px] text-primary hover:underline font-medium block">
                      View all activities
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="h-5 w-px bg-border" />

            {/* Profile Avatar / Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 focus:outline-none cursor-pointer"
              >
                <div className="size-8 rounded-lg bg-linear-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  JD
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold">John Doe</p>
                  <p className="text-[10px] text-muted-foreground">Admin Workspace</p>
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  <div className="px-4 py-2 border-b border-border/50">
                    <p className="text-xs font-semibold">John Doe</p>
                    <p className="text-[10px] text-muted-foreground">john@company.com</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted text-foreground transition-colors"
                    >
                      <User className="size-3.5 text-muted-foreground" />
                      My Profile
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted text-foreground transition-colors"
                    >
                      <Settings className="size-3.5 text-muted-foreground" />
                      Workspace Settings
                    </Link>
                  </div>
                  <div className="border-t border-border/50 py-1">
                    <button
                      onClick={() => router.push("/")}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="size-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-muted/15 dark:bg-background/20">
          <div className="max-w-7xl mx-auto animate-fade-in duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
