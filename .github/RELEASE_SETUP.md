# Release Workflow Setup (PR label → bump type)

This setup determines the version bump type from a **label on the PR**,
not from commit messages — built specifically for squash-merge workflows,
where individual commit messages on a feature branch get collapsed into
one commit and are no longer reliably parseable.

## How it works

1. Create three labels in your repo: `major`, `minor`, `patch`
2. Every PR destined for `main` gets exactly one of those labels before
   merging
3. On merge, `.github/workflows/release.yml`:
   - Checks the merged PR's labels
   - Bumps `package.json` accordingly (`npm version major|minor|patch`)
   - Appends an entry to `CHANGELOG.md` with the PR title, number, and
     bump type, via `.github/scripts/update-changelog.js`
   - Commits, tags, and pushes
   - Creates a GitHub Release

## Required: label setup

Create these labels (Settings → Labels, or `gh label create`):

```bash
gh label create major --color FF0000 --description "Breaking change"
gh label create minor --color 00CC00 --description "New feature, backwards compatible"
gh label create patch --color 0066FF --description "Bug fix or small change"
```

## Important: PRs without a bump label are silently skipped

The workflow's `if:` condition checks for the presence of `major`,
`minor`, or `patch` on the merged PR. **If none of those three labels is
present, the workflow does not run at all** — no version bump, no
changelog entry, nothing. This is intentional (not every PR should
trigger a release — e.g. a docs-only or CI-only PR), but it means a
forgotten label on a real feature PR will silently produce no release.

Consider adding required-label branch protection (e.g. via a separate
lightweight "PR labeled" check) if you want merges blocked until a bump
label is applied. This setup doesn't include that check by default.

## Why this isn't `semantic-release` or `release-please`

Both of those tools are built around parsing **commit messages**
(`feat:`, `fix:`, `BREAKING CHANGE:`) to decide bump type — which doesn't
work reliably once PRs are squash-merged into a single commit, unless
that squash commit message itself is conventional-format (which a raw PR
title usually isn't). Since you're using PR labels as the source of
truth instead, this is a small custom workflow + script rather than a
drop-in tool. The trade-off: less battle-tested, but exactly matches your
process with no commit-message conventions required from contributors.

## Branch protection note

If `main` requires PR reviews, the workflow's direct
`git push origin main` will fail unless `github-actions[bot]` (the
`GITHUB_TOKEN` identity) is allowed to bypass that specific protection
rule.

## Publishing to npm (included)

`release.yml` publishes to npm automatically as the last step, after the
GitHub Release is created. To enable it:

1. Generate an npm **Automation** token (npmjs.com → your avatar →
   Access Tokens → Generate New Token → Automation type — this type
   bypasses 2FA prompts, which is required for CI). For an org-scoped
   package, the token must belong to an account with publish rights on
   that org/package.
2. Add it as a repo secret named `NPM_TOKEN`
   (Settings → Secrets and variables → Actions → New repository secret).
3. That's it — `setup-node`'s `registry-url` input plus
   `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` on the publish step handle
   authentication.

### `--access public`

The publish step runs `npm publish --access public`. This is required
the **first time** a scoped package (e.g. `@asteroidcms/your-package`) is
published — npm defaults scoped packages to private otherwise, which
fails on a free/team plan without a paid private-package add-on. For an
unscoped package this flag has no effect and is safe to leave in.

### If publish fails after the tag is already pushed

Because publish is the last step, a publish failure (bad token, network
blip, version already exists on the registry) does **not** roll back the
git tag, commit, or GitHub Release — those have already succeeded. To
recover, fix the underlying issue (e.g. rotate `NPM_TOKEN`) and either:

- Manually run `npm publish` locally for that version, or
- Re-run just the failed job from the Actions tab (Actions → the run →
  "Re-run failed jobs") — this re-runs the whole job including the
  version bump step, so only do this if `npm version` is idempotent for
  your case, or temporarily comment out the earlier steps if not.

### What gets published

By default, `npm publish` includes everything not excluded by
`.npmignore` or your package.json's `files` field. Double-check that
field exists and is correct before relying on this — otherwise you may
accidentally publish source files, tests, or `.github/` itself.
