import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generado/client.js';

@Injectable()
export class PrismaServicio extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL ?? 'postgresql://cobros:cobros@localhost:5440/cobros',
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
