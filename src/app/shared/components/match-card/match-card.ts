import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GoalDto, LIVE_STATUSES, Match, Stage } from '../../../core/models/football.models';
import { LocalTimePipe } from '../../pipes/local-time.pipe';
import { MatchStatusPipe } from '../../pipes/match-status.pipe';

@Component({
  selector: 'app-match-card',
  imports: [LocalTimePipe, MatchStatusPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm transition
             hover:-translate-y-0.5 hover:shadow-md sm:p-4
             dark:border-white/10 dark:bg-slate-900/60"
    >
      <header class="mb-2 flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          @if (match().group) {
            Bảng {{ match().group }} · Lượt {{ match().matchday }}
          } @else {
            {{ stageLabel() }}
          }
        </span>
        @if (isLive()) {
          <span
            class="inline-flex items-center gap-1 rounded-full bg-wc-coral/10 px-2 py-0.5
                   text-[11px] font-bold text-wc-coral"
          >
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-wc-coral"></span>
            {{ match().status | matchStatus }}
          </span>
        } @else if (match().status === 'FINISHED') {
          <span class="text-[11px] font-semibold text-slate-400">
            {{ match().status | matchStatus }}
          </span>
        } @else {
          <span class="text-[11px] font-semibold text-wc-purple">
            {{ match().utcDate | localTime }}
          </span>
        }
      </header>

      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div class="flex items-center gap-2 sm:gap-3">
          <img
            [src]="match().homeTeam.crest"
            [alt]="match().homeTeam.name"
            width="28"
            height="28"
            loading="lazy"
            class="h-6 w-9 rounded-sm object-cover ring-1 ring-black/5 sm:h-7 sm:w-11"
          />
          <span class="truncate text-sm font-semibold sm:text-base">
            {{ match().homeTeam.name }}
          </span>
        </div>

        <div class="px-2 text-center">
          @if (hasScore()) {
            <div
              class="rounded-lg bg-slate-100 px-2.5 py-1 text-base font-extrabold tabular-nums
                     dark:bg-white/10"
              [class.text-wc-coral]="isLive()"
            >
              {{ match().score.home }} - {{ match().score.away }}
            </div>
          } @else {
            <div class="text-xs font-semibold text-slate-400">vs</div>
          }
        </div>

        <div class="flex items-center justify-end gap-2 sm:gap-3">
          <span class="truncate text-right text-sm font-semibold sm:text-base">
            {{ match().awayTeam.name }}
          </span>
          <img
            [src]="match().awayTeam.crest"
            [alt]="match().awayTeam.name"
            width="28"
            height="28"
            loading="lazy"
            class="h-6 w-9 rounded-sm object-cover ring-1 ring-black/5 sm:h-7 sm:w-11"
          />
        </div>
      </div>

      @if (hasGoals()) {
        <div
          class="mt-3 grid grid-cols-[1fr_auto_1fr] gap-2 border-t border-slate-100 pt-3
                 text-[11px] leading-5 text-slate-500 dark:border-white/10 dark:text-slate-400"
        >
          <div class="space-y-1">
            @for (goal of match().goals.home; track goal.name + goal.minute) {
              <div class="flex items-start gap-1.5">
                <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-wc-pink"></span>
                <span>
                  <span class="font-semibold text-slate-700 dark:text-slate-200">
                    {{ goal.name }}
                  </span>
                  <span class="tabular-nums"> {{ minuteLabel(goal.minute) }}</span>
                  @if (goalNote(goal); as note) {
                    <span class="text-slate-400"> · {{ note }}</span>
                  }
                </span>
              </div>
            }
          </div>

          <div aria-hidden="true"></div>

          <div class="space-y-1 text-right">
            @for (goal of match().goals.away; track goal.name + goal.minute) {
              <div class="flex items-start justify-end gap-1.5">
                <span>
                  @if (goalNote(goal); as note) {
                    <span class="text-slate-400">{{ note }} · </span>
                  }
                  <span class="tabular-nums">{{ minuteLabel(goal.minute) }} </span>
                  <span class="font-semibold text-slate-700 dark:text-slate-200">
                    {{ goal.name }}
                  </span>
                </span>
                <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-wc-purple"></span>
              </div>
            }
          </div>
        </div>
      }
    </article>
  `,
})
export class MatchCard {
  readonly match = input.required<Match>();

  readonly isLive = computed(() => LIVE_STATUSES.has(this.match().status));

  readonly hasScore = computed(() => {
    const { home, away } = this.match().score;
    return home !== null && away !== null;
  });

  readonly hasGoals = computed(() => {
    const { home, away } = this.match().goals;
    return home.length > 0 || away.length > 0;
  });

  readonly stageLabel = computed(() => STAGE_LABELS[this.match().stage]);

  protected minuteLabel(minute: string): string {
    return `${minute}'`;
  }

  protected goalNote(goal: GoalDto): string {
    if (goal.ownGoal) return 'phản lưới';
    if (goal.penalty) return 'pen.';
    return '';
  }
}

const STAGE_LABELS: Record<Stage, string> = {
  GROUP_STAGE: 'Vòng bảng',
  ROUND_OF_32: 'Vòng 32 đội',
  ROUND_OF_16: 'Vòng 16 đội',
  QUARTER_FINAL: 'Tứ kết',
  SEMI_FINAL: 'Bán kết',
  THIRD_PLACE: 'Tranh hạng ba',
  FINAL: 'Chung kết',
};
