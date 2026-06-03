import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SupabaseClientService } from '../../core/services/supabase-client.service';

type SyncStatus = 'idle' | 'syncing' | 'upserting' | 'done' | 'error';
type Stage =
  | 'GROUP_STAGE'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';

interface SourceMatch {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
}

interface SourceData {
  name: string;
  matches: SourceMatch[];
}

interface TeamSnapshot {
  id: number;
  name: string;
  shortName: string;
  crest: string;
  group: string | null;
}

interface MatchSnapshot {
  id: number;
  utcDate: string;
  status: 'SCHEDULED';
  stage: Stage;
  group: string | null;
  matchday: number;
  homeTeamId: number | undefined;
  awayTeamId: number | undefined;
  score: { home: null; away: null };
  venue?: string;
}

interface Snapshot {
  teams: TeamSnapshot[];
  matches: MatchSnapshot[];
  source: string;
  updated: string;
}

const SOURCE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const PLACEHOLDER_CREST =
  'https://r2.thesportsdb.com/images/media/league/badge/e7er5g1696521789.png';

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

@Component({
  selector: 'app-sync-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-2xl">
      <div
        class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60"
      >
        <p class="mb-2 text-xs font-bold uppercase tracking-wide text-wc-pink">Route ẩn</p>
        <h1 class="text-2xl font-extrabold tracking-tight">Sync dữ liệu WC 2026</h1>
        <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Button này fetch dữ liệu từ openfootball và generate đúng format JSON của app.
          Nếu Supabase đã cấu hình, bạn có thể upsert snapshot này vào database.
          JSON fallback vẫn có thể cập nhật bằng
          <code class="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-white/10">npm run sync:data</code>.
        </p>

        <button
          type="button"
          (click)="sync()"
          [disabled]="status() === 'syncing'"
          class="mt-5 w-full rounded-2xl bg-gradient-to-r from-wc-orange via-wc-pink to-wc-purple px-4 py-3
                 text-sm font-extrabold text-white shadow-lg transition hover:scale-[1.01]
                 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          @if (status() === 'syncing') {
            Đang sync...
          } @else {
            Fetch & tạo JSON
          }
        </button>

        @if (!isSupabaseConfigured) {
          <p class="mt-3 text-xs text-slate-400">
            Supabase chưa được cấu hình trong <code>src/environments/environment.ts</code>,
            nên route này chỉ generate/download JSON.
          </p>
        }

        @if (status() === 'error') {
          <div class="mt-4 rounded-2xl bg-wc-coral/10 p-4 text-sm font-medium text-wc-coral">
            {{ errorMessage() }}
          </div>
        }

        @if (successMessage()) {
          <div class="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm font-medium text-emerald-600">
            {{ successMessage() }}
          </div>
        }

        @if (snapshot(); as data) {
          <div class="mt-5 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
              <p class="text-xs font-semibold text-slate-400">Nguồn</p>
              <p class="mt-1 font-bold">{{ data.source }}</p>
            </div>
            <div class="rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
              <p class="text-xs font-semibold text-slate-400">Teams</p>
              <p class="mt-1 font-bold">{{ data.teams.length }}</p>
            </div>
            <div class="rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
              <p class="text-xs font-semibold text-slate-400">Matches</p>
              <p class="mt-1 font-bold">{{ data.matches.length }}</p>
            </div>
          </div>

          <div class="mt-4 flex flex-col gap-2 sm:flex-row">
            @if (isSupabaseConfigured) {
              <button
                type="button"
                (click)="upsertToSupabase()"
                [disabled]="status() === 'upserting'"
                class="rounded-xl bg-wc-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                @if (status() === 'upserting') {
                  Đang ghi Supabase...
                } @else {
                  Upsert vào Supabase
                }
              </button>
            }
            <button
              type="button"
              (click)="download('teams.json')"
              class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
            >
              Download teams.json
            </button>
            <button
              type="button"
              (click)="download('matches.json')"
              class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
            >
              Download matches.json
            </button>
          </div>
        }
      </div>
    </section>
  `,
})
export class SyncData {
  private readonly supabase = inject(SupabaseClientService);

  protected readonly status = signal<SyncStatus>('idle');
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly snapshot = signal<Snapshot | null>(null);
  protected readonly isSupabaseConfigured = this.supabase.isConfigured;

  protected async sync(): Promise<void> {
    this.status.set('syncing');
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const response = await fetch(SOURCE_URL);
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      }
      const source = (await response.json()) as SourceData;
      this.snapshot.set(this.buildSnapshot(source));
      this.successMessage.set('Đã fetch và tạo snapshot mới.');
      this.status.set('done');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Sync failed');
      this.status.set('error');
    }
  }

  protected async upsertToSupabase(): Promise<void> {
    const data = this.snapshot();
    const client = this.supabase.client;
    if (!data || !client) {
      this.errorMessage.set('Chưa có snapshot hoặc Supabase chưa được cấu hình.');
      this.status.set('error');
      return;
    }

    this.status.set('upserting');
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const { error: teamsError } = await client.from('teams').upsert(
        data.teams.map((team) => ({
          id: team.id,
          name: team.name,
          short_name: team.shortName,
          crest: team.crest,
          group: team.group,
        })),
        { onConflict: 'id' },
      );
      if (teamsError) throw teamsError;

      const { error: matchesError } = await client.from('matches').upsert(
        data.matches.map((match) => ({
          id: match.id,
          utc_date: match.utcDate,
          status: match.status,
          stage: match.stage,
          group: match.group,
          matchday: match.matchday,
          home_team_id: match.homeTeamId,
          away_team_id: match.awayTeamId,
          home_score: match.score.home,
          away_score: match.score.away,
          venue: match.venue ?? null,
        })),
        { onConflict: 'id' },
      );
      if (matchesError) throw matchesError;

      await client.from('sync_logs').insert({
        source: data.source,
        teams_count: data.teams.length,
        matches_count: data.matches.length,
      });

      this.successMessage.set(
        `Đã upsert ${data.teams.length} teams và ${data.matches.length} matches vào Supabase.`,
      );
      this.status.set('done');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Upsert Supabase failed');
      this.status.set('error');
    }
  }

  protected download(fileName: 'teams.json' | 'matches.json'): void {
    const data = this.snapshot();
    if (!data) return;

    const content = fileName === 'teams.json' ? data.teams : data.matches;
    const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildSnapshot(source: SourceData): Snapshot {
    const groupByTeam = new Map<string, string>();
    for (const match of source.matches) {
      if (match.group) {
        const group = this.groupKey(match.group);
        groupByTeam.set(match.team1, group ?? '');
        groupByTeam.set(match.team2, group ?? '');
      }
    }

    const teamNames = [...new Set(source.matches.flatMap((m) => [m.team1, m.team2]))].sort((a, b) =>
      a.localeCompare(b),
    );
    const teams = teamNames.map((name, index) => ({
      id: index + 1,
      name,
      shortName: this.shortName(name),
      crest: this.crest(name),
      group: groupByTeam.get(name) ?? null,
    }));
    const ids = new Map(teams.map((team) => [team.name, team.id]));

    const matches = source.matches.map((m, index) => ({
      id: index + 1,
      utcDate: this.toUtcIso(m.date, m.time),
      status: 'SCHEDULED' as const,
      stage: this.stage(m.round),
      group: this.groupKey(m.group),
      matchday: this.matchday(m.round),
      homeTeamId: ids.get(m.team1),
      awayTeamId: ids.get(m.team2),
      score: { home: null, away: null },
      venue: m.ground,
    }));

    return { teams, matches, source: source.name, updated: new Date().toISOString() };
  }

  private normalizeTeamName(name: string): string {
    return name.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  private isPlaceholder(name: string): boolean {
    return /^([12][A-L]|3[A-L](\/[^ ]+)?|W\d+|L\d+)$/.test(name);
  }

  private shortName(name: string): string {
    const normalized = this.normalizeTeamName(name);
    if (SHORT_NAMES.has(normalized)) return SHORT_NAMES.get(normalized)!;
    if (this.isPlaceholder(name)) return name;
    return normalized
      .replace(/&/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }

  private crest(name: string): string {
    const code = FLAG_CODES.get(this.normalizeTeamName(name));
    return code ? `https://flagcdn.com/w320/${code}.png` : PLACEHOLDER_CREST;
  }

  private stage(round: string): Stage {
    if (round.startsWith('Matchday')) return 'GROUP_STAGE';
    if (round === 'Round of 32') return 'ROUND_OF_32';
    if (round === 'Round of 16') return 'ROUND_OF_16';
    if (round === 'Quarter-final') return 'QUARTER_FINAL';
    if (round === 'Semi-final') return 'SEMI_FINAL';
    if (round === 'Match for third place') return 'THIRD_PLACE';
    if (round === 'Final') return 'FINAL';
    return 'GROUP_STAGE';
  }

  private matchday(round: string): number {
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

  private groupKey(group: string | undefined): string | null {
    return group?.replace('Group ', '') ?? null;
  }

  private toUtcIso(date: string, timeText: string): string {
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
}
