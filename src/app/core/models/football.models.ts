export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';

export type Stage =
  | 'GROUP_STAGE'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';

/** Raw shape stored in the static JSON files under /public/data. */
export interface TeamDto {
  id: number;
  name: string;
  shortName: string;
  crest: string;
  group: string | null;
}

export interface GoalDto {
  name: string;
  minute: string;
  penalty?: boolean;
  ownGoal?: boolean;
}

export interface MatchDto {
  id: number;
  utcDate: string;
  status: MatchStatus;
  stage: Stage;
  group: string | null;
  matchday: number;
  homeTeamId: number;
  awayTeamId: number;
  score: { home: number | null; away: number | null };
  goals?: { home: GoalDto[]; away: GoalDto[] };
}

/** Domain models used across the app (teams resolved on matches). */
export interface Team {
  id: number;
  name: string;
  shortName: string;
  crest: string;
  group: string | null;
}

export interface Match {
  id: number;
  utcDate: string;
  status: MatchStatus;
  stage: Stage;
  group: string | null;
  matchday: number;
  homeTeam: Team;
  awayTeam: Team;
  score: { home: number | null; away: number | null };
  goals: { home: GoalDto[]; away: GoalDto[] };
}

export interface Standing {
  team: Team;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupStandings {
  group: string;
  table: Standing[];
}

export interface MatchDay {
  /** ISO date key (yyyy-mm-dd) in local time. */
  dateKey: string;
  matches: Match[];
}

export const LIVE_STATUSES: ReadonlySet<MatchStatus> = new Set<MatchStatus>([
  'LIVE',
  'IN_PLAY',
  'PAUSED',
]);
