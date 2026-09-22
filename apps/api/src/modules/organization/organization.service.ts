import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, Organization } from '@platform/database';
import type { UpdateOrganizationInput } from '@platform/validation';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(organizationId: string): Promise<Organization> {
    const org = await this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async updateOrganization(
    organizationId: string,
    userId: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization> {
    const existingOrg = await this.getOrganization(organizationId);

    if (input.slug && input.slug !== existingOrg.slug) {
      const slugTaken = await this.prisma.organization.findFirst({
        where: {
          slug: input.slug,
          id: { not: organizationId },
        },
      });

      if (slugTaken) {
        throw new ConflictException('Organization slug is already in use');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: organizationId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.slug !== undefined && { slug: input.slug }),
          ...(input.logo !== undefined && { logo: input.logo }),
          ...(input.favicon !== undefined && { favicon: input.favicon }),
          ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
          ...(input.secondaryColor !== undefined && { secondaryColor: input.secondaryColor }),
          ...(input.brandingConfig !== undefined
            ? { brandingConfig: input.brandingConfig as Prisma.InputJsonValue }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: 'organization.updated',
          resource: 'Organization',
          resourceId: organizationId,
          metadata: { updatedFields: Object.keys(input) },
        },
      });

      return org;
    });

    return updated;
  }
}
