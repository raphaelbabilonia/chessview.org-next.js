import assert from "node:assert/strict";
import { describe, it } from "node:test";

// news.js imports the API client through a path alias, so test the rule itself.
const source = (await import("node:fs")).readFileSync(new URL("../../src/lib/news.js", import.meta.url), "utf8");
const pattern = new RegExp(source.match(/return \/(.+)\/u\.test\(name\)/)[1], "u");
const isHandle = (name) => pattern.test(name);

describe("news author display", () => {
  it("hides CMS account handles", () => {
    for (const handle of ["editor_d", "admin", "web.editor", "user-12", "fide_editor"]) assert.equal(isHandle(handle), true, handle);
  });

  it("keeps real bylines", () => {
    for (const name of ["Peter Doggers", "Mike Klein", "FIDE", "José Pérez", "ChessBase"]) assert.equal(isHandle(name), false, name);
  });
});
