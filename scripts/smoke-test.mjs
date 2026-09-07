#!/usr/bin/env node
// Drives the built server over stdio exactly as an MCP host would and checks the
// wire output. A clean tsc build proves types resolve, not that the protocol works.
//
// Checks:
//   - initialize succeeds and serverInfo.version matches package.json
//   - tools/list returns every expected tool with a populated inputSchema.properties
//     (an empty properties object is the signature of the SDK 1.28 schema regression)
//
// No real HIBP API key is needed: nothing here calls the HIBP API. A placeholder key
// is supplied only so the server passes its startup check.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const entry = fileURLToPath(new URL("../build/main.js", import.meta.url));

const EXPECTED_TOOLS = ["HIBP-Breaches", "HIBP-Pastes", "HIBP-PwnedPasswords"];
const TIMEOUT_MS = 30_000;

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "1" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
];

const child = spawn(process.execPath, [entry], {
  env: { ...process.env, HIBP_API_KEY: process.env.HIBP_API_KEY || "smoke-test-placeholder" },
  stdio: ["pipe", "pipe", "inherit"],
});

const responses = new Map();
let buffer = "";

const done = new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error(`server did not answer initialize and tools/list within ${TIMEOUT_MS / 1000}s`));
  }, TIMEOUT_MS);

  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        clearTimeout(timer);
        child.kill();
        reject(new Error(`non-JSON output on stdout (would corrupt the stdio protocol): ${line.slice(0, 200)}`));
        return;
      }
      if (msg.id !== undefined) responses.set(msg.id, msg);
      if (responses.has(1) && responses.has(2)) {
        clearTimeout(timer);
        child.kill();
        resolve();
      }
    }
  });

  child.on("error", (err) => {
    clearTimeout(timer);
    reject(err);
  });
  child.on("exit", (code) => {
    if (!(responses.has(1) && responses.has(2))) {
      clearTimeout(timer);
      reject(new Error(`server exited (code ${code}) before answering; got ids [${[...responses.keys()].join(", ")}]`));
    }
  });
});

child.stdin.write(requests.map((r) => JSON.stringify(r)).join("\n") + "\n");
child.stdin.end();

const failures = [];
try {
  await done;
} catch (err) {
  failures.push(err.message);
}

if (failures.length === 0) {
  const init = responses.get(1);
  const list = responses.get(2);

  if (init.error) failures.push(`initialize returned error: ${JSON.stringify(init.error)}`);
  const info = init.result?.serverInfo ?? {};
  console.log(`initialize: serverInfo=${JSON.stringify(info)} protocolVersion=${init.result?.protocolVersion}`);
  if (info.name !== "HIBP-MCP") failures.push(`serverInfo.name is "${info.name}", expected "HIBP-MCP"`);
  if (info.version !== pkg.version) {
    failures.push(`serverInfo.version is "${info.version}" but package.json is "${pkg.version}" (version drift)`);
  }

  if (list.error) failures.push(`tools/list returned error: ${JSON.stringify(list.error)}`);
  const tools = new Map((list.result?.tools ?? []).map((t) => [t.name, t]));
  for (const name of EXPECTED_TOOLS) {
    const tool = tools.get(name);
    if (!tool) {
      failures.push(`tool "${name}" missing from tools/list`);
      continue;
    }
    const props = Object.keys(tool.inputSchema?.properties ?? {});
    console.log(`tool ${name}: properties=[${props.join(", ")}] required=${JSON.stringify(tool.inputSchema?.required ?? [])}`);
    if (tool.inputSchema?.type !== "object") failures.push(`tool "${name}" inputSchema.type is "${tool.inputSchema?.type}"`);
    if (props.length === 0) failures.push(`tool "${name}" has an empty inputSchema.properties (parameters dropped)`);
  }
  for (const name of tools.keys()) {
    if (!EXPECTED_TOOLS.includes(name)) console.log(`note: unexpected extra tool "${name}" listed`);
  }
}

if (failures.length > 0) {
  console.error("\nSmoke test FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nSmoke test OK: ${pkg.name}@${pkg.version} answers over stdio with ${EXPECTED_TOOLS.length} fully-described tools`);
