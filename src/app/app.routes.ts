import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'lich-thi-dau' },
  {
    path: 'lich-thi-dau',
    title: 'Lịch thi đấu · WC 2026',
    loadComponent: () =>
      import('./features/schedule/schedule').then((m) => m.Schedule),
  },
  {
    path: 'ket-qua',
    title: 'Kết quả · WC 2026',
    loadComponent: () => import('./features/results/results').then((m) => m.Results),
  },
  {
    path: 'bang-xep-hang',
    title: 'Bảng xếp hạng · WC 2026',
    loadComponent: () =>
      import('./features/standings/standings').then((m) => m.Standings),
  },
  {
    path: 'sync-data',
    title: 'Sync data · WC 2026',
    loadComponent: () =>
      import('./features/sync-data/sync-data').then((m) => m.SyncData),
  },
  { path: '**', redirectTo: 'lich-thi-dau' },
];
