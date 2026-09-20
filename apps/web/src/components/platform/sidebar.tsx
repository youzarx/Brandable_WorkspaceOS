'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ALL_MODULE_KEYS, type ModuleKey } from '@platform/config';
import { cn } from '@platform/ui';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  Users,
  Calendar,
  MessageSquare,
  FileCode,
  BarChart3,
  Shield,
  Lock,
} from 'lucide-react';

interface SidebarProps {
  orgSlug: string;
  isOpen: boolean;
  onClose?: () => void;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  projects: <FolderKanban className="h-4 w-4" />,
  tasks: <CheckSquare className="h-4 w-4" />,
  invoices: <FileText className="h-4 w-4" />,
  crm: <Users className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  chat: <MessageSquare className="h-4 w-4" />,
  content: <FileCode className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
};

const MODULE_ITEMS: { key: ModuleKey; name: string }[] = ALL_MODULE_KEYS.map((key) => ({
  key,
  name: key.charAt(0).toUpperCase() + key.slice(1),
}));

export function Sidebar({ orgSlug, isOpen, onClose }: SidebarProps): React.JSX.Element {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 transition-transform duration-200 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Platform Header */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight text-lg">WorkspaceOS</span>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {/* Main Dashboard Link */}
          <Link
            href={`/${orgSlug}/dashboard`}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === `/${orgSlug}/dashboard`
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <div className="pt-4 pb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Platform Modules
          </div>

          {/* Module Placeholders */}
          {MODULE_ITEMS.map((mod) => {
            const icon = MODULE_ICONS[mod.key] || <FolderKanban className="h-4 w-4" />;
            return (
              <div
                key={mod.key}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-500 opacity-60 cursor-not-allowed select-none hover:bg-slate-800/30"
                title={`${mod.name} module placeholder (Phase 5+)`}
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <span>{mod.name}</span>
                </div>
                <span className="flex items-center text-[10px] font-semibold text-slate-500 gap-1 bg-slate-800 px-1.5 py-0.5 rounded">
                  <Lock className="h-3 w-3" />
                </span>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500 text-center">
          WorkspaceOS Foundation v0.1
        </div>
      </aside>
    </>
  );
}
