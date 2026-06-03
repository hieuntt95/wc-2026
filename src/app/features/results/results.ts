import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FootballApiService } from '../../core/services/football-api.service';
import { MatchDay } from '../../core/models/football.models';
import { MatchCard } from '../../shared/components/match-card/match-card';
import { DayLabelPipe } from '../../shared/pipes/day-label.pipe';

@Component({
  selector: 'app-results',
  imports: [MatchCard, DayLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h1 class="mb-1 text-2xl font-extrabold tracking-tight">Kết quả</h1>
      <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">Các trận đã kết thúc.</p>

      @if (api.isLoading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/5"></div>
          }
        </div>
      } @else if (api.error()) {
        <div class="rounded-2xl bg-wc-coral/10 p-4 text-sm font-medium text-wc-coral">
          Không tải được dữ liệu.
          <button (click)="api.reload()" class="ml-2 underline">Tải lại</button>
        </div>
      } @else {
        <div class="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
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
              (click)="selectedGroup.set(g)"
              [class]="chipClass(selectedGroup() === g)"
            >
              Bảng {{ g }}
            </button>
          }
        </div>

        @if (filteredResults().length === 0) {
          <p class="rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-500 dark:bg-white/5">
            Chưa có kết quả nào.
          </p>
        } @else {
          <div class="space-y-6">
            @for (day of filteredResults(); track day.dateKey) {
              <div>
                <h2
                  class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
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
export class Results {
  protected readonly api = inject(FootballApiService);
  protected readonly selectedGroup = signal<string | 'ALL'>('ALL');

  protected readonly filteredResults = computed<MatchDay[]>(() => {
    const group = this.selectedGroup();
    if (group === 'ALL') return this.api.results();
    return this.api
      .results()
      .map((day) => ({
        dateKey: day.dateKey,
        matches: day.matches.filter((m) => m.group === group),
      }))
      .filter((day) => day.matches.length > 0);
  });

  protected chipClass(active: boolean): string {
    const base =
      'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition whitespace-nowrap ';
    return active
      ? base + 'bg-wc-purple text-white shadow'
      : base +
          'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300';
  }
}
