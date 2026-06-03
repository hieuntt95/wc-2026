import { Pipe, PipeTransform } from '@angular/core';
import { MatchStatus } from '../../core/models/football.models';

const LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Sắp diễn ra',
  LIVE: 'Trực tiếp',
  IN_PLAY: 'Đang đá',
  PAUSED: 'Tạm dừng',
  FINISHED: 'Kết thúc',
};

/** Maps a match status to a Vietnamese label. */
@Pipe({ name: 'matchStatus' })
export class MatchStatusPipe implements PipeTransform {
  transform(status: MatchStatus | null | undefined): string {
    if (!status) return '';
    return LABELS[status] ?? status;
  }
}
