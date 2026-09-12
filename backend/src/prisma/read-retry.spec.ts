import { Prisma } from '@prisma/client';
import { withReadConnectionRetry } from './read-retry';
const unavailable = () =>
  new Prisma.PrismaClientKnownRequestError('Cannot connect', {
    code: 'P1001',
    clientVersion: '5.22.0',
  });
const wait = async () => {};
describe('Transient read connections', () => {
  it('recovers an unavailable read without exposing a temporary failure', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue({ slug: 'demo' });
    await expect(
      withReadConnectionRetry('findUnique', query, wait),
    ).resolves.toEqual({ slug: 'demo' });
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('stops after three failed reads', async () => {
    const query = jest.fn().mockRejectedValue(unavailable());
    await expect(
      withReadConnectionRetry('findUnique', query, wait),
    ).rejects.toMatchObject({ code: 'P1001' });
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('never retries a write or an unrelated failure', async () => {
    for (const [action, error] of [
      ['create', unavailable()],
      ['updateMany', unavailable()],
      ['findUnique', new Error('Other failure')],
    ] as const) {
      const query = jest.fn().mockRejectedValue(error);
      await expect(withReadConnectionRetry(action, query, wait)).rejects.toBe(
        error,
      );
      expect(query).toHaveBeenCalledTimes(1);
    }
  });
});
