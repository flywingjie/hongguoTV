import http from "node:http";
import { timingSafeEqual } from "node:crypto";

export function byteRange(value, total) {
  if (!value) return [0, total - 1];
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2])) return null;
  const start = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
  const end = m[1]
    ? m[2]
      ? Math.min(Number(m[2]), total - 1)
      : total - 1
    : total - 1;
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    start < total
    ? [start, end]
    : null;
}

export function createServer(provider, token = "") {
  let activeStreams = 0;
  return http.createServer(async (req, res) => {
    const json = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const url = new URL(req.url || "/", "http://localhost");
    if (token) {
      const actual = Buffer.from(req.headers.authorization || "");
      const expected = Buffer.from(`Bearer ${token}`);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        return json(401, { error: "服务访问口令不正确" });
    }
    if (!["GET", "HEAD"].includes(req.method))
      return json(405, { error: "Method not allowed" });
    try {
      if (url.pathname === "/health")
        return json(200, {
          service: "hongguotv",
          version: "0.1.0",
          apiVersion: 1,
          upstream: "unverified",
        });
      if (url.pathname === "/api/home" || url.pathname === "/api/search") {
        const page = Number(url.searchParams.get("page") || 1);
        if (!Number.isInteger(page) || page < 1 || page > 100)
          return json(400, { error: "分页参数无效" });
        const keyword = (url.searchParams.get("q") || "").trim();
        if (
          url.pathname.endsWith("search") &&
          (!keyword || keyword.length > 80)
        )
          return json(400, { error: "请输入 1–80 字的关键词" });
        return json(
          200,
          url.pathname.endsWith("home")
            ? await provider.home(page)
            : await provider.search(keyword, page)
        );
      }
      const detail = /^\/api\/series\/(\d{1,30})$/.exec(url.pathname);
      if (detail) return json(200, await provider.detail(detail[1]));
      const play = /^\/api\/episodes\/(\d{1,30})\/(play|stream)$/.exec(
        url.pathname
      );
      if (!play) return json(404, { error: "接口不存在" });
      if (play[2] === "play") {
        await provider.stream(play[1], url.searchParams.get("fresh") === "1");
        return json(200, {
          path: `/api/episodes/${play[1]}/stream`,
          contentType: "video/mp4",
        });
      }
      if (activeStreams >= 4)
        return json(503, { error: "同时播放数已达上限，请稍后重试" });
      activeStreams++;
      try {
        const stream = await provider.stream(play[1]);
        const range = byteRange(req.headers.range, stream.total);
        if (!range) {
          res.writeHead(416, { "Content-Range": `bytes */${stream.total}` });
          return res.end();
        }
        const [start, end] = range;
        const headers = {
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Cache-Control": "no-store",
        };
        if (req.headers.range)
          headers["Content-Range"] = `bytes ${start}-${end}/${stream.total}`;
        // Validate the first chunk before sending success headers; then stream with backpressure.
        const chunkSize = 1024 * 1024;
        const first =
          req.method === "HEAD"
            ? null
            : await stream.chunk(start, Math.min(start + chunkSize - 1, end));
        res.writeHead(req.headers.range ? 206 : 200, headers);
        if (req.method === "HEAD") return res.end();
        for (
          let offset = start;
          offset <= end && !res.destroyed;
          offset += chunkSize
        ) {
          const chunk =
            offset === start
              ? first
              : await stream.chunk(
                  offset,
                  Math.min(offset + chunkSize - 1, end)
                );
          if (res.destroyed) break;
          if (!res.write(chunk)) {
            await new Promise((resolve) => {
              const done = () => {
                res.off("drain", done);
                res.off("close", done);
                resolve();
              };
              res.once("drain", done);
              res.once("close", done);
            });
          }
        }
        res.end();
      } finally {
        activeStreams--;
      }
    } catch (error) {
      // Upstream messages may contain signed URLs. Never echo them into client responses or logs.
      console.error(
        JSON.stringify({
          event: "request_failed",
          path: url.pathname,
          code: error.code || "UPSTREAM_ERROR",
        })
      );
      if (res.headersSent) res.destroy();
      else
        json(502, {
          error: "内容源暂不可用，请稍后重试；服务连通不代表内容源可用",
        });
    }
  });
}
