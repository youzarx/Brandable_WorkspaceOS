'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { Button, Avatar } from '@platform/ui';
import { Menu, LogOut, Building2, User as UserIcon, ChevronDown } from 'lucide-react';

interface TopbarProps {
  orgSlug: string;
  onToggleSidebar: () => void;
}

export function Topbar({ orgSlug, onToggleSidebar }: TopbarProps): React.JSX.Element {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : 'User';
  const avatarFallback: string =
    user?.firstName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-4 lg:px-8 text-slate-100">
      {/* Left Area: Toggle & Org Indicator */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-slate-300 hover:bg-slate-800"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Organization Context Indicator */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-1.5 border border-slate-800 text-sm font-medium">
          <Building2 className="h-4 w-4 text-blue-400" />
          <span className="text-slate-200 capitalize">{orgSlug} Workspace</span>
        </div>
      </div>

      {/* Right Area: User Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-3 rounded-full p-1.5 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-expanded={showUserMenu}
          aria-haspopup="true"
        >
          <Avatar
            fallback={avatarFallback}
            className="h-8 w-8 bg-blue-600 text-white font-semibold"
          />
          <span className="hidden sm:inline-block text-sm font-medium text-slate-200">
            {displayName}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-100 shadow-xl z-50">
            <div className="px-3 py-2 border-b border-slate-800">
              <p className="text-sm font-semibold text-white">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>

            <div className="py-1">
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                <UserIcon className="h-3.5 w-3.5" />
                <span>Identity: {user?.id}</span>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-1">
              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  await logout();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
