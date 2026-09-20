import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ApiConfigService } from '../../config/api-config.service.js';
import {
  hashPassword,
  verifyPassword,
  generateRawRefreshToken,
  hashRefreshToken,
  generateFamilyId,
  signAccessToken,
} from '@platform/auth';
import { MembershipStatus } from '@platform/database';
import type { AuthenticatedUser } from '@platform/types';
import type { LoginInput, RegisterInput, ChangePasswordInput } from '@platform/validation';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiConfig: ApiConfigService,
  ) {}

  /**
   * Registers a new user, creates their initial organization, assigns OWNER system role,
   * enables default modules, and creates audit log in a single atomic Prisma transaction.
   */
  async register(input: RegisterInput): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    user: AuthenticatedUser;
  }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictException('Email address already registered');
    }

    const hashedPassword = await hashPassword(input.password);
    const orgSlug = `org-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const { user, rawRefreshToken } = await this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: hashedPassword,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      // 2. Create Organization
      const newOrg = await tx.organization.create({
        data: {
          name: `${input.firstName}'s Organization`,
          slug: orgSlug,
        },
      });

      // 3. Find OWNER system role
      const ownerRole = await tx.role.findFirst({
        where: { name: 'OWNER', organizationId: null, isSystem: true },
      });

      if (!ownerRole) {
        throw new Error('System OWNER role missing');
      }

      // 4. Create Membership
      await tx.membership.create({
        data: {
          userId: newUser.id,
          organizationId: newOrg.id,
          roleId: ownerRole.id,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      // 5. Enable default modules for tenant
      const modules = await tx.module.findMany();
      if (modules.length > 0) {
        await tx.organizationModule.createMany({
          data: modules.map((m) => ({
            organizationId: newOrg.id,
            moduleId: m.id,
            isEnabled: true,
          })),
        });
      }

      // 6. Write AuditLog
      await tx.auditLog.create({
        data: {
          organizationId: newOrg.id,
          userId: newUser.id,
          action: 'membership.created',
          resource: 'Membership',
          metadata: { role: 'OWNER', isInitialUser: true },
        },
      });

      // 7. Create RefreshToken record
      const rawToken = generateRawRefreshToken();
      const tokenHash = hashRefreshToken(rawToken);
      const familyId = generateFamilyId();
      const expiresAt = new Date(
        Date.now() + this.apiConfig.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
      );

      await tx.refreshToken.create({
        data: {
          userId: newUser.id,
          tokenHash,
          familyId,
          expiresAt,
        },
      });

      return {
        user: {
          id: newUser.id,
          userId: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName ?? undefined,
          lastName: newUser.lastName ?? undefined,
        },
        rawRefreshToken: rawToken,
      };
    });

    const accessToken = signAccessToken(
      { userId: user.id, email: user.email },
      this.apiConfig.jwtAccessSecret,
      this.apiConfig.jwtAccessExpiry,
    );

    return { accessToken, rawRefreshToken, user };
  }

  /**
   * Authenticates user credentials and generates a new access token and refresh token family.
   */
  async login(input: LoginInput): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    user: AuthenticatedUser;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });

    // Generic error response to prevent user enumeration
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update lastLoginAt timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const rawRefreshToken = generateRawRefreshToken();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const familyId = generateFamilyId();
    const expiresAt = new Date(
      Date.now() + this.apiConfig.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt,
      },
    });

    const accessToken = signAccessToken(
      { userId: user.id, email: user.email },
      this.apiConfig.jwtAccessSecret,
      this.apiConfig.jwtAccessExpiry,
    );

    const authUser: AuthenticatedUser = {
      id: user.id,
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    };

    return { accessToken, rawRefreshToken, user: authUser };
  }

  /**
   * Rotates refresh tokens using atomic PostgreSQL conditional update.
   * Handles concurrent refresh safety and theft detection.
   */
  async refresh(rawRefreshToken: string): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    user: AuthenticatedUser;
  }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);

    // Atomic conditional UPDATE: revoke token ONLY if currently active and not expired
    const updatedTokens = await this.prisma.$queryRaw<
      Array<{ id: string; familyId: string; userId: string }>
    >`
      UPDATE "RefreshToken"
      SET "revokedAt" = NOW()
      WHERE "tokenHash" = ${tokenHash}
        AND "revokedAt" IS NULL
        AND "expiresAt" > NOW()
      RETURNING "id", "familyId", "userId";
    `;

    if (!updatedTokens || updatedTokens.length === 0) {
      // Losing request in race condition or invalid/revoked token
      const existingToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!existingToken) {
        throw new UnauthorizedException('INVALID_TOKEN');
      }

      // Check if token was previously revoked
      if (existingToken.revokedAt !== null) {
        // Theft detection: check if active tokens exist in family
        const activeFamilyTokens = await this.prisma.refreshToken.findMany({
          where: {
            familyId: existingToken.familyId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        });

        if (activeFamilyTokens.length > 0) {
          // REVOKE ENTIRE FAMILY — theft suspected
          await this.prisma.refreshToken.updateMany({
            where: { familyId: existingToken.familyId },
            data: { revokedAt: new Date() },
          });

          throw new UnauthorizedException('SESSION_COMPROMISED');
        } else {
          // Family is already fully revoked / expired
          throw new UnauthorizedException('INVALID_TOKEN');
        }
      }

      // Expired token
      throw new UnauthorizedException('INVALID_TOKEN');
    }

    const consumedToken = updatedTokens[0];
    if (!consumedToken) {
      throw new UnauthorizedException('INVALID_TOKEN');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: consumedToken.userId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('User account deactivated');
    }

    // Issue successor token in same family
    const newRawRefreshToken = generateRawRefreshToken();
    const newHash = hashRefreshToken(newRawRefreshToken);
    const expiresAt = new Date(
      Date.now() + this.apiConfig.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newHash,
        familyId: consumedToken.familyId,
        expiresAt,
      },
    });

    const accessToken = signAccessToken(
      { userId: user.id, email: user.email },
      this.apiConfig.jwtAccessSecret,
      this.apiConfig.jwtAccessExpiry,
    );

    const authUser: AuthenticatedUser = {
      id: user.id,
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    };

    return {
      accessToken,
      rawRefreshToken: newRawRefreshToken,
      user: authUser,
    };
  }

  /**
   * Revokes the current refresh token on logout.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = hashRefreshToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Changes user password, hashes new password (cost 12), and revokes ALL active sessions in transaction.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValidPassword = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new BadRequestException('Current password incorrect');
    }

    const newHashedPassword = await hashPassword(input.newPassword);

    await this.prisma.$transaction(async (tx) => {
      // 1. Update passwordHash
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHashedPassword },
      });

      // 2. Revoke ALL refresh tokens for user
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Returns current authenticated user profile excluding passwordHash.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
