import assert from "node:assert/strict";
import test from "node:test";
import { getAllEvents } from "../../src/lib/api.js";

test("getAllEvents follows pagination beyond 25 pages", async (t) => {
  const originalFetch = globalThis.fetch;
  const totalPages = 27;
  const requestedPages = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (input) => {
    const url = new URL(input);
    const page = Number(url.searchParams.get("page"));
    requestedPages.push(page);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ _id: `event-${page}` }],
        meta: {
          hasNext: page < totalPages,
          page,
          pages: totalPages,
          total: totalPages,
        },
      }),
    };
  };

  const result = await getAllEvents({}, { pageSize: 1 });

  assert.equal(result.data.length, totalPages);
  assert.equal(result.meta.fetched, totalPages);
  assert.equal(result.meta.truncated, false);
  assert.deepEqual(requestedPages, Array.from({ length: totalPages }, (_, index) => index + 1));
});
