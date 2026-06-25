#!/usr/bin/env node
// Prepends a new release entry to CHANGELOG.md, built from git commit
// messages in a given range.
//
// Usage:
//   node update-changelog.js <tag> <gitRange>
//
// <gitRange> is anything `git log` accepts, e.g. "v1.3.0..v1.4.0" or just
// "v1.4.0" when there's no previous tag to diff against.
//
// Run as part of the tag-triggered release workflow. Kept as a real
// script (rather than inline shell) so commit message content is never
// interpolated unsafely into a shell command.

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const [, , tag, gitRange] = process.argv;

if (!tag || !gitRange) {
  console.error("Usage: update-changelog.js <tag> <gitRange>");
  process.exit(1);
}

// Pull commit subjects + short hash for the range, oldest-last (default
// git log order is newest-first, which is what we want for display).
// --invert-grep + --grep excludes this workflow's own past release
// commits so they don't clutter the changelog.
let log;
try {
  log = execSync(
    `git log ${gitRange} --pretty=format:"- %s (%h)" --invert-grep --grep="^chore(release):"`,
    { encoding: "utf8" },
  ).trim();
} catch (err) {
  console.error(`git log failed for range "${gitRange}":`, err.message);
  process.exit(1);
}

const body = log.length > 0 ? log : "- No notable changes.";

const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
const date = new Date().toISOString().slice(0, 10);

const versionOnly = tag.replace(/^v/, "");
const entry = `## [${versionOnly}] - ${date}\n\n### Added\n\n${body}\n`;

let existing = "";
if (fs.existsSync(changelogPath)) {
  existing = fs.readFileSync(changelogPath, "utf8");
} else {
  existing = "# Changelog\n\n";
}

// Insert the new entry immediately after the "Unreleased" section.
const unreleasedMatch = existing.match(/^## \[Unreleased\]\s*$/m);
let updated;

if (unreleasedMatch) {
  const insertPos = unreleasedMatch.index + unreleasedMatch[0].length;
  updated =
    existing.slice(0, insertPos) + `\n\n${entry}` + existing.slice(insertPos);
} else {
  updated = entry + existing;
}

// Add version reference link before existing reference links.
const compareMatch = gitRange.match(/^(.+)\.\.(.+)$/);

const compareLink = compareMatch
  ? `[${versionOnly}]: https://github.com/asteroidorg/cms-core-utils/compare/${compareMatch[1]}...${compareMatch[2]}`
  : `[${versionOnly}]: https://github.com/asteroidorg/cms-core-utils/releases/tag/${tag}`;

const refsStart = updated.search(/^\[\d+\.\d+\.\d+\]: /m);

if (refsStart >= 0) {
  updated =
    updated.slice(0, refsStart) + `${compareLink}\n` + updated.slice(refsStart);
} else {
  updated = `${updated.trimEnd()}\n\n${compareLink}\n`;
}

fs.writeFileSync(changelogPath, updated);
console.log(`Added ${tag} entry to CHANGELOG.md`);
