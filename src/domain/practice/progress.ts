import type { PracticeSessionRecord } from '../../storage/db';

export function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function weeklyProgress(records: PracticeSessionRecord[], now = Date.now()) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + index);
    return {
      date: localDateKey(date.getTime()), label: (date.getMonth() + 1) + '/' + date.getDate(),
      count: 0, elapsedMs: 0, accuracy: 0, wpm: 0,
    };
  });
  for (const record of records) {
    if (record.createdAt > now) continue;
    const day = days.find(item => item.date === localDateKey(record.createdAt));
    if (!day) continue;
    day.count += 1;
    day.elapsedMs += record.elapsedMs;
    day.accuracy += record.accuracy;
    day.wpm += record.wpm;
  }
  return days.map(day => ({
    ...day,
    accuracy: day.count ? Math.round(day.accuracy / day.count) : null,
    wpm: day.count ? Math.round(day.wpm / day.count) : null,
  }));
}
