export interface Member {
  id: string;
  name: string;
  context: string;
}
export interface Candidate {
  id: string;
  title: string;
  snippet: string;
  url: string;
}
export const ACTIVITIES = [
  'food',
  'outdoors',
  'arts_culture',
  'games_sports',
  'workshop',
  'music_nightlife',
  'cafe_bar',
  'shopping',
] as const;
export interface ClassifiedCandidate extends Candidate {
  activity: (typeof ACTIVITIES)[number];
  venueKey: string;
}
export interface Vote {
  memberId: string;
  name: string;
  yes: string[];
  maybe: string[];
  no: string[];
  top3: string[];
  reasons: Record<string, string>;
}
export interface MemberFit {
  memberId: string;
  name: string;
  vote: 'yes' | 'maybe' | 'no';
  reason: string;
}
export interface Turn {
  speaker: string;
  kind: 'search' | 'vote' | 'final';
  text: string;
}
export interface Round {
  schemaVersion: 2;
  transcript: Turn[];
  plan: {
    title: string;
    steps: { what: string; title: string; url: string; fit: MemberFit[] }[];
    compromise: string;
  };
  evidence?: {
    queries: string[];
    candidates: ClassifiedCandidate[];
    votes: Vote[];
    winnerIds: string[];
  };
}
export interface PlanRun {
  id: string;
  status: 'running' | 'complete' | 'failed';
  startedAt: string;
  transcript: Turn[];
  result?: Round;
  error?: string;
}
export interface SharedGroup {
  slug: string;
  city: string;
  members: Member[];
  revision: number;
  run: PlanRun | null;
}
