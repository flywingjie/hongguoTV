import fs from "node:fs/promises";
const base = process.env.BRIDGE_URL || "http://127.0.0.1:8787";
const headers = process.env.BRIDGE_TOKEN
  ? { Authorization: `Bearer ${process.env.BRIDGE_TOKEN}` }
  : {};
const result = {
  at: new Date().toISOString(),
  base,
  checks: [],
  tvPlayback: "not_tested",
};
async function json(path) {
  const res = await fetch(base + path, {
    headers,
    signal: AbortSignal.timeout(70000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function check(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    result.checks.push({ name, ok: true, ms: Date.now() - start, ...detail });
    return detail;
  } catch (e) {
    result.checks.push({
      name,
      ok: false,
      ms: Date.now() - start,
      error: e.message,
    });
    return null;
  }
}
await check("health", async () => ({ data: await json("/health") }));
const home = await check("home", async () => {
  const d = await json("/api/home");
  if (!Array.isArray(d.items) || d.items.length < 3)
    throw new Error("Not enough real series to validate");
  return {
    count: d.items.length,
    series: d.items.slice(0, 3).map((s) => ({ id: s.id, title: s.title })),
  };
});
for (const series of home?.series || []) {
  await check(`search:${series.id}`, async () => {
    const d = await json("/api/search?q=" + encodeURIComponent(series.title));
    if (!d.items.some((s) => s.id === series.id))
      throw new Error("Search did not match the target series");
    return {
      count: d.items.length,
      matched: d.items.some((s) => s.id === series.id),
    };
  });
  const detail = await check(`detail:${series.id}`, async () => {
    const d = await json("/api/series/" + series.id);
    if (
      !d.episodes.length ||
      new Set(d.episodes.map((e) => e.id)).size !== d.episodes.length
    )
      throw new Error("Missing or duplicate episodes");
    return {
      count: d.episodes.length,
      unique: new Set(d.episodes.map((e) => e.id)).size,
      sample: [
        d.episodes[0],
        d.episodes[Math.floor(d.episodes.length / 2)],
        d.episodes.at(-1),
      ],
    };
  });
  for (const episode of detail?.sample || [])
    await check(`media:${episode.id}`, async () => {
      const p = await json("/api/episodes/" + episode.id + "/play?fresh=1");
      const res = await fetch(base + p.path, {
        headers: { ...headers, Range: "bytes=0-65535" },
        signal: AbortSignal.timeout(70000),
      });
      const bytes = Buffer.from(await res.arrayBuffer());
      if (
        res.status !== 206 ||
        bytes.length !== 65536 ||
        bytes.toString("ascii", 4, 8) !== "ftyp"
      )
        throw new Error(`Invalid MP4 range: ${res.status}, ${bytes.length}`);
      return {
        episode: episode.number,
        status: res.status,
        bytes: bytes.length,
        range: res.headers.get("content-range"),
      };
    });
}
await fs.mkdir("outputs", { recursive: true });
await fs.writeFile(
  "outputs/probe.json",
  JSON.stringify(result, null, 2) + "\n"
);
console.log(JSON.stringify(result, null, 2));
if (result.checks.some((c) => !c.ok)) process.exitCode = 1;
