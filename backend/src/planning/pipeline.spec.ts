import {
  agentMessages,
  candidatesFrom,
  mostCompromised,
  tally,
  validateClassification,
  validateFinal,
  validateSearch,
  validateVote,
  voteTurn,
} from './pipeline';
import { ClassifiedCandidate } from '../groups/group.types';
const members = [
  { id: 'a', name: 'Alice', context: 'Quiet vegan food only' },
  { id: 'b', name: 'Bob', context: 'SECRET_OTHER_CONTEXT' },
];
const candidates: ClassifiedCandidate[] = ['A', 'B', 'C', 'D'].map(
  (title, i) => ({
    id: `c${i + 1}`,
    title,
    url: `https://example.com/${title}`,
    snippet: 'snippet',
    activity: (['food', 'arts_culture', 'outdoors', 'cafe_bar'] as const)[i],
    venueKey: title.toLowerCase(),
  }),
);
const reasons = Object.fromEntries(
  candidates.map((c) => [c.id, 'A personal reason for ' + c.title]),
);
const ballot = {
  yes: ['c1', 'c2'],
  maybe: ['c3'],
  no: ['c4'],
  top3: ['c2', 'c1', 'c3'],
  reasons,
};
describe('Planning invariants', () => {
  it('keeps every advocate isolated from other people and votes', () => {
    const prompt = JSON.stringify(agentMessages(members[0], candidates));
    expect(prompt).toContain(members[0].context);
    expect(prompt).not.toContain(members[1].context);
    expect(prompt).not.toContain('https://');
  });
  it('rejects missing, duplicate, invented, and ineligible candidate votes', () => {
    expect(validateVote(ballot, candidates, members[0]).memberId).toBe('a');
    for (const invalid of [
      null,
      { ...ballot, no: [] },
      { ...ballot, no: ['c1'] },
      { ...ballot, no: ['invented'] },
      { ...ballot, top3: ['c4'] },
      { ...ballot, top3: ['c3', 'c1', 'c2'] },
      { ...ballot, top3: ['c1', 'c1', 'c3'] },
      { ...ballot, reasons: {} },
      { ...ballot, reasons: { ...reasons, c1: ' ' } },
      { ...ballot, reasons: { ...reasons, c1: 'a'.repeat(161) } },
      { ...ballot, reasons: { ...reasons, invented: 'a reason' } },
    ])
      expect(() => validateVote(invalid, candidates, members[0])).toThrow();
  });
  it('tallies net yes before top picks, keeping stable candidate order on ties', () => {
    const vote = validateVote(ballot, candidates, members[0]);
    const other = validateVote(
      {
        yes: ['c3'],
        maybe: ['c1', 'c4'],
        no: ['c2'],
        top3: ['c3', 'c4', 'c1'],
        reasons,
      },
      candidates,
      members[1],
    );
    expect(tally(candidates, [vote, other]).map((c) => c.id)).toEqual([
      'c1',
      'c3',
      'c2',
    ]);
    expect(voteTurn(vote, candidates)).toEqual({
      speaker: 'Alice',
      kind: 'vote',
      text: '2 yes, 1 maybe, 1 no — top pick: B.',
    });
    expect(
      mostCompromised(members, [vote, other], ['c1', 'c2', 'c3']).map(
        (m) => m.name,
      ),
    ).toEqual(['Bob']);
  });
  it('chooses distinct activities even when the three highest votes are all museums', () => {
    const options: ClassifiedCandidate[] = [
      'Museum A',
      'Museum B',
      'Museum C',
      'Tacos',
      'Park',
    ].map((title, i) => ({
      id: 'c' + (i + 1),
      title,
      snippet: '',
      url: 'https://example.com/' + i,
      activity: i < 3 ? 'arts_culture' : i === 3 ? 'food' : 'outdoors',
      venueKey: title,
    }));
    const vote = {
      ...validateVote(ballot, candidates, members[0]),
      yes: ['c1', 'c2', 'c3'],
      maybe: ['c4', 'c5'],
      no: [],
      top3: ['c1', 'c2', 'c3'],
    };
    expect(tally(options, [vote]).map((c) => c.id)).toEqual(['c1', 'c4', 'c5']);
    expect(tally(options.slice(0, 3), [vote])).toHaveLength(1);
  });
  it('validates classification and collapses the same venue across different websites', () => {
    const classification = {
      candidates: candidates.map((c, i) => ({
        id: c.id,
        activity: c.activity,
        venueKey: i < 2 ? 'Fajitas Sunrise Queens' : c.venueKey,
      })),
    };
    expect(
      validateClassification(classification, candidates).map((c) => c.id),
    ).toEqual(['c1', 'c3', 'c4']);
    for (const invalid of [
      { candidates: classification.candidates.slice(1) },
      {
        candidates: classification.candidates.map((c) => ({ ...c, id: 'c1' })),
      },
      {
        candidates: classification.candidates.map((c) => ({
          ...c,
          activity: 'museum_garden',
        })),
      },
    ])
      expect(() => validateClassification(invalid, candidates)).toThrow();
  });
  it('maps only winning IDs to original URLs and requires a named compromise', () => {
    const winners = candidates.slice(0, 3);
    const final = {
      title: 'Evening',
      steps: winners.map((c) => ({
        candidateId: c.id,
        what: 'Visit',
        url: 'https://invented.example',
      })),
      compromise: 'Alice accepts an earlier night.',
    };
    const votes = [validateVote(ballot, candidates, members[0])];
    expect(
      validateFinal(final, winners, members, votes).steps.map((s) => s.url),
    ).toEqual(winners.map((c) => c.url));
    const plan = validateFinal(final, winners, members, votes);
    expect(plan.steps[0]).not.toHaveProperty('time');
    expect(plan.steps[0].fit).toEqual([
      { memberId: 'a', name: 'Alice', vote: 'yes', reason: reasons.c1 },
    ]);
    expect(() =>
      validateFinal(
        { ...final, steps: final.steps.map((s) => ({ ...s, time: '7pm' })) },
        winners,
        members,
        votes,
      ),
    ).toThrow();
    expect(() =>
      validateFinal(
        { ...final, compromise: 'Everyone wins' },
        winners,
        members,
        votes,
      ),
    ).toThrow();
    expect(() =>
      validateFinal(
        {
          ...final,
          steps: [
            ...final.steps.slice(0, 2),
            { ...final.steps[2], candidateId: 'c4' },
          ],
        },
        winners,
        members,
        votes,
      ),
    ).toThrow();
    expect(() =>
      validateFinal(
        { ...final, steps: [final.steps[0], final.steps[0], final.steps[2]] },
        winners,
        members,
        votes,
      ),
    ).toThrow();
  });
  it('deduplicates, limits and trims Exa candidates before model calls', () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      title: 'Venue ' + i,
      url: `https://venue${i}.example.com/`,
      text: 'a'.repeat(8000),
    }));
    records.unshift({ ...records[0], url: records[0].url + '#top' });
    const result = candidatesFrom([
      ...records,
      { title: 'bad', url: 'javascript:alert(1)' },
      {
        title: 'Social profile',
        url: 'https://www.linkedin.com/company/venue',
      },
    ]);
    expect(result).toHaveLength(15);
    expect(result.every((c) => c.snippet.length === 700)).toBe(true);
    expect(new Set(result.map((c) => c.url)).size).toBe(15);
    expect(
      candidatesFrom([
        { title: 'Venue', url: 'https://venue.example.com/' },
        { title: 'Calendar', url: 'https://calendar.venue.example.com/events' },
      ]),
    ).toHaveLength(1);
    expect(() => validateSearch({ queries: ['one'], text: 'hi' })).toThrow();
  });
});
