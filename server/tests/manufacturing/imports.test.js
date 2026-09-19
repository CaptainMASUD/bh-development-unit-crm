import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manufacturingRoots = [
  "models/manufacturing",
  "controllers/manufacturing",
  "services/manufacturing",
  "routes/manufacturing",
];

const manufacturingFiles = async () => {
  const files = await Promise.all(
    manufacturingRoots.map(async (directory) => {
      const absoluteDirectory = path.join(serverRoot, directory);
      const entries = await readdir(absoluteDirectory);
      return entries
        .filter((entry) => entry.endsWith(".js"))
        .map((entry) => path.join(absoluteDirectory, entry));
    })
  );

  return files.flat().concat(path.join(serverRoot, "utils/manufacturingError.js"));
};

const assertExactPathCasing = async (target, source, specifier) => {
  const relativeTarget = path.relative(serverRoot, target);
  assert.ok(
    relativeTarget && !relativeTarget.startsWith(`..${path.sep}`) && relativeTarget !== "..",
    `${path.relative(serverRoot, source)} imports ${specifier} outside the server root`
  );
  const segments = relativeTarget.split(path.sep);
  let current = serverRoot;

  for (const segment of segments) {
    const entries = await readdir(current);
    assert.ok(
      entries.includes(segment),
      `${path.relative(serverRoot, source)} imports ${specifier} with incorrect casing`
    );
    current = path.join(current, segment);
  }
};

test("every Manufacturing file imports without ESM or export errors", async () => {
  for (const file of await manufacturingFiles()) {
    await import(pathToFileURL(file).href);
  }
});

test("every relative Manufacturing import resolves with exact file-name casing", async () => {
  const importPattern = /\b(?:import|export)\s+[^;]*?\sfrom\s*["']([^"']+)["']/g;

  for (const file of await manufacturingFiles()) {
    const source = await readFile(file, "utf8");

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;

      await assertExactPathCasing(path.resolve(path.dirname(file), specifier), file, specifier);
    }
  }
});
