/**
 * Membership status values matching the Prisma MembershipStatus enum.
 */
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

/**
 * The active membership context object.
 * Populated by MembershipGuard onto req.membership for all org-scoped endpoints.
 * organizationId comes from the DB Membership record — never from client input.
 */
export interface ActiveMembership {
  id: string;
  membershipId: string;
  userId: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  status: MembershipStatus;
}
