"use client"

import * as React from "react"
import { Search, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Option {
  id: string
  name: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  size?: "sm" | "md"
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  className,
  disabled = false,
  size = "md",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    return options.filter((opt) =>
      opt.name.toLowerCase().includes(search.toLowerCase()) ||
      opt.id.toLowerCase().includes(search.toLowerCase())
    )
  }, [options, search])

  // Get current selected option label
  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.id === value)
  }, [options, value])

  const handleSelect = (id: string) => {
    onChange(id)
    setIsOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-3 flex items-center justify-between text-xs bg-background/50 border border-border rounded-lg outline-hidden focus:border-primary transition-all dark:bg-background/25 font-semibold text-foreground text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none",
          size === "sm" ? "h-9" : "h-10",
          isOpen && "border-primary ring-2 ring-primary/10"
        )}
      >
        <span className="truncate pr-4">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "transform rotate-180")} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-card/95 border border-border rounded-lg shadow-xl backdrop-blur-md overflow-hidden animate-slide-down max-h-60 flex flex-col">
          {/* Search Box */}
          <div className="relative p-2 border-b border-border/50 flex items-center shrink-0">
            <Search className="absolute left-4 size-3.5 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-background/40 border border-border rounded-md outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all font-medium text-foreground"
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 py-1 max-h-44">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between cursor-pointer text-foreground",
                      isSelected && "bg-primary/5 text-primary"
                    )}
                  >
                    <span className="truncate pr-4">{opt.name}</span>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground italic select-none">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
