import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PlanningService } from './planning.service';
import { Turn } from '../groups/group.types';
jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));
const members = ['Maya', 'Dev', 'Sam', 'Nazar'].map((name, i) => ({
  id: String(i),
  name,
  context: `PRIVATE_CONTEXT_${i}`,
}));
const response = (value: unknown) => ({
  choices: [{ message: { content: JSON.stringify(value) } }],
});
describe('Bounded planning pipeline', () => {
  const original = global.fetch;
  const config = new ConfigService({
    OPENROUTER_API_KEY: 'test',
    EXA_API_KEY: 'test',
  });
  const calls: any[] = [];
  let voteAttempts = 0;
  let badFinal = false;
  beforeEach(() => {
    calls.length = 0;
    voteAttempts = 0;
    badFinal = false;
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(async (input) => {
            calls.push(input);
            const data = JSON.parse(input.messages[1].content);
            if (data.person) {
              if (data.person.id === '0' && voteAttempts++ === 0)
                return response({
                  yes: ['invented'],
                  maybe: [],
                  no: [],
                  top3: [],
                });
              return response({
                yes: ['c1'],
                maybe: ['c2'],
                no: ['c3'],
                top3: ['c1', 'c2'],
                reasons: {
                  c1: 'Fits my interests.',
                  c2: 'A mixed fit.',
                  c3: 'Conflicts with my preference.',
                },
              });
            }
            if (data.winners)
              return response({
                title: 'A shared evening',
                steps: data.winners.map((w) => ({
                  candidateId: badFinal ? 'invented' : w.id,
                  what: 'Visit this place',
                })),
                compromise: 'Maya gives up her first choice.',
              });
            if (data.candidates)
              return response({
                candidates: data.candidates.map((c, i) => ({
                  id: c.id,
                  activity: ['food', 'arts_culture', 'outdoors'][i],
                  venueKey: c.title,
                })),
              });
            return response({
              queries: ['food', 'books', 'music'],
              text: 'Finding three kinds of places.',
            });
          }),
        },
      },
    }));
    global.fetch = jest.fn(async () =>
      Response.json({
        results: [1, 2, 3].map((i) => ({
          title: 'Place ' + i,
          url: `https://venue${i}.example.com/`,
          text: 'Grounded venue description',
        })),
      }),
    );
  });
  afterEach(() => {
    global.fetch = original;
  });
  it('retries one invalid vote, keeps attribution/order, persists each turn, and uses Exa URLs', async () => {
    const progress: Turn[][] = [];
    const result = await new PlanningService(config).run(
      'Brooklyn',
      members,
      async (t) => {
        progress.push(t);
      },
    );
    expect(calls).toHaveLength(8);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(progress.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.transcript.map((t) => t.speaker)).toEqual([
      'Orchestrator',
      ...members.map((m) => m.name),
      'Orchestrator',
    ]);
    expect(
      result.plan.steps.every((s) => s.url.startsWith('https://venue')),
    ).toBe(true);
    expect(result.schemaVersion).toBe(2);
    expect(
      result.plan.steps.every((s) => !('time' in s) && s.fit.length === 4),
    ).toBe(true);
    expect(result.plan.steps[0].fit.map((f) => f.name)).toEqual(
      members.map((m) => m.name),
    );
    for (const call of calls.filter(
      (c) => JSON.parse(c.messages[1].content).person,
    )) {
      const member = JSON.parse(call.messages[1].content).person;
      expect(
        members
          .filter((m) => m.id !== member.id)
          .every((m) => !JSON.stringify(call.messages).includes(m.context)),
      ).toBe(true);
    }
  });
  it('stops after a second invalid final and leaves search plus all four votes available', async () => {
    badFinal = true;
    const progress: Turn[][] = [];
    await expect(
      new PlanningService(config).run('Brooklyn', members, async (t) => {
        progress.push(t);
      }),
    ).rejects.toThrow('incomplete round twice');
    expect(calls).toHaveLength(9);
    expect(progress.at(-1)).toHaveLength(5);
  });
});
