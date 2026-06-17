import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
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
        @if (focusDateKey(); as focusDate) {
          <div
            class="mb-5 rounded-3xl border border-wc-pink/20 bg-gradient-to-br from-wc-orange/10 via-wc-pink/10
                   to-wc-purple/10 p-4 shadow-sm dark:border-white/10"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-xs font-extrabold uppercase tracking-wide text-wc-pink">
                  {{ focusTitle() }}
                </p>
                <h2 class="mt-1 text-lg font-extrabold tracking-tight">
                  {{ focusDate | dayLabel }}
                </h2>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {{ focusMatchesCount() }} trận đấu · tự động đưa bạn tới ngày phù hợp nhất.
                </p>
              </div>
              <button
                type="button"
                (click)="jumpToFocusDate()"
                class="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition
                       hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Xem ngày này
              </button>
            </div>
          </div>
        }

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
              <div
                [attr.id]="dayElementId(day.dateKey)"
                [class]="dayContainerClass(day.dateKey)"
              >
                <h2
                  class="sticky top-[60px] z-10 mb-2 -mx-4 bg-slate-50/90 px-4 py-1.5 text-xs font-bold
                         uppercase tracking-wide text-slate-500 backdrop-blur sm:top-[104px]
                         dark:bg-[#0b1020]/90 dark:text-slate-400"
                  [class.text-wc-pink]="isFocusDay(day.dateKey)"
                >
                  {{ day.dateKey | dayLabel }}
                  @if (day.dateKey === todayDateKey) {
                    <span class="ml-2 rounded-full bg-wc-pink/10 px-2 py-0.5 text-[10px] text-wc-pink">
                      Hôm nay
                    </span>
                  }
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
  private readonly document = inject(DOCUMENT);

  protected readonly selectedGroup = signal<string | 'ALL'>('ALL');
  protected readonly selectedTeamId = signal<number | null>(null);
  protected readonly todayDateKey = this.localDateKey(new Date());
  private scrolledDateKey: string | null = null;

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

  protected readonly focusDateKey = computed<string | null>(() =>
    this.pickFocusDate(this.filteredSchedule()),
  );

  protected readonly focusTitle = computed(() => {
    const focusDate = this.focusDateKey();
    if (focusDate === this.todayDateKey) return 'Hôm nay';
    if (focusDate && focusDate > this.todayDateKey) return 'Trận gần nhất sắp tới';
    return 'Ngày thi đấu gần nhất';
  });

  protected readonly focusMatchesCount = computed(() => {
    const focusDate = this.focusDateKey();
    return this.filteredSchedule().find((day) => day.dateKey === focusDate)?.matches.length ?? 0;
  });

  constructor() {
    effect(() => {
      if (this.api.isLoading()) return;

      const focusDate = this.focusDateKey();
      if (!focusDate || this.scrolledDateKey === focusDate) return;

      this.scrolledDateKey = focusDate;
      this.document.defaultView?.setTimeout(() => this.scrollToDate(focusDate, 'auto'));
    });
  }

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

  protected isFocusDay(dateKey: string): boolean {
    return this.focusDateKey() === dateKey;
  }

  protected dayElementId(dateKey: string): string {
    return `match-day-${dateKey}`;
  }

  protected dayContainerClass(dateKey: string): string {
    const base = 'scroll-mt-32 rounded-3xl transition';
    return this.isFocusDay(dateKey)
      ? `${base} border border-wc-pink/30 bg-wc-pink/5 p-2`
      : base;
  }

  protected jumpToFocusDate(): void {
    const focusDate = this.focusDateKey();
    if (focusDate) {
      this.scrollToDate(focusDate, 'smooth');
    }
  }

  private pickFocusDate(days: MatchDay[]): string | null {
    if (days.length === 0) return null;

    const today = days.find((day) => day.dateKey === this.todayDateKey);
    if (today) return today.dateKey;

    const upcoming = days.find((day) => day.dateKey > this.todayDateKey);
    return upcoming?.dateKey ?? days.at(-1)?.dateKey ?? null;
  }

  private scrollToDate(dateKey: string, behavior: ScrollBehavior): void {
    this.document
      .getElementById(this.dayElementId(dateKey))
      ?.scrollIntoView({ behavior, block: 'start' });
  }

  private localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
