import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FootballApiService } from '../../core/services/football-api.service';
import { MatchDay, Team } from '../../core/models/football.models';
import { MatchCard } from '../../shared/components/match-card/match-card';
import { DayLabelPipe } from '../../shared/pipes/day-label.pipe';

@Component({
  selector: 'app-schedule',
  imports: [MatchCard, DayLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h1 class="mb-1 text-2xl font-extrabold tracking-tight">Lịch thi đấu</h1>
      <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Giờ hiển thị theo múi giờ của bạn.
      </p>

      @if (api.isLoading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/5"></div>
          }
        </div>
      } @else if (api.error()) {
        <div class="rounded-2xl bg-wc-coral/10 p-4 text-sm font-medium text-wc-coral">
          Không tải được dữ liệu. Vui lòng thử lại.
          <button (click)="api.reload()" class="ml-2 underline">Tải lại</button>
        </div>
      } @else {
        <!-- Group filter -->
        <div class="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            type="button"
            (click)="selectedGroup.set('ALL')"
            [class]="chipClass(selectedGroup() === 'ALL')"
          >
            Tất cả
          </button>
          @for (g of api.groups(); track g) {
            <button
              type="button"
              (click)="selectGroup(g)"
              [class]="chipClass(selectedGroup() === g)"
            >
              Bảng {{ g }}
            </button>
          }
        </div>

        <!-- Team filter -->
        <div class="mb-5">
          <select
            [value]="selectedTeamId() ?? ''"
            (change)="onTeamChange($event)"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium
                   shadow-sm sm:w-72 dark:border-white/10 dark:bg-slate-900"
          >
            <option value="">Tất cả các đội</option>
            @for (t of selectableTeams(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
        </div>

        @if (filteredSchedule().length === 0) {
          <p class="rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-500 dark:bg-white/5">
            Không có trận đấu nào khớp bộ lọc.
          </p>
        } @else {
          <div class="space-y-6">
            @for (day of filteredSchedule(); track day.dateKey) {
              <div>
                <h2
                  class="sticky top-[60px] z-10 mb-2 -mx-4 bg-slate-50/90 px-4 py-1.5 text-xs font-bold
                         uppercase tracking-wide text-slate-500 backdrop-blur sm:top-[104px]
                         dark:bg-[#0b1020]/90 dark:text-slate-400"
                >
                  {{ day.dateKey | dayLabel }}
                </h2>
                <div class="space-y-2.5">
                  @for (match of day.matches; track match.id) {
                    <app-match-card [match]="match" />
                  }
                </div>
              </div>
            }
          </div>
        }
      }
    </section>
  `,
})
export class Schedule {
  protected readonly api = inject(FootballApiService);

  protected readonly selectedGroup = signal<string | 'ALL'>('ALL');
  protected readonly selectedTeamId = signal<number | null>(null);

  protected readonly selectableTeams = computed<Team[]>(() =>
    this.api
      .teams()
      .filter((team) => team.group !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly filteredSchedule = computed<MatchDay[]>(() => {
    const group = this.selectedGroup();
    const teamId = this.selectedTeamId();

    return this.api
      .schedule()
      .map((day) => ({
        dateKey: day.dateKey,
        matches: day.matches.filter((m) => {
          const groupOk = group === 'ALL' || m.group === group;
          const teamOk =
            teamId === null || m.homeTeam.id === teamId || m.awayTeam.id === teamId;
          return groupOk && teamOk;
        }),
      }))
      .filter((day) => day.matches.length > 0);
  });

  protected selectGroup(group: string): void {
    this.selectedGroup.set(group);
  }

  protected onTeamChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedTeamId.set(value ? Number(value) : null);
  }

  protected chipClass(active: boolean): string {
    const base =
      'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition whitespace-nowrap ';
    return active
      ? base + 'bg-wc-purple text-white shadow'
      : base +
          'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300';
  }
}
