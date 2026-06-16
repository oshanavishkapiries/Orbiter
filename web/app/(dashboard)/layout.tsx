"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Logo } from "@/components/logo"
import { orbiterApi } from "@/lib/endpoint"
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
  Settings,
  Sparkles,
  Sun,
  Terminal,
  User,
  X,
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


  const [isMobileOpen, setIsMobileOpen] = React.useState(false)
  const [showNotifications, setShowNotifications] = React.useState(false)
  const [showProfileMenu, setShowProfileMenu] = React.useState(false)
  const [unreadNotifications, setUnreadNotifications] = React.useState(3)
  const [mounted, setMounted] = React.useState(false)
  const [user, setUser] = React.useState<{ username: string } | null>(null)

  React.useEffect(() => {
    if (!orbiterApi.isAuthenticated()) {
      router.push("/")
    } else {
      setUser(orbiterApi.getCurrentUser())
      setMounted(true)
    }
  }, [router])

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

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const userInitials = user ? user.username.substring(0, 2).toUpperCase() : "US"

  return (
    <div className="h-screen w-screen flex bg-background text-foreground transition-colors duration-200 overflow-hidden">
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card flex flex-col select-none shrink-0 transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:bg-card/45 md:backdrop-blur-md md:z-40",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand/Logo Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0 relative">
          <div className="flex-1 flex justify-center">
            <Logo collapsed={false} size="lg" />
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="absolute right-4 md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Close Menu"
          >
            <X className="size-5" />
          </button>
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
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "relative flex items-center h-10 px-3 rounded-lg text-sm font-medium transition-all group/item overflow-hidden",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="size-5 shrink-0 mr-3 transition-transform duration-200 group-hover/item:scale-105" />
                <span className="truncate">
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* MAIN LAYOUT WRAPPER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TOPBAR */}
        <header className="h-16 shrink-0 border-b border-border bg-card/45 backdrop-blur-md flex items-center justify-between px-6 md:px-8 z-30">
          {/* Left section: Mobile Toggle */}
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Open Menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <span className="font-semibold text-sm">Orbiter</span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4">


            {/* Vertical Divider */}
            <div className="h-5 w-px bg-border" />

            {/* Profile Avatar / Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center focus:outline-none cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="size-8 rounded-full bg-linear-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold text-xs shadow-xs border border-border/30">
                  {userInitials}
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  <div className="px-4 py-2 border-b border-border/50">
                    <p className="text-xs font-semibold">{user?.username || 'User'}</p>
                    <p className="text-[10px] text-muted-foreground">Logged In</p>
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
                      onClick={() => orbiterApi.logout()}
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
        <main className={cn(
          "flex-1 bg-muted/15 dark:bg-background/20",
          pathname === "/dashboard/sessions" ? "p-0 overflow-hidden" : "p-4 sm:p-6 md:p-8 overflow-y-auto"
        )}>
          <div className={cn(
            "animate-fade-in duration-300",
            pathname === "/dashboard/sessions" ? "w-full h-full" : "max-w-7xl mx-auto"
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
