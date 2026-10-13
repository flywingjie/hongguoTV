import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Detail,
  Progress,
  mergePage,
  normalizeBaseUrl,
  resumeTarget,
} from "../src/domain/model";
const detail: Detail = {
  id: "1",
  title: "剧",
  cover: "",
  description: "",
  badge: "",
  tags: "",
  episodes: [
    { id: "b", number: 1, title: "一" },
    { id: "a", number: 2, title: "二" },
  ],
};
const progress: Progress = {
  series: detail,
  episodeId: "a",
  episodeNumber: 1,
  position: 32,
  duration: 80,
  completed: false,
  updatedAt: 1,
};
test("resume follows stable episode ID after order changes", () =>
  assert.deepEqual(resumeTarget(detail, progress), { index: 1, position: 32 }));
test("completed episode advances, last episode restarts, absent episode resets", () => {
  assert.deepEqual(
    resumeTarget(detail, { ...progress, episodeId: "b", completed: true }),
    { index: 1, position: 0 }
  );
  assert.deepEqual(resumeTarget(detail, { ...progress, completed: true }), {
    index: 1,
    position: 0,
  });
  assert.deepEqual(
    resumeTarget(detail, { ...progress, episodeId: "missing" }),
    { index: 0, position: 0 }
  );
});
test("overlapping pagination replaces metadata without duplicating cards", () => {
  const rows = mergePage(
    [detail],
    [
      { ...detail, title: "新标题" },
      { ...detail, id: "2" },
    ]
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "新标题");
});
test("server config accepts host origins and rejects credentials, paths and other protocols", () => {
  assert.equal(
    normalizeBaseUrl(" http://192.168.1.10:8787/ "),
    "http://192.168.1.10:8787"
  );
  for (const url of [
    "file:///tmp/file",
    "http://user:secret@host",
    "http://host/path",
    "http://host?q=a",
    "",
  ])
    assert.throws(() => normalizeBaseUrl(url));
});
