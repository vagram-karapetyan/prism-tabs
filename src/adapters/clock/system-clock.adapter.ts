import type { ClockPort } from '../../ports/clock.port';

export class SystemClockAdapter implements ClockPort {
  nowMs(): number {
    return Date.now();
  }

  nowIso(): string {
    return new Date().toISOString();
  }

  performanceNow(): number {
    return performance.now();
  }
}
