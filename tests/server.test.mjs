import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, byteRange } from "../server/http.mjs";
async function fixture(t, provider, token = "") {
  const server = createServer(provider, token);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}
test("range handling supports seeking and suffixes; rejects malformed and multipart ranges", () => {
  assert.deepEqual(byteRange("bytes=50-", 100), [50, 99]);
  assert.deepEqual(byteRange("bytes=-10", 100), [90, 99]);
  for (const range of [
    "bytes=100-",
    "bytes=50-40",
    "bytes=-0",
    "bytes=0-1,5-6",
    "garbage",
    "bytes=-",
  ])
    assert.equal(byteRange(range, 100), null);
});
test("media stream delivers entire open range across 1 MB chunks; HEAD and suffix are correct", async (t) => {
  const data = Buffer.alloc(2 * 1024 * 1024 + 123, 7);
  let calls = 0;
  const url = await fixture(t, {
    stream: async () => ({
      total: data.length,
      chunk: async (a, b) => {
        calls++;
        return data.subarray(a, b + 1);
      },
    }),
  });
  const head = await fetch(url + "/api/episodes/123/stream", {
    method: "HEAD",
  });
  assert.equal(head.status, 200);
  assert.equal(calls, 0);
  const res = await fetch(url + "/api/episodes/123/stream", {
    headers: { Range: "bytes=17-" },
  });
  assert.equal(res.status, 206);
  assert.equal(
    res.headers.get("content-range"),
    `bytes 17-${data.length - 1}/${data.length}`
  );
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), data.subarray(17));
  assert.equal(calls, 3);
  const tail = await fetch(url + "/api/episodes/123/stream", {
    headers: { Range: "bytes=-20" },
  });
  assert.equal((await tail.arrayBuffer()).byteLength, 20);
  const bad = await fetch(url + "/api/episodes/123/stream", {
    headers: { Range: "bytes=999999999-" },
  });
  assert.equal(bad.status, 416);
});
test("authentication protects metadata and media; health does not claim upstream availability", async (t) => {
  const url = await fixture(t, {}, "secret");
  assert.equal((await fetch(url + "/health")).status, 401);
  const res = await fetch(url + "/health", {
    headers: { Authorization: "Bearer secret" },
  });
  assert.equal((await res.json()).upstream, "unverified");
  assert.equal((await fetch(url + "/api/episodes/1/stream")).status, 401);
});
test("upstream failures stay failures, do not expose signed URLs, and release stream slots", async (t) => {
  const fail = async () => {
    throw new Error("secret-signed-url");
  };
  const url = await fixture(t, { home: fail, stream: fail });
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url + "/api/episodes/1/stream");
    assert.equal(res.status, 502);
    assert.ok(!(await res.text()).includes("secret"));
  }
  assert.equal((await fetch(url + "/api/home")).status, 502);
});
test("bad identifiers and invalid queries never reach provider", async (t) => {
  const url = await fixture(t, {});
  assert.equal((await fetch(url + "/api/home?page=NaN")).status, 400);
  assert.equal((await fetch(url + "/api/search?q=")).status, 400);
  assert.equal(
    (await fetch(url + "/api/episodes/https:example/stream")).status,
    404
  );
});
