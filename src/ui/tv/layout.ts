/** Logical TV dimensions, independent of the panel's physical pixel count. */
export function tvInsets(width: number, height: number) {
  return {
    horizontal: Math.round(width * 0.05),
    vertical: Math.round(height * 0.05),
  };
}

export function restoredIndex(ids: string[], id?: string, fallback = 0) {
  const found = id ? ids.indexOf(id) : -1;
  return found >= 0 ? found : Math.max(0, Math.min(fallback, ids.length - 1));
}

export function seekPosition(
  position: number,
  delta: number,
  duration: number
) {
  return Math.max(0, Math.min(Math.max(0, duration - 0.25), position + delta));
}

export const EPISODE_GROUP_SIZE = 20;
