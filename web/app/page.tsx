"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { Logo } from "@/components/logo"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    setIsLoading(true)

    // Bypass authentication logic and redirect to dashboard
    setTimeout(() => {
      setIsLoading(false)
      router.push("/dashboard")
    }, 800)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Subtle Background Gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-indigo-500/10 blur-[120px] dark:bg-indigo-500/5" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-cyan-500/10 blur-[120px] dark:bg-cyan-500/5" />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-violet-500/10 blur-[100px] dark:bg-violet-500/5 animate-pulse" />
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
        <div className="border border-border/50 bg-card/60 backdrop-blur-xl rounded-2xl shadow-2xl p-8 dark:bg-card/30">
          <h2 className="text-xl font-semibold mb-6 text-foreground">Welcome Back</h2>
          
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Mail className="size-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
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

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By signing in, you agree to our{" "}
          <a href="#" className="hover:text-foreground underline transition-colors">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="hover:text-foreground underline transition-colors">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  )
}
