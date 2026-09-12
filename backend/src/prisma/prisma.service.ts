import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { withReadConnectionRetry } from './read-retry';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleDestroy, OnModuleInit
{
  constructor() {
    super();
    this.$use((params, next) =>
      withReadConnectionRetry(params.action, () => next(params)),
    );
  }
  async onModuleInit(): Promise<void> {
    // Establish the pool before accepting requests. Only initialization is retried;
    // never retry a potentially committed write on an ambiguous network failure.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        return;
      } catch (error) {
        await this.$disconnect();
        if (attempt === 2) {
          // Keep the HTTP service available through a temporary database outage.
          // Subsequent read requests use the bounded P1001 retry middleware.
          new Logger(PrismaService.name).warn(
            'Database unavailable during startup; requests will reconnect.',
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
