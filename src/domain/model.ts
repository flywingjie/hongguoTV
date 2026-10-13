export interface Series {
  id: string;
  title: string;
  cover: string;
  description: string;
  badge: string;
  tags: string;
}
export interface Episode {
  id: string;
  number: number;
  title: string;
}
export interface Detail extends Series {
  episodes: Episode[];
}
export interface Progress {
  series: Series;
  episodeId: string;
  episodeNumber: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}
export interface Library {
  favorites: Series[];
  progress: Record<string, Progress>;
}
export interface Settings {
  baseUrl: string;
  token: string;
}
export interface Playback {
  uri: string;
  headers: Record<string, string>;
}
export interface ContentProvider {
  home(page: number): Promise<Series[]>;
  search(query: string, page: number): Promise<Series[]>;
  detail(id: string): Promise<Detail>;
  resolve(id: string, fresh?: boolean): Promise<Playback>;
}
export function resumeTarget(
  detail: Detail,
  progress?: Progress
): { index: number; position: number } {
  if (!progress) return { index: 0, position: 0 };
  const index = detail.episodes.findIndex((e) => e.id === progress.episodeId);
  if (index < 0) return { index: 0, position: 0 };
  if (progress.completed)
    return {
      index: Math.min(index + 1, detail.episodes.length - 1),
      position: 0,
    };
  return { index, position: Math.max(0, progress.position) };
}
export function mergePage(existing: Series[], incoming: Series[]): Series[] {
  return Array.from(
    new Map([...existing, ...incoming].map((item) => [item.id, item])).values()
  );
}
export function normalizeBaseUrl(input: string): string {
  const url = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[a-z\d.\-\[\]:]+(?::\d+)?$/i.test(url))
    throw new Error("请输入完整服务地址，例如 http://192.168.1.10:8787");
  return url;
}
