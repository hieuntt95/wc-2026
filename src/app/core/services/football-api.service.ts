import { Injectable, computed } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  GroupStandings,
  Match,
  MatchDay,
  MatchDto,
  Standing,
  Team,
  TeamDto,
} from '../models/football.models';

/**
 * Pure front-end data source.
 *
 * Loads static JSON bundled under /public/data. To switch to a live source
 * (e.g. TheSportsDB) later, only the two resource URLs / mappers below need
 * to change — every computed signal downstream stays the same.
 */
@Injectable({ providedIn: 'root' })
export class FootballApiService {
  private readonly teamsResource = httpResource<TeamDto[]>(() => '/data/teams.json');
  private readonly matchesResource = httpResource<MatchDto[]>(() => '/data/matches.json');

  readonly isLoading = computed(
    () => this.teamsResource.isLoading() || this.matchesResource.isLoading(),
  );

  readonly error = computed(() => this.teamsResource.error() ?? this.matchesResource.error());

  readonly teams = computed<Team[]>(() => this.teamsResource.value() ?? []);

  private readonly teamsById = computed<Map<number, Team>>(() => {
    const map = new Map<number, Team>();
    for (const team of this.teams()) {
      map.set(team.id, team);
    }
    return map;
  });

  /** All matches with their teams resolved, sorted chronologically. */
  readonly matches = computed<Match[]>(() => {
    const byId = this.teamsById();
    const raw = this.matchesResource.value() ?? [];
    return raw
      .map((m) => this.toMatch(m, byId))
      .filter((m): m is Match => m !== null)
      .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  });

  /** Distinct group keys (A, B, C, ...) in alphabetical order. */
  readonly groups = computed<string[]>(() =>
    [...new Set(this.teams().map((t) => t.group).filter((g): g is string => g !== null))].sort(),
  );

  /** Full fixture list grouped by local calendar day. */
  readonly schedule = computed<MatchDay[]>(() => this.groupByDay(this.matches()));

  /** Only finished matches, most recent first. */
  readonly results = computed<MatchDay[]>(() => {
    const finished = this.matches()
      .filter((m) => m.status === 'FINISHED')
      .sort((a, b) => b.utcDate.localeCompare(a.utcDate));
    return this.groupByDay(finished);
  });

  /** Standings per group, computed from finished matches only. */
  readonly standings = computed<GroupStandings[]>(() => {
    const teams = this.teams();
    const finished = this.matches().filter((m) => m.status === 'FINISHED');

    const byGroup = new Map<string, Map<number, Standing>>();
    for (const team of teams) {
      if (team.group === null) {
        continue;
      }
      if (!byGroup.has(team.group)) {
        byGroup.set(team.group, new Map());
      }
      byGroup.get(team.group)!.set(team.id, this.emptyStanding(team));
    }

    for (const m of finished) {
      const group = m.homeTeam.group;
      if (group === null) {
        continue;
      }
      const table = byGroup.get(group);
      if (!table || m.score.home === null || m.score.away === null) {
        continue;
      }
      const home = table.get(m.homeTeam.id)!;
      const away = table.get(m.awayTeam.id)!;
      this.applyResult(home, m.score.home, m.score.away);
      this.applyResult(away, m.score.away, m.score.home);
    }

    return [...byGroup.entries()]
      .map(([group, table]) => ({
        group,
        table: [...table.values()].sort(this.compareStandings),
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
  });

  reload(): void {
    this.teamsResource.reload();
    this.matchesResource.reload();
  }

  private toMatch(dto: MatchDto, byId: Map<number, Team>): Match | null {
    const homeTeam = byId.get(dto.homeTeamId);
    const awayTeam = byId.get(dto.awayTeamId);
    if (!homeTeam || !awayTeam) {
      return null;
    }
    return {
      id: dto.id,
      utcDate: dto.utcDate,
      status: dto.status,
      stage: dto.stage,
      group: dto.group,
      matchday: dto.matchday,
      homeTeam,
      awayTeam,
      score: dto.score,
    };
  }

  private groupByDay(matches: Match[]): MatchDay[] {
    const days = new Map<string, Match[]>();
    for (const match of matches) {
      const key = this.localDateKey(match.utcDate);
      if (!days.has(key)) {
        days.set(key, []);
      }
      days.get(key)!.push(match);
    }
    return [...days.entries()].map(([dateKey, dayMatches]) => ({ dateKey, matches: dayMatches }));
  }

  private localDateKey(utcDate: string): string {
    const d = new Date(utcDate);
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private emptyStanding(team: Team): Standing {
    return {
      team,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  }

  private applyResult(s: Standing, scored: number, conceded: number): void {
    s.played += 1;
    s.goalsFor += scored;
    s.goalsAgainst += conceded;
    s.goalDifference = s.goalsFor - s.goalsAgainst;
    if (scored > conceded) {
      s.won += 1;
      s.points += 3;
    } else if (scored === conceded) {
      s.draw += 1;
      s.points += 1;
    } else {
      s.lost += 1;
    }
  }

  private compareStandings(a: Standing, b: Standing): number {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.name.localeCompare(b.team.name);
  }
}
