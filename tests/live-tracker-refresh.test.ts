import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("patient live tracker refresh", () => {
  it("fetches queue data without browser cache and uses a dedicated refresh handler", () => {
    const page = read("app/live/[token_id]/page.tsx");
    assert.match(page, /cache:\s*"no-store"/);
    assert.match(page, /handleRefresh/);
    assert.match(page, /setRefreshing\(true\)/);
    assert.match(page, /disabled=\{refreshing\}/);
    assert.match(page, /Refreshing\.\.\./);
    assert.match(page, /onClick=\{\(\) => void handleRefresh\(\)\}/);
  });
});
