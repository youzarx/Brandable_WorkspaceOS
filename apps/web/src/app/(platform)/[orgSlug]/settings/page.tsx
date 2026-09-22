'use client';

import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../../../../lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
} from '@platform/ui';
import { Shield, Check, AlertCircle, Loader2 } from 'lucide-react';

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  favicon?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export default function OrganizationSettingsPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    logo: '',
    favicon: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
  });

  useEffect(() => {
    async function loadOrg() {
      try {
        setLoading(true);
        setError(null);
        const org = await api.get<OrganizationData>('/organizations/current');
        setFormData({
          name: org.name || '',
          slug: org.slug || '',
          logo: org.logo || '',
          favicon: org.favicon || '',
          primaryColor: org.primaryColor || '#3b82f6',
          secondaryColor: org.secondaryColor || '#10b981',
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load organization settings');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadOrg();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        name: formData.name,
        slug: formData.slug,
        logo: formData.logo ? formData.logo : undefined,
        favicon: formData.favicon ? formData.favicon : undefined,
        primaryColor: formData.primaryColor ? formData.primaryColor : undefined,
        secondaryColor: formData.secondaryColor ? formData.secondaryColor : undefined,
      };

      const updated = await api.patch<OrganizationData>('/organizations/current', payload);

      setFormData((prev) => ({
        ...prev,
        name: updated.name,
        slug: updated.slug,
      }));

      setSuccess('Organization settings saved successfully!');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update organization settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your organization&apos;s identity, URL slug, and brand configuration.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <CardTitle>General Information</CardTitle>
            </div>
            <CardDescription>Basic details for your tenant workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Corp"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">Workspace Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="acme-corp"
                required
              />
              <p className="text-xs text-slate-500">
                Used in your workspace URL path. Must be lowercase alphanumeric characters or
                hyphens.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-medium text-slate-900 mb-3">Branding Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      id="primaryColor"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="h-10 w-12 rounded border border-slate-300 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      id="secondaryColor"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="h-10 w-12 rounded border border-slate-300 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      placeholder="#10b981"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
