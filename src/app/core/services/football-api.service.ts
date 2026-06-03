import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  GroupStandings,
  Match,
  MatchDay,
  MatchDto,
  Standing,
  Team,
  TeamDto,
} from '../models/football.models';
import { SupabaseClientService } from './supabase-client.service';

interface SupabaseTeamRow {
  id: number;
  name: string;
  short_name: string;
  crest: string;
  group: string | null;
}

interface SupabaseMatchRow {
  id: number;
  utc_date: string;
  status: MatchDto['status'];
  stage: MatchDto['stage'];
  group: string | null;
  matchday: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  venue?: string | null;
}

/**
 * Football data facade.
 *
 * Supabase is the primary source when configured. Static JSON remains as a
 * fallback so the app still works locally and on GitHub Pages without secrets.
 */
@Injectable({ providedIn: 'root' })
export class FootballApiService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseClientService);

  readonly isLoading = signal(true);
  readonly error = signal<unknown | null>(null);
  readonly dataSource = signal<'supabase' | 'json'>('json');

  private readonly teamDtos = signal<TeamDto[]>([]);
  private readonly matchDtos = signal<MatchDto[]>([]);

  readonly teams = computed<Team[]>(() => this.teamDtos());

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
    const raw = this.matchDtos();
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

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      if (this.supabase.isConfigured) {
        await this.loadFromSupabase();
        this.dataSource.set('supabase');
      } else {
        await this.loadFromJson();
        this.dataSource.set('json');
      }
    } catch (supabaseError) {
      try {
        await this.loadFromJson();
        this.dataSource.set('json');
        this.error.set(null);
        console.warn('Supabase load failed, using static JSON fallback.', supabaseError);
      } catch (jsonError) {
        this.error.set(jsonError);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadFromSupabase(): Promise<void> {
    const client = this.supabase.client;
    if (!client) {
      throw new Error('Supabase is not configured.');
    }

    const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] =
      await Promise.all([
        client.from('teams').select('*').order('id'),
        client.from('matches').select('*').order('utc_date'),
      ]);

    if (teamsError) throw teamsError;
    if (matchesError) throw matchesError;

    this.teamDtos.set((teams ?? []).map((team) => this.fromSupabaseTeam(team as SupabaseTeamRow)));
    this.matchDtos.set(
      (matches ?? []).map((match) => this.fromSupabaseMatch(match as SupabaseMatchRow)),
    );
  }

  private async loadFromJson(): Promise<void> {
    const [teams, matches] = await Promise.all([
      firstValueFrom(this.http.get<TeamDto[]>('data/teams.json')),
      firstValueFrom(this.http.get<MatchDto[]>('data/matches.json')),
    ]);

    this.teamDtos.set(teams);
    this.matchDtos.set(matches);
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

  private fromSupabaseTeam(row: SupabaseTeamRow): TeamDto {
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      crest: row.crest,
      group: row.group,
    };
  }

  private fromSupabaseMatch(row: SupabaseMatchRow): MatchDto {
    return {
      id: row.id,
      utcDate: row.utc_date,
      status: row.status,
      stage: row.stage,
      group: row.group,
      matchday: row.matchday,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      score: { home: row.home_score, away: row.away_score },
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
