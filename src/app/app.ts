import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly theme = inject(ThemeService);

  readonly isDark = computed(() => this.theme.mode() === 'dark');

  readonly navItems: readonly NavItem[] = [
    { path: '/lich-thi-dau', label: 'Lịch thi đấu', icon: 'calendar' },
    { path: '/ket-qua', label: 'Kết quả', icon: 'ball' },
    { path: '/bang-xep-hang', label: 'Bảng xếp hạng', icon: 'table' },
  ];

  toggleTheme(): void {
    this.theme.toggle();
  }
}
