import { Prisma } from '@prisma/client';

const reads = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

export async function withReadConnectionRetry<T>(
  action: string,
  query: () => Promise<T>,
  wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await query();
    } catch (error) {
      const unavailable =
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P1001') ||
        (error instanceof Prisma.PrismaClientInitializationError &&
          error.errorCode === 'P1001');
      if (!reads.has(action) || !unavailable || attempt >= 2) throw error;
      await wait(400 * (attempt + 1));
    }
  }
}
