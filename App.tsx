import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { BridgeProvider } from "./src/data/provider";
import { loadState, saveLibrary, saveSettings } from "./src/data/storage";
import { useCatalog } from "./src/data/useCatalog";
import {
  Detail,
  Library,
  Progress,
  Series,
  Settings,
  normalizeBaseUrl,
} from "./src/domain/model";
import { Button, Notice, palette } from "./src/ui/components";
import { Player } from "./src/ui/Player";
import { DetailTV } from "./src/ui/tv/DetailTV";
import { GridHandle, GridPosition, TVGrid } from "./src/ui/tv/TVGrid";
import { tvInsets } from "./src/ui/tv/layout";
type Tab = "推荐" | "搜索" | "收藏" | "最近观看" | "设置";
const tabs: Tab[] = ["推荐", "搜索", "收藏", "最近观看", "设置"];
const sample: Detail = {
  id: "test",
  title: "播放器测试 · Big Buck Bunny",
  cover: "",
  description: "",
  badge: "",
  tags: "",
  episodes: [{ id: "test", number: 1, title: "测试片" }],
};
export default function App() {
  const { width, height } = useWindowDimensions();
  const inset = tvInsets(width, height);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    baseUrl: "",
    token: "",
  });
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [library, setLibrary] = useState<Library>({
    favorites: [],
    progress: {},
  });
  const libraryRef = useRef(library);
  const [tab, setTab] = useState<Tab>("推荐");
  const [detail, setDetail] = useState<Detail>();
  const [detailId, setDetailId] = useState("");
  const [play, setPlay] = useState<{
    detail: Detail;
    index: number;
    position: number;
    test?: boolean;
  }>();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [searchRun, setSearchRun] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [restoreGrid, setRestoreGrid] = useState(false);
  const [restoreEpisode, setRestoreEpisode] = useState<string>();
  const [focusArea, setFocusArea] = useState<"nav" | "content">("nav");
  const positions = useRef(
    Object.fromEntries(tabs.map((t) => [t, { index: 0 }])) as Record<
      Tab,
      GridPosition
    >
  );
  const grid = useRef<GridHandle>(null);
  const nav = useRef(new Map<Tab, View>());
  const provider = useMemo(() => new BridgeProvider(settings), [settings]);
  const catalog = useCatalog(
    provider,
    tab === "搜索" ? submitted : null,
    ready && !!settings.baseUrl && ["推荐", "搜索"].includes(tab)
  );
  useEffect(() => {
    loadState()
      .then((data) => {
        setSettings(data.settings);
        setUrl(data.settings.baseUrl);
        setToken(data.settings.token);
        setLibrary(data.library);
        libraryRef.current = data.library;
        if (!data.settings.baseUrl) setTab("设置");
      })
      .catch(() => {
        setMessage("本地数据读取失败，请重新设置服务地址");
        setTab("设置");
      })
      .finally(() => setReady(true));
  }, []);
  const updateLibrary = useCallback((update: (old: Library) => Library) => {
    const next = update(libraryRef.current);
    libraryRef.current = next;
    setLibrary(next);
    saveLibrary(next).catch(() =>
      setMessage("观看记录保存失败，请检查电视存储空间")
    );
  }, []);
  const record = useCallback(
    (p: Progress) =>
      updateLibrary((old) => ({
        ...old,
        progress: Object.fromEntries(
          Object.entries({ ...old.progress, [p.series.id]: p })
            .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
            .slice(0, 200)
        ),
      })),
    [updateLibrary]
  );
  useEffect(() => {
    if (!detailId) return;
    let live = true;
    setDetail(undefined);
    setBusy(true);
    setError("");
    provider
      .detail(detailId)
      .then((value) => {
        if (live) setDetail(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [detailId, provider, refresh]);
  function closeDetail() {
    setRestoreGrid(true);
    setDetailId("");
    setDetail(undefined);
    setError("");
  }
  function changeTab(next: Tab) {
    if (next === tab && !detailId) return;
    setRestoreGrid(!!positions.current[next].id);
    setTab(next);
    setDetailId("");
    setDetail(undefined);
    setError("");
  }
  useEffect(() => {
    if (play) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (detailId) {
        closeDetail();
        return true;
      }
      if (focusArea === "content") {
        grid.current?.top();
        setRestoreGrid(false);
        nav.current.get(tab)?.requestTVFocus();
        setFocusArea("nav");
        return true;
      }
      if (tab !== "推荐" && settings.baseUrl) {
        changeTab("推荐");
        setRestoreGrid(false);
        requestAnimationFrame(() => nav.current.get("推荐")?.requestTVFocus());
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [detailId, tab, settings.baseUrl, play, focusArea]);
  function open(item: Series) {
    setRestoreEpisode(undefined);
    setError("");
    setDetailId(item.id);
  }
  const exitPlayer = useCallback(() => {
    setPlay(undefined);
    setRestoreEpisode(
      libraryRef.current.progress[play?.detail.id || ""]?.episodeId
    );
  }, [play]);
  async function connect() {
    setConnecting(true);
    setMessage("");
    try {
      const next = { baseUrl: normalizeBaseUrl(url), token: token.trim() };
      await new BridgeProvider(next).health();
      await saveSettings(next);
      setSettings(next);
      setUrl(next.baseUrl);
      setMessage("服务连接成功");
      positions.current = Object.fromEntries(
        tabs.map((t) => [t, { index: 0 }])
      ) as Record<Tab, GridPosition>;
      changeTab("推荐");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "连接失败");
    } finally {
      setConnecting(false);
    }
  }
  function favorite(series: Series) {
    updateLibrary((old) => ({
      ...old,
      favorites: old.favorites.some((i) => i.id === series.id)
        ? old.favorites.filter((i) => i.id !== series.id)
        : [series, ...old.favorites],
    }));
  }
  function search() {
    positions.current["搜索"] = { index: 0 };
    setRestoreGrid(false);
    if (!query.trim()) {
      setSubmitted("");
      return;
    }
    setRestoreGrid(true);
    setSearchRun((n) => n + 1);
    if (submitted === query.trim()) void catalog.refresh();
    else setSubmitted(query.trim());
  }
  if (!ready)
    return (
      <View style={s.root}>
        <Notice message="正在加载…" busy />
      </View>
    );
  if (play)
    return (
      <View style={s.root}>
        <StatusBar hidden />
        <Player
          key={play.detail.id + ":" + play.index + ":" + play.position}
          detail={play.detail}
          initialIndex={play.index}
          initialPosition={play.position}
          provider={provider}
          onExit={exitPlayer}
          onProgress={record}
          test={play.test}
        />
      </View>
    );
  const recent = Object.values(library.progress).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
  const shown =
    tab === "收藏"
      ? library.favorites
      : tab === "最近观看"
      ? recent.map((p) => ({
          ...p.series,
          badge: `第 ${p.episodeNumber} 集 · ${
            p.completed ? "已看完" : Math.floor(p.position / 60) + " 分钟"
          }`,
        }))
      : catalog.items;
  return (
    <View
      style={[
        s.root,
        {
          paddingHorizontal: inset.horizontal,
          paddingVertical: inset.vertical,
        },
      ]}
    >
      <StatusBar hidden />
      <View style={s.header}>
        <Text style={s.brand}>红果 TV</Text>
        {!detailId ? (
          <View style={s.nav}>
            {tabs.map((t) => (
              <Button
                key={t}
                label={t}
                primary={tab === t}
                ref={(node) => {
                  if (node) nav.current.set(t, node);
                  else nav.current.delete(t);
                }}
                preferred={t === tab && !restoreGrid}
                onFocus={() => setFocusArea("nav")}
                onPress={() => changeTab(t)}
              />
            ))}
          </View>
        ) : (
          <Text style={s.muted}>剧集详情 · 返回键回到列表</Text>
        )}
      </View>
      {detailId ? (
        busy ? (
          <Notice message="正在加载剧集…" busy />
        ) : error ? (
          <Notice message={error} retry={() => setRefresh((n) => n + 1)} />
        ) : (
          detail && (
            <DetailTV
              key={detail.id}
              detail={detail}
              progress={library.progress[detail.id]}
              restoreEpisode={restoreEpisode}
              favorite={library.favorites.some((i) => i.id === detail.id)}
              onFavorite={() => {
                const { episodes: _, ...series } = detail;
                favorite(series);
              }}
              onPlay={(index, position) => setPlay({ detail, index, position })}
            />
          )
        )
      ) : tab === "设置" ? (
        <ScrollView
          contentContainerStyle={s.settings}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.heroTitle}>连接你的内容服务</Text>
          <Text style={s.description}>
            电视和运行服务的电脑 / NAS 连接同一网络，填入服务启动后显示的地址。
          </Text>
          <Text style={s.label}>服务地址</Text>
          <TextInput
            accessibilityLabel="服务地址"
            onFocus={() => (setEditing("url"), setFocusArea("content"))}
            onBlur={() => setEditing(undefined)}
            onSubmitEditing={connect}
            returnKeyType="done"
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.10:8787"
            placeholderTextColor="#747383"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              s.input,
              editing === "url" && { borderColor: palette.accent },
            ]}
          />
          <Text style={s.label}>访问口令（服务未设置时留空）</Text>
          <TextInput
            accessibilityLabel="访问口令"
            onFocus={() => (setEditing("token"), setFocusArea("content"))}
            onBlur={() => setEditing(undefined)}
            onSubmitEditing={connect}
            returnKeyType="done"
            value={token}
            onChangeText={setToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              s.input,
              editing === "token" && { borderColor: palette.accent },
            ]}
          />
          <View style={s.row}>
            <Button
              label={connecting ? "正在连接…" : "连接并保存"}
              disabled={connecting}
              primary
              onPress={connect}
            />
            <Button
              label="测试播放器"
              onPress={() =>
                setPlay({ detail: sample, index: 0, position: 0, test: true })
              }
            />
          </View>
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={s.feedback}>
              {message}
            </Text>
          )}
          <Text style={s.note}>
            测试播放器使用 Blender 的 Big Buck Bunny
            公开样片。此测试不代表红果内容可用。{"\n"}
            收藏和观看记录仅保存在当前设备。{"\n"}本应用为个人非官方客户端。
          </Text>
        </ScrollView>
      ) : (
        <>
          {tab === "搜索" ? (
            <View style={s.search}>
              <TextInput
                accessibilityLabel="搜索短剧"
                value={query}
                onChangeText={setQuery}
                placeholder="输入剧名或关键词"
                placeholderTextColor="#747383"
                onFocus={() => {
                  setEditing("search");
                  setFocusArea("content");
                }}
                onBlur={() => setEditing(undefined)}
                onSubmitEditing={search}
                returnKeyType="search"
                style={[
                  s.input,
                  { flex: 1 },
                  editing === "search" && { borderColor: palette.accent },
                ]}
              />
              <Button
                label="搜索"
                primary
                onFocus={() => setFocusArea("content")}
                onPress={search}
              />
            </View>
          ) : (
            <View style={s.heading}>
              <Text style={s.section}>{tab === "推荐" ? "今日热播" : tab}</Text>
              {tab === "推荐" && recent[0] ? (
                <Button
                  label={`续看：${recent[0].series.title.slice(0, 8)} · 第${
                    recent[0].episodeNumber
                  }集`}
                  onFocus={() => setFocusArea("content")}
                  onPress={() => open(recent[0].series)}
                />
              ) : (
                <Text style={s.muted}>{shown.length} 部短剧</Text>
              )}
            </View>
          )}
          {!settings.baseUrl ? (
            <Notice message="请先在设置中连接内容服务" />
          ) : (
            <TVGrid
              key={
                tab + ":" + (tab === "搜索" ? submitted + ":" + searchRun : "")
              }
              ref={grid}
              items={shown}
              width={width - inset.horizontal * 2}
              position={positions.current[tab]}
              restore={restoreGrid}
              onFocus={() => setFocusArea("content")}
              onOpen={open}
              busy={["推荐", "搜索"].includes(tab) && catalog.busy}
              error={["推荐", "搜索"].includes(tab) ? catalog.error : undefined}
              more={catalog.more}
              loadMore={
                ["推荐", "搜索"].includes(tab) &&
                (tab !== "搜索" || !!submitted)
                  ? catalog.loadMore
                  : undefined
              }
              empty={
                tab === "搜索"
                  ? submitted
                    ? "没有找到相关短剧，换个关键词试试"
                    : "输入关键词，发现下一部好剧"
                  : tab === "收藏"
                  ? "收藏喜欢的短剧，下次接着看"
                  : tab === "最近观看"
                  ? "开始播放后，这里会留下观看记录"
                  : "暂无内容"
              }
            />
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 12,
  },
  brand: { color: palette.accent, fontSize: 23, fontWeight: "800" },
  nav: { flexDirection: "row", gap: 8, flex: 1 },
  muted: { color: palette.muted, fontSize: 15 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  section: { color: palette.text, fontSize: 21, fontWeight: "700" },
  heroTitle: { color: palette.text, fontSize: 26, fontWeight: "700" },
  description: { color: palette.muted, fontSize: 17, lineHeight: 25 },
  settings: { padding: 6, gap: 12, paddingBottom: 24 },
  label: { color: palette.text, fontSize: 17 },
  input: {
    color: palette.text,
    fontSize: 18,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.panel,
  },
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  search: { flexDirection: "row", gap: 12, marginBottom: 12 },
  feedback: { color: palette.accent, fontSize: 17 },
  note: { color: palette.muted, fontSize: 15, lineHeight: 24, marginTop: 8 },
});
