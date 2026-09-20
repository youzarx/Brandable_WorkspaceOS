'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../context/auth-context';
import { Sidebar } from '../../../../components/platform/sidebar';
import { Topbar } from '../../../../components/platform/topbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@platform/ui';
import { ALL_MODULE_KEYS, type ModuleKey } from '@platform/config';
import { ShieldCheck, UserCheck, Layers, Building2, Lock } from 'lucide-react';

const MODULE_ITEMS: { key: ModuleKey; name: string; description: string }[] = ALL_MODULE_KEYS.map(
  (key) => ({
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    description: `Modular ${key.charAt(0).toUpperCase() + key.slice(1)} component placeholder (Phase 5+)`,
  }),
);

export default function DashboardPage(): React.JSX.Element {
  const params = useParams();
  const orgSlug = (params['orgSlug'] as string) || 'default';
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span>Loading workspace context...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Navigation Sidebar */}
      <Sidebar orgSlug={orgSlug} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar orgSlug={orgSlug} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Workspace Overview
              </h1>
              <p className="text-slate-400 mt-1">
                Authenticated user identity and active tenant context
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1.5 border border-blue-500/20 text-xs font-semibold text-blue-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Database Authoritative Auth</span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-slate-800 bg-slate-900 text-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">User Identity</CardTitle>
                <UserCheck className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-white">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
                    'Authenticated User'}
                </div>
                <p className="text-xs text-slate-400 mt-1 truncate">{user?.email}</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900 text-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Tenant Organization
                </CardTitle>
                <Building2 className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-white capitalize">{orgSlug}</div>
                <p className="text-xs text-slate-400 mt-1">Server-Resolved Membership Context</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900 text-slate-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">
                  Module Registry
                </CardTitle>
                <Layers className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-white">
                  {MODULE_ITEMS.length} Registered
                </div>
                <p className="text-xs text-slate-400 mt-1">Modular Platform Monolith</p>
              </CardContent>
            </Card>
          </div>

          {/* Platform Modules Readiness Grid */}
          <Card className="border-slate-800 bg-slate-900 text-slate-100">
            <CardHeader>
              <CardTitle className="text-lg">Modular System Registry</CardTitle>
              <CardDescription className="text-slate-400">
                Phase 4 Next.js App Router shell consuming Phase 3 PostgreSQL/NestJS backend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MODULE_ITEMS.map((mod: { key: ModuleKey; name: string; description: string }) => (
                  <div
                    key={mod.key}
                    className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950 p-4 transition-all hover:border-slate-700"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{mod.name}</span>
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">{mod.description}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Key: {mod.key}</span>
                      <span className="font-semibold text-slate-600 bg-slate-900 px-2 py-0.5 rounded">
                        Placeholder
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
