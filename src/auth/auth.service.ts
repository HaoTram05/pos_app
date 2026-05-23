import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  private jwtSecret = process.env.JWT_SECRET || 'secret';

  private signAccess(payload: any) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  private randomToken() {
    return crypto.randomBytes(48).toString('hex');
  }
  private hashToken(t: string) {
    return crypto.createHash('sha256').update(t).digest('hex');
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already used');

    if (dto.subdomain) {
      const sub = await this.prisma.organization.findUnique({ where: { subdomain: dto.subdomain } });
      if (sub) throw new BadRequestException('Subdomain already used');
    }

    const hashed = await bcrypt.hash(dto.password, 12);

    const { user, org } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.orgName, subdomain: dto.subdomain, currency: 'VND' },
      });
      const user = await tx.user.create({
        data: { email: dto.email, hashedPwd: hashed, fullName: dto.fullName },
      });
      await tx.userOrgRole.create({
        data: { userId: user.id, orgId: org.id, role: 'OWNER' },
      });
      return { user, org };
    });

    const accessToken = this.signAccess({ sub: user.id, orgId: org.id, roles: ['OWNER'] });

    const refreshRaw = this.randomToken();
    const refreshHash = this.hashToken(refreshRaw);
    const expires = new Date();
    expires.setDate(expires.getDate() + Number(process.env.REFRESH_EXPIRES_DAYS || 30));
    await this.prisma.refreshToken.create({
      data: { userId: user.id, orgId: org.id, tokenHash: refreshHash, expiresAt: expires },
    });

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      org,
      accessToken,
      refreshToken: refreshRaw,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(dto.password, user.hashedPwd);
    if (!ok) throw new UnauthorizedException();

    const link = await this.prisma.userOrgRole.findFirst({ where: { userId: user.id } });
    if (!link) throw new UnauthorizedException('No organization linked');

    const accessToken = this.signAccess({ sub: user.id, orgId: link.orgId, roles: [link.role] });
    const refreshRaw = this.randomToken();
    const refreshHash = this.hashToken(refreshRaw);
    const expires = new Date();
    expires.setDate(expires.getDate() + Number(process.env.REFRESH_EXPIRES_DAYS || 30));
    await this.prisma.refreshToken.create({
      data: { userId: user.id, orgId: link.orgId, tokenHash: refreshHash, expiresAt: expires },
    });

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      orgId: link.orgId,
      accessToken,
      refreshToken: refreshRaw,
    };
  }

  async refresh(token: string) {
    const tokenHash = this.hashToken(token);
    const rec = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    });
    if (!rec) throw new UnauthorizedException();

    const accessToken = this.signAccess({ sub: rec.userId, orgId: rec.orgId, roles: [] });
    return { accessToken };
  }

  async logout(token: string) {
    const tokenHash = this.hashToken(token);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
    return { success: true };
  }
}
