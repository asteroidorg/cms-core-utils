#!/usr/bin/env node
// Prepends a new release entry to CHANGELOG.md.
//
// Usage:
//   node update-changelog.js <version> <prNumber> <prTitle> <bumpType>
//
// Run as part of the release workflow, once per merged PR carrying a
// major/minor/patch label. Kept as a real script (rather than inline
// shell) because PR titles can contain quotes, backticks, or other
// characters that are unsafe to interpolate directly into a shell
// command.

const fs = require("fs");
const path = require("path");

const [, , version, prNumber, prTitle, bumpType] = process.argv;

if (!version || !prNumber || !prTitle || !bumpType) {
  console.error(
    "Usage: update-changelog.js <version> <prNumber> <prTitle> <bumpType>",
  );
  process.exit(1);
}

const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
const date = new Date().toISOString().slice(0, 10);

const bumpLabel =
  { major: "Major", minor: "Minor", patch: "Patch" }[bumpType] || bumpType;

const entry = `## ${version} (${date})\n\n- **${bumpLabel}**: ${prTitle} (#${prNumber})\n\n`;

let existing = "";
if (fs.existsSync(changelogPath)) {
  existing = fs.readFileSync(changelogPath, "utf8");
} else {
  existing = "# Changelog\n\n";
}

// Insert the new entry right after the top-level heading, so the file
// stays newest-first under a single "# Changelog" title.
const headingMatch = existing.match(/^# .+\n+/);
let updated;
if (headingMatch) {
  const heading = headingMatch[0];
  const rest = existing.slice(heading.length);
  updated = heading + entry + rest;
} else {
  updated = entry + existing;
}

fs.writeFileSync(changelogPath, updated);
console.log(`Added ${version} entry to CHANGELOG.md`);
