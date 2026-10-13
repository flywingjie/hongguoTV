import {
  ContentProvider,
  Detail,
  Playback,
  Series,
  Settings,
} from "../domain/model";
export class BridgeProvider implements ContentProvider {
  constructor(private settings: Settings) {}
  private headers(): Record<string, string> {
    return this.settings.token
      ? { Authorization: `Bearer ${this.settings.token}` }
      : {};
  }
  async request(path: string): Promise<any> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 65000);
    try {
      const response = await fetch(this.settings.baseUrl + path, {
        headers: this.headers(),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || `服务返回 ${response.status}`);
      return data;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message !== "Network request failed" &&
        error.name !== "AbortError"
      )
        throw error;
      throw new Error(
        "无法连接内容服务，请检查电视网络、服务地址和电脑上的服务进程"
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async health() {
    const data = await this.request("/health");
    if (data.service !== "hongguotv" || data.apiVersion !== 1)
      throw new Error("服务版本不兼容");
  }
  private async list(path: string): Promise<Series[]> {
    const data = await this.request(path);
    if (
      !Array.isArray(data.items) ||
      data.items.some((item: Series) => !item.id || !item.title)
    )
      throw new Error("列表数据格式异常");
    return data.items;
  }
  home(page: number) {
    return this.list(`/api/home?page=${page}`);
  }
  search(query: string, page: number) {
    return this.list(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
  }
  async detail(id: string): Promise<Detail> {
    const data = await this.request(`/api/series/${encodeURIComponent(id)}`);
    if (!Array.isArray(data.episodes) || !data.episodes.length)
      throw new Error("这部剧暂时没有可播放的分集");
    return data;
  }
  async resolve(id: string, fresh = false): Promise<Playback> {
    const data = await this.request(
      `/api/episodes/${encodeURIComponent(id)}/play?fresh=${fresh ? 1 : 0}`
    );
    if (data.path !== `/api/episodes/${id}/stream`)
      throw new Error("播放地址格式异常");
    return { uri: this.settings.baseUrl + data.path, headers: this.headers() };
  }
}
