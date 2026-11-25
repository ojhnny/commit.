import { heatLevel, type HeatLevel } from '@/design/tokens'
import type { DayStatus } from '@/domain/types'

export const HEAT_BG: Record<HeatLevel, string> = {
  empty: 'bg-heat-empty',
  missed: 'bg-heat-missed',
  partial: 'bg-heat-partial',
  done: 'bg-heat-done',
  exceeded: 'bg-heat-exceeded',
}

export function heatBg(status: DayStatus): string {
  return HEAT_BG[heatLevel(status)]
}
