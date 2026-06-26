# Release Workflow Setup (manual tag → version, changelog, npm publish)

This workflow does **not** auto-decide the version. A human creates and
pushes a git tag (e.g. `v1.4.0`), and that exact number becomes the
package version — nothing here runs `npm version major/minor/patch`.

## How it works

1. You create a tag locally and push it:
   ```bash
   git tag v1.4.0
   git push origin v1.4.0
   ```
2. `.github/workflows/release.yml` triggers on that tag push and:
   - Reads the version straight from the tag name (`v1.4.0` → `1.4.0`)
   - Checks out `main`, sets that version in `package.json`, generates a
     changelog entry from commits since the previous tag, commits and
     pushes that to `main` (does **not** move or touch the tag itself)
   - Separately checks out the **tag** (not `main`) and publishes that
     exact code to npm
   - Creates a GitHub Release with auto-generated notes

## Why two checkouts in one job

The tag is the source of truth for what gets published — not whatever
has landed on `main` by the time the workflow runs. So the workflow:

- Checks out `main` once, to commit the version bump + changelog there
  (so your repo's history reflects the release)
- Checks out the **tag** separately, to actually run `npm publish` —
  guaranteeing the published package matches exactly what was tagged,
  with only the version field corrected

This also means the workflow never force-moves or rewrites the tag —
the tag stays exactly where you created it, forever.

## Required setup

**`NPM_TOKEN` secret** — generate an npm Automation token, add it as a
repo secret (Settings → Secrets and variables → Actions). Used by the
publish step.

**Branch protection** — if `main` requires PR reviews, the workflow's
push of the version-bump commit will fail unless `github-actions[bot]`
is allowed to bypass that rule for this specific automated commit.

## Tagging conventions that matter

- Tags must start with `v` (e.g. `v1.4.0`) to match the workflow's
  trigger filter (`tags: ["v*"]`) and the version-extraction logic.
- Tag whatever commit on `main` you want released — typically the
  latest one, but not required to be.
- `npm publish --access public` is included for first-time scoped
  package publishes (e.g. `@asteroidcms/...`); harmless no-op for
  unscoped packages.

## Re-running a release

If a run fails partway (e.g. npm publish fails due to an expired
token), re-pushing the same tag won't re-trigger the workflow — git
doesn't let you push an existing tag again without `--force`, and
force-pushing a tag is exactly what this setup avoids. Instead:

- Re-run the failed job from the Actions tab (Actions → the run →
  "Re-run failed jobs"), or
- Fix the issue and manually run the remaining steps locally (e.g.
  `npm publish` directly) for that version.

The version-bump and changelog steps are written to be safe to re-run
(`--allow-same-version`, and the commit/push steps won't fail the job
if there's nothing new to commit).

## What gets published

`npm publish` includes everything not excluded by `.npmignore` or your
package.json's `files` field. Confirm that's set correctly before
relying on this — otherwise the published package may include files you
didn't intend to ship.
