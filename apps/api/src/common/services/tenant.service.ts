import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class TenantService {
  constructor() {}

  /**
   * Asserts that a tenant-owned record belongs to the active organizationId.
   * Throws 404 (NotFoundException) if missing or mismatched to prevent IDOR disclosure.
   */
  async assertResourceOwnership<T extends { organizationId: string }>(
    resource: T | null,
    activeOrganizationId: string,
  ): Promise<T> {
    if (!resource || resource.organizationId !== activeOrganizationId) {
      throw new NotFoundException('Resource not found');
    }
    return resource;
  }
}
