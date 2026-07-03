import { GoalDto, MatchDto, Stage, TeamDto } from '../models/football.models';

export const OPENFOOTBALL_SOURCE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const PLACEHOLDER_CREST =
  'https://r2.thesportsdb.com/images/media/league/badge/e7er5g1696521789.png';

interface SourceGoal {
  name: string;
  minute: string;
  penalty?: boolean;
  owngoal?: boolean;
}

interface SourceMatch {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  score?: {
    ft?: [number, number];
  };
  goals1?: SourceGoal[];
  goals2?: SourceGoal[];
  group?: string;
  ground?: string;
}

export interface OpenFootballData {
  name: string;
  matches: SourceMatch[];
}

export interface OpenFootballSnapshot {
  teams: TeamDto[];
  matches: MatchDto[];
  source: string;
  updated: string;
}

const FLAG_CODES = new Map<string, string>([
  ['Algeria', 'dz'],
  ['Argentina', 'ar'],
  ['Australia', 'au'],
  ['Austria', 'at'],
  ['Belgium', 'be'],
  ['Bosnia & Herzegovina', 'ba'],
  ['Brazil', 'br'],
  ['Canada', 'ca'],
  ['Cape Verde', 'cv'],
  ['Colombia', 'co'],
  ['Croatia', 'hr'],
  ['Curacao', 'cw'],
  ['Czech Republic', 'cz'],
  ['DR Congo', 'cd'],
  ['Ecuador', 'ec'],
  ['Egypt', 'eg'],
  ['England', 'gb-eng'],
  ['France', 'fr'],
  ['Germany', 'de'],
  ['Ghana', 'gh'],
  ['Haiti', 'ht'],
  ['Iran', 'ir'],
  ['Iraq', 'iq'],
  ['Ivory Coast', 'ci'],
  ['Japan', 'jp'],
  ['Jordan', 'jo'],
  ['Mexico', 'mx'],
  ['Morocco', 'ma'],
  ['Netherlands', 'nl'],
  ['New Zealand', 'nz'],
  ['Norway', 'no'],
  ['Panama', 'pa'],
  ['Paraguay', 'py'],
  ['Portugal', 'pt'],
  ['Qatar', 'qa'],
  ['Saudi Arabia', 'sa'],
  ['Scotland', 'gb-sct'],
  ['Senegal', 'sn'],
  ['South Africa', 'za'],
  ['South Korea', 'kr'],
  ['Spain', 'es'],
  ['Sweden', 'se'],
  ['Switzerland', 'ch'],
  ['Tunisia', 'tn'],
  ['Turkey', 'tr'],
  ['Uruguay', 'uy'],
  ['USA', 'us'],
  ['Uzbekistan', 'uz'],
]);

const SHORT_NAMES = new Map<string, string>([
  ['Bosnia & Herzegovina', 'BIH'],
  ['Cape Verde', 'CPV'],
  ['Curacao', 'CUW'],
  ['Czech Republic', 'CZE'],
  ['DR Congo', 'COD'],
  ['Ivory Coast', 'CIV'],
  ['New Zealand', 'NZL'],
  ['Saudi Arabia', 'KSA'],
  ['South Africa', 'RSA'],
  ['South Korea', 'KOR'],
  ['USA', 'USA'],
]);

/** Maps raw openfootball JSON into the app's DTO shape. */
export function mapOpenFootballSource(source: OpenFootballData): OpenFootballSnapshot {
  const groupByTeam = new Map<string, string>();
  for (const match of source.matches) {
    if (match.group) {
      const group = groupKey(match.group);
      groupByTeam.set(match.team1, group ?? '');
      groupByTeam.set(match.team2, group ?? '');
    }
  }

  const teamNames = [...new Set(source.matches.flatMap((m) => [m.team1, m.team2]))].sort((a, b) =>
    a.localeCompare(b),
  );

  const teams: TeamDto[] = teamNames.map((name, index) => ({
    id: index + 1,
    name,
    shortName: shortName(name),
    crest: crest(name),
    group: groupByTeam.get(name) ?? null,
  }));

  const ids = new Map(teams.map((team) => [team.name, team.id]));

  const matches: MatchDto[] = source.matches.flatMap((m, index) => {
    const homeTeamId = ids.get(m.team1);
    const awayTeamId = ids.get(m.team2);
    if (homeTeamId === undefined || awayTeamId === undefined) {
      return [];
    }

    const score = finalScore(m);
    return [
      {
        id: index + 1,
        utcDate: toUtcIso(m.date, m.time),
        status: score ? 'FINISHED' : 'SCHEDULED',
        stage: stage(m.round),
        group: groupKey(m.group),
        matchday: matchday(m.round),
        homeTeamId,
        awayTeamId,
        score: score ?? { home: null, away: null },
        goals: {
          home: goals(m.goals1),
          away: goals(m.goals2),
        },
      },
    ];
  });

  return {
    teams,
    matches,
    source: source.name,
    updated: new Date().toISOString(),
  };
}

function normalizeTeamName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function isPlaceholder(name: string): boolean {
  return /^([12][A-L]|3[A-L](\/[^ ]+)?|W\d+|L\d+)$/.test(name);
}

function shortName(name: string): string {
  const normalized = normalizeTeamName(name);
  if (SHORT_NAMES.has(normalized)) return SHORT_NAMES.get(normalized)!;
  if (isPlaceholder(name)) return name;
  return normalized
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function crest(name: string): string {
  const code = FLAG_CODES.get(normalizeTeamName(name));
  return code ? `https://flagcdn.com/w320/${code}.png` : PLACEHOLDER_CREST;
}

function stage(round: string): Stage {
  if (round.startsWith('Matchday')) return 'GROUP_STAGE';
  if (round === 'Round of 32') return 'ROUND_OF_32';
  if (round === 'Round of 16') return 'ROUND_OF_16';
  if (round === 'Quarter-final') return 'QUARTER_FINAL';
  if (round === 'Semi-final') return 'SEMI_FINAL';
  if (round === 'Match for third place') return 'THIRD_PLACE';
  if (round === 'Final') return 'FINAL';
  return 'GROUP_STAGE';
}

function matchday(round: string): number {
  const n = round.match(/\d+/)?.[0];
  if (n) return Number(n);
  return (
    {
      'Round of 32': 32,
      'Round of 16': 16,
      'Quarter-final': 8,
      'Semi-final': 4,
      'Match for third place': 3,
      Final: 1,
    }[round] ?? 0
  );
}

function groupKey(group: string | undefined): string | null {
  return group?.replace('Group ', '') ?? null;
}

function finalScore(match: SourceMatch): { home: number; away: number } | null {
  const [home, away] = match.score?.ft ?? [];
  return typeof home === 'number' && typeof away === 'number' ? { home, away } : null;
}

function goals(sourceGoals: SourceGoal[] | undefined): GoalDto[] {
  return (sourceGoals ?? []).map((goal) => ({
    name: goal.name,
    minute: goal.minute,
    ...(goal.penalty ? { penalty: true } : {}),
    ...(goal.owngoal ? { ownGoal: true } : {}),
  }));
}

function toUtcIso(date: string, timeText: string): string {
  const [, hh, mm, sign, offsetHours] =
    timeText.match(/^(\d{1,2}):(\d{2}) UTC([+-])(\d{1,2})$/) ?? [];
  if (!hh) throw new Error(`Unsupported time: ${timeText}`);

  const local = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(hh),
    Number(mm),
  );
  const offsetMs = Number(offsetHours) * 60 * 60 * 1000 * (sign === '+' ? 1 : -1);
  return new Date(local - offsetMs).toISOString();
}
