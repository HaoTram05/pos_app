import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('org')
export class OrgController {
  constructor(private prisma: PrismaService) {}

  @Get(':subdomain')
  async bySub(@Param('subdomain') subdomain: string) {
    const org = await this.prisma.organization.findUnique({ where: { subdomain } });
    return org || {};
  }
}
