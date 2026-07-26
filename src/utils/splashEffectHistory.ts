export interface EffectFireRecord {
  count: number;
  lastFiredAt: number;
}

export type EffectHistory = Record<number, EffectFireRecord>;

export interface RepeatEffect {
  cooldown: number;
  max: number;
}

export function shouldFireEffect(
  history: EffectHistory,
  index: number,
  repeatEffect: RepeatEffect | undefined,
  now: number,
): boolean {
  const record = history[index];
  if (!record) {
    return true;
  }
  if (!repeatEffect) {
    return false;
  }
  if (record.count >= repeatEffect.max) {
    return false;
  }
  return now - record.lastFiredAt >= repeatEffect.cooldown * 1000;
}

export function recordEffectFired(
  history: EffectHistory,
  index: number,
  now: number,
): EffectHistory {
  const prev = history[index];
  return {
    ...history,
    [index]: { count: (prev?.count ?? 0) + 1, lastFiredAt: now },
  };
}
