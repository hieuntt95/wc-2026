import { Pipe, PipeTransform } from '@angular/core';

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Formats a "yyyy-mm-dd" local date key into "Thứ Năm · 11/06/2026". */
@Pipe({ name: 'dayLabel' })
export class DayLabelPipe implements PipeTransform {
  transform(dateKey: string | null | undefined): string {
    if (!dateKey) return '';
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = WEEKDAYS[date.getDay()];
    const dd = `${d}`.padStart(2, '0');
    const mm = `${m}`.padStart(2, '0');
    return `${weekday} · ${dd}/${mm}/${y}`;
  }
}
