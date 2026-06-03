import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FootballApiService } from '../../core/services/football-api.service';

@Component({
  selector: 'app-standings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h1 class="mb-1 text-2xl font-extrabold tracking-tight">Bảng xếp hạng</h1>
      <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Tính từ các trận đã kết thúc. Hai đội dẫn đầu mỗi bảng được tô đậm.
      </p>

      @if (api.isLoading()) {
        <div class="space-y-4">
          @for (i of [1, 2]; track i) {
            <div class="h-48 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/5"></div>
          }
        </div>
      } @else if (api.error()) {
        <div class="rounded-2xl bg-wc-coral/10 p-4 text-sm font-medium text-wc-coral">
          Không tải được dữ liệu.
          <button (click)="api.reload()" class="ml-2 underline">Tải lại</button>
        </div>
      } @else {
        <div class="grid gap-5 sm:grid-cols-2">
          @for (group of api.standings(); track group.group) {
            <div
              class="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm
                     dark:border-white/10 dark:bg-slate-900/60"
            >
              <div
                class="bg-gradient-to-r from-wc-purple to-wc-pink px-4 py-2.5 text-sm font-bold text-white"
              >
                Bảng {{ group.group }}
              </div>
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-[11px] uppercase text-slate-400">
                    <th class="px-2 py-2 text-left font-semibold">#</th>
                    <th class="py-2 text-left font-semibold">Đội</th>
                    <th class="px-1.5 py-2 text-center font-semibold">T</th>
                    <th class="hidden px-1.5 py-2 text-center font-semibold sm:table-cell">Th</th>
                    <th class="hidden px-1.5 py-2 text-center font-semibold sm:table-cell">H</th>
                    <th class="hidden px-1.5 py-2 text-center font-semibold sm:table-cell">B</th>
                    <th class="px-1.5 py-2 text-center font-semibold">HS</th>
                    <th class="px-2.5 py-2 text-center font-semibold">Đ</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of group.table; track row.team.id; let i = $index) {
                    <tr
                      class="border-t border-slate-100 dark:border-white/5"
                      [class.bg-wc-purple]="i < 2"
                      [class.bg-opacity-5]="i < 2"
                    >
                      <td class="px-2 py-2">
                        <span
                          class="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold"
                          [class]="i < 2 ? 'bg-wc-purple text-white' : 'text-slate-400'"
                        >
                          {{ i + 1 }}
                        </span>
                      </td>
                      <td class="py-2">
                        <div class="flex items-center gap-2">
                          <img
                            [src]="row.team.crest"
                            [alt]="row.team.name"
                            width="22"
                            height="16"
                            loading="lazy"
                            class="h-4 w-6 rounded-[2px] object-cover ring-1 ring-black/5"
                          />
                          <span class="truncate font-semibold">{{ row.team.shortName }}</span>
                        </div>
                      </td>
                      <td class="px-1.5 py-2 text-center tabular-nums">{{ row.played }}</td>
                      <td class="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">
                        {{ row.won }}
                      </td>
                      <td class="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">
                        {{ row.draw }}
                      </td>
                      <td class="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">
                        {{ row.lost }}
                      </td>
                      <td
                        class="px-1.5 py-2 text-center tabular-nums"
                        [class.text-emerald-600]="row.goalDifference > 0"
                        [class.text-wc-coral]="row.goalDifference < 0"
                      >
                        {{ row.goalDifference > 0 ? '+' : '' }}{{ row.goalDifference }}
                      </td>
                      <td class="px-2.5 py-2 text-center font-extrabold tabular-nums">
                        {{ row.points }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <p class="mt-4 text-xs text-slate-400">
          T: Trận · Th: Thắng · H: Hòa · B: Bại · HS: Hiệu số · Đ: Điểm
        </p>
      }
    </section>
  `,
})
export class Standings {
  protected readonly api = inject(FootballApiService);
}
