import { Pipe, PipeTransform } from '@angular/core';

/** Formats a UTC ISO date into the viewer's local time, e.g. "20:00". */
@Pipe({ name: 'localTime' })
export class LocalTimePipe implements PipeTransform {
  transform(utcDate: string | null | undefined): string {
    if (!utcDate) return '';
    return new Date(utcDate).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
