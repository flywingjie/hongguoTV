import { test } from "node:test";
import assert from "node:assert/strict";
import { restoredIndex, seekPosition, tvInsets } from "../src/ui/tv/layout";

test("returning to reordered or removed content restores a valid stable target", () => {
  assert.equal(restoredIndex(["c", "a", "b"], "b", 0), 2);
  assert.equal(restoredIndex(["c", "a"], "removed", 15), 1);
  assert.equal(restoredIndex([], "removed", 15), 0);
  assert.equal(restoredIndex(["a"], undefined, -3), 0);
});

test("remote seeks clamp at both ends and never jump beyond the media duration", () => {
  assert.equal(seekPosition(3, -10, 90), 0);
  assert.equal(seekPosition(30, 10, 90), 40);
  assert.equal(seekPosition(88, 10, 90), 89.75);
  assert.equal(seekPosition(0, 10, 0), 0);
  let position = 30;
  for (let i = 0; i < 20; i++) position = seekPosition(position, 10, 90);
  assert.equal(position, 89.75);
});

test("equivalent TV logical sizes retain safe margins across density changes", () => {
  assert.deepEqual(tvInsets(1920 / 2, 1080 / 2), {
    horizontal: 48,
    vertical: 27,
  });
  assert.deepEqual(tvInsets(3840 / 4, 2160 / 4), {
    horizontal: 48,
    vertical: 27,
  });
  assert.deepEqual(tvInsets(1280 / (213 / 160), 720 / (213 / 160)), {
    horizontal: 48,
    vertical: 27,
  });
});
