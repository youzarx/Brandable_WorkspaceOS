'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth-context';
import { Button } from '@platform/ui';
import { LayoutDashboard, LogIn, UserPlus, ShieldCheck } from 'lucide-react';

export default function RootPage(): React.JSX.Element {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-6">
      <div className="w-full max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-500/10 border border-blue-500/20 mb-2">
          <ShieldCheck className="h-8 w-8 text-blue-400" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Multi-Tenant Workspace Platform
        </h1>
        <p className="text-slate-400 text-lg">
          Secure, white-label ready SaaS workspace OS foundation. Consumes NestJS API with
          database-authoritative authorization.
        </p>

        {isLoading ? (
          <div className="py-6 text-slate-400">Loading authentication state...</div>
        ) : isAuthenticated && user ? (
          <div className="pt-4 space-y-4">
            <p className="text-sm text-slate-300">
              Signed in as <span className="font-semibold text-white">{user.email}</span>
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/default/dashboard">
                <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-500">
                  <LayoutDashboard className="h-5 w-5" />
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex justify-center gap-4 pt-4">
            <Link href="/login">
              <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-500">
                <LogIn className="h-5 w-5" />
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <UserPlus className="h-5 w-5" />
                Register
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
