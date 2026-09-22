'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/auth-context';
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
import { Users, UserPlus, Shield, Trash2, AlertCircle, Check, Loader2 } from 'lucide-react';

interface MemberUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  lastLoginAt?: string | null;
}

interface MemberRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
}

interface MemberItem {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  joinedAt?: string | null;
  createdAt: string;
  user: MemberUser;
  role: MemberRole;
}

export default function MembersPage(): React.JSX.Element {
  const { user: currentUser } = useAuth();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [roles, setRoles] = useState<MemberRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);

  // Role Change State
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [newRoleId, setNewRoleId] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Remove Member State
  const [removingMember, setRemovingMember] = useState<MemberItem | null>(null);
  const [removing, setRemoving] = useState(false);

  // Ownership Privilege Check
  const currentActorMember = members.find(
    (m) => m.userId === currentUser?.id || m.user.id === currentUser?.id,
  );
  const isOwnerActor = currentActorMember?.role.name === 'OWNER';

  // Filter assignable roles for non-owners
  const assignableRoles = roles.filter((r) => isOwnerActor || r.name !== 'OWNER');

  useEffect(() => {
    void loadMembersAndRoles();
  }, []);

  async function loadMembersAndRoles() {
    try {
      setLoading(true);
      setError(null);
      const [membersData, rolesData] = await Promise.all([
        api.get<MemberItem[]>('/organizations/current/members'),
        api.get<MemberRole[]>('/organizations/current/roles'),
      ]);
      setMembers(membersData);
      setRoles(rolesData);
      if (rolesData.length > 0 && !inviteRoleId) {
        const defaultRole = rolesData.find((r) => r.name === 'MEMBER') || rolesData[0];
        if (defaultRole) {
          setInviteRoleId(defaultRole.id);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load members or roles');
      }
    } finally {
      setLoading(false);
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInviting(true);
      setError(null);
      setSuccess(null);

      await api.post<MemberItem>('/organizations/current/members', {
        email: inviteEmail,
        roleId: inviteRoleId,
      });

      setSuccess(`Member "${inviteEmail}" added/invited successfully!`);
      setInviteEmail('');
      setShowInviteModal(false);
      await loadMembersAndRoles();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to invite member');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      setUpdatingRole(true);
      setError(null);
      setSuccess(null);

      await api.patch<MemberItem>(`/organizations/current/members/${editingMember.id}`, {
        roleId: newRoleId,
      });

      setSuccess(`Role updated for ${editingMember.user.email}`);
      setEditingMember(null);
      await loadMembersAndRoles();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update member role');
      }
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    try {
      setRemoving(true);
      setError(null);
      setSuccess(null);

      await api.delete<{ message: string }>(`/organizations/current/members/${removingMember.id}`);

      setSuccess(`Member ${removingMember.user.email} removed from organization.`);
      setRemovingMember(null);
      await loadMembersAndRoles();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to remove member');
      }
    } finally {
      setRemoving(false);
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization Members</h1>
          <p className="text-sm text-slate-500">
            Invite, view, and manage roles for members of this workspace.
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <span>Invite Member</span>
        </Button>
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

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <CardTitle>Active Workspace Members ({members.length})</CardTitle>
          </div>
          <CardDescription>
            Members have access to workspace resources based on their assigned role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const isTargetOwner = member.role.name === 'OWNER';
                  const canManageTarget = isOwnerActor || !isTargetOwner;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {member.user.firstName || member.user.lastName
                            ? `${member.user.firstName || ''} ${member.user.lastName || ''}`
                            : 'User'}
                        </div>
                        <div className="text-xs text-slate-500">{member.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                          <Shield className="h-3 w-3" />
                          {member.role.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {member.joinedAt
                          ? new Date(member.joinedAt).toLocaleDateString()
                          : 'Pending'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canManageTarget}
                            title={
                              !canManageTarget
                                ? 'Only an OWNER can modify OWNER memberships'
                                : undefined
                            }
                            onClick={() => {
                              setEditingMember(member);
                              setNewRoleId(member.role.id);
                            }}
                          >
                            Edit Role
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={!canManageTarget}
                            title={
                              !canManageTarget
                                ? 'Only an OWNER can remove OWNER memberships'
                                : undefined
                            }
                            onClick={() => setRemovingMember(member)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Invite New Member</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inviteRole">Role</Label>
                <select
                  id="inviteRole"
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.description ? `(${r.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviting}>
                  {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Change Role for {editingMember.user.email}
            </h3>
            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="newRole">Select Role</Label>
                <select
                  id="newRole"
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.description ? `(${r.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMember(null)}
                  disabled={updatingRole}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingRole}>
                  {updatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Remove Member</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to remove <strong>{removingMember.user.email}</strong> from this
              organization? Their membership will be soft-deleted, but their user account will
              remain intact.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRemovingMember(null)}
                disabled={removing}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemoveMember} disabled={removing}>
                {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
