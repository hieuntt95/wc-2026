import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FootballApiService } from '../../core/services/football-api.service';
import {
  OPENFOOTBALL_SOURCE_URL,
  OpenFootballData,
  OpenFootballSnapshot,
  mapOpenFootballSource,
} from '../../core/services/openfootball.mapper';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

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
          Fetch dữ liệu từ openfootball và tạo JSON fallback cho app. App chính đã tự fetch API
          mỗi lần load; route này dùng để cập nhật file tĩnh bằng
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
          <div class="mt-5 grid gap-3 sm:grid-cols-4">
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
            <div class="rounded-2xl bg-emerald-500/10 p-4">
              <p class="text-xs font-semibold text-emerald-600">Đã có kết quả</p>
              <p class="mt-1 font-bold text-emerald-700 dark:text-emerald-300">
                {{ finishedMatchesCount(data) }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              (click)="reloadAppData()"
              class="rounded-xl bg-wc-purple px-4 py-2 text-sm font-bold text-white"
            >
              Tải lại app
            </button>
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
  private readonly api = inject(FootballApiService);

  protected readonly status = signal<SyncStatus>('idle');
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly snapshot = signal<OpenFootballSnapshot | null>(null);

  protected async sync(): Promise<void> {
    this.status.set('syncing');
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const response = await fetch(OPENFOOTBALL_SOURCE_URL);
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      }
      const source = (await response.json()) as OpenFootballData;
      this.snapshot.set(mapOpenFootballSource(source));
      this.successMessage.set('Đã fetch và tạo snapshot mới.');
      this.status.set('done');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Sync failed');
      this.status.set('error');
    }
  }

  protected reloadAppData(): void {
    void this.api.reload();
    this.successMessage.set('Đã yêu cầu app tải lại dữ liệu.');
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

  protected finishedMatchesCount(snapshot: OpenFootballSnapshot): number {
    return snapshot.matches.filter((match) => match.status === 'FINISHED').length;
  }
}
