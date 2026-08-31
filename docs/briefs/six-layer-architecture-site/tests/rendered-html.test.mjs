import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://architecture.example/", { headers: { accept: "text/html", host: "architecture.example", "x-forwarded-proto": "https" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete architecture brief", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Six-layer enterprise agent architecture<\/title>/i);
  assert.match(html, /Evidence-led adoption brief/);
  assert.match(html, /System context/);
  assert.match(html, /Enterprise baseline/);
  assert.match(html, /Demonstrate value with a bounded pilot/);
  assert.match(html, /Presenter kit/);
  assert.match(html, /https:\/\/architecture\.example\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the site self-contained and accessible", async () => {
  const [page, layout, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected=\{active\}/);
  assert.match(page, /aria-expanded=\{open\}/);
  assert.match(page, /Print \/ save as PDF/);
  assert.match(page, /continue, adjust or stop/i);
  assert.match(layout, /generateMetadata/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media print/);
  await access(new URL("../public/og.png", import.meta.url));
});
