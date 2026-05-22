'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  List,
  Play,
  GitBranch,
  Database,
  Orbit,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/live', label: 'Live Monitor', icon: Activity },
  { href: '/sessions', label: 'Sessions', icon: List },
  { href: '/run', label: 'New Run', icon: Play },
  { href: '/flows', label: 'Flows', icon: GitBranch },
  { href: '/memory', label: 'Memory', icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-zinc-950 border-r border-zinc-800 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
          <Orbit size={14} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100 leading-none">Orbiter</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">v1.0.0</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-violet-600/15 text-violet-400 font-medium'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-violet-400' : ''} />
              {label}
              {href === '/live' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600">AI Browser Automation</p>
      </div>
    </aside>
  );
}
