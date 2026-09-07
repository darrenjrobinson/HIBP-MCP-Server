#!/usr/bin/env node
// Fails if package.json and server.json disagree about the version, package name,
// or MCP Registry server name. Run before publishing so npm and the MCP Registry
// never receive mismatched metadata.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const server = require("../server.json");

const semver = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const errors = [];

if (!semver.test(pkg.version)) {
  errors.push(`package.json version "${pkg.version}" is not a semver version`);
}
if (server.version !== pkg.version) {
  errors.push(`server.json version "${server.version}" != package.json version "${pkg.version}"`);
}
if (server.name !== pkg.mcpName) {
  errors.push(`server.json name "${server.name}" != package.json mcpName "${pkg.mcpName}"`);
}

const packages = Array.isArray(server.packages) ? server.packages : [];
if (packages.length === 0) {
  errors.push("server.json has no packages[] entry");
}
packages.forEach((p, i) => {
  if (p.registryType !== "npm") return;
  if (p.identifier !== pkg.name) {
    errors.push(`server.json packages[${i}].identifier "${p.identifier}" != package.json name "${pkg.name}"`);
  }
  if (p.version !== pkg.version) {
    errors.push(`server.json packages[${i}].version "${p.version}" != package.json version "${pkg.version}"`);
  }
});

if (errors.length > 0) {
  console.error("Version consistency check failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`Version consistency OK: ${pkg.name}@${pkg.version} <-> ${server.name} ${server.version}`);
