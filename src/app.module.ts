import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrgModule } from './org/org.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AuthModule, OrgModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
