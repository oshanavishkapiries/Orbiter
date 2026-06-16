"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, User } from "lucide-react"
import { Logo } from "@/components/logo"
import { orbiterApi } from "../lib/endpoint"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    // If already logged in, redirect directly to dashboard
    if (orbiterApi.isAuthenticated()) {
      router.push("/dashboard")
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username || !password) {
      setError("Please fill in all fields")
      return
    }

    setIsLoading(true)

    try {
      const data = await orbiterApi.login({ username, password })
      if (data.success) {
        router.push("/dashboard")
      } else {
        setError(data.error || "Invalid username or password")
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials or login failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Subtle Background Gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-primary/10 blur-[120px] dark:bg-primary/5" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-primary/10 blur-[120px] dark:bg-primary/5" />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] dark:bg-primary/5 animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Brand Logo / Name */}
        <div className="flex flex-col items-center mb-8 text-center">
          <Logo size="xl" className="mb-2" />
          <p className="mt-1 text-sm text-muted-foreground">
            Autonomous agent workflow studio
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-card border border-border p-6 rounded-lg shadow-md">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <User className="size-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="block w-full pl-10 pr-3 py-2 text-sm bg-background/50 border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all dark:bg-background/25"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock className="size-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2 text-sm bg-background/50 border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all dark:bg-background/25"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="size-5 border-2 border-primary-foreground/35 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
