#!/usr/bin/env node
// AUTHORED-BY Claude Opus 5.5
// smoke:dist — load the committed dist/ the way a consumer does and fail if it
// cannot. Unit tests run against src/, where @jeswr/fetch-rdf resolves its own
// dependencies; only dist/ resolves fetch-rdf's runtime deps from this
// package's top level, so a dependency bump can break it while every test
// passes. Needs no pod: initialize and tools/list never touch the network.
//
// Usage: node scripts/smoke-dist.mjs

import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));
const EXPECTED_TOOLS = ["solid_list", "solid_read", "solid_search", "solid_write"];

const lib = await import(dist("index.js"));
if (typeof lib.createSolidMcpServer !== "function") {
  throw new Error("smoke:dist — dist/index.js does not export createSolidMcpServer");
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [dist("cli.js")],
  env: { ...process.env, SOLID_MCP_POD_ROOT: "https://pod.example/" },
  stderr: "inherit",
});
const client = new Client({ name: "smoke-dist", version: "0.0.0" });
const timer = setTimeout(() => {
  console.error("smoke:dist — dist/cli.js did not answer within 20s");
  transport.close().finally(() => process.exit(1));
}, 20_000);

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  const missing = EXPECTED_TOOLS.filter((n) => !names.includes(n));
  if (missing.length > 0) {
    throw new Error(`smoke:dist — dist/cli.js is missing tools: ${missing.join(", ")}`);
  }
  console.log(
    `smoke:dist — OK (library loads; CLI answered initialize + tools/list: ${names.join(", ")})`,
  );
} finally {
  clearTimeout(timer);
  await client.close();
}
