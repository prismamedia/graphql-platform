import type { SingleBar as BaseSingleBar } from 'cli-progress';

declare module 'cli-progress' {
  interface SingleBar extends BaseSingleBar {
    startTime: number | null;
    value: number;
  }
}
