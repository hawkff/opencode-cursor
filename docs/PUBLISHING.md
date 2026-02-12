# Publishing `@rama_nigg/open-cursor`

This project is publishable as the npm package `@rama_nigg/open-cursor`. The binary entrypoint is `open-cursor` (`dist/cli/opencode-cursor.js`).

## Prerequisites

- npm account with publish access for `@rama_nigg/open-cursor`
- `NPM_TOKEN` configured in GitHub Actions repository secrets
- Clean `main` branch with passing CI

## Release Checklist

1. Update version in `package.json` (semver).
2. Build and run tests locally:
   - `bun install`
   - `bun run build`
   - `bun run test:ci:unit`
   - `bun run test:ci:integration`
3. Confirm package contents:
   - `npm pack --dry-run`
4. Confirm target version is not already published:
   - `npm view @rama_nigg/open-cursor version`
5. Commit and push the version bump to `main`.
6. Create and push a release tag:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`

## GitHub Actions Publish Flow

The workflow in `.github/workflows/publish.yml` publishes automatically on:

- `push` tags matching `v*`
- Manual `workflow_dispatch`

Publish step:

- `npm publish --access public`

If you need a non-publish validation run, execute the same build/test steps locally and use `npm pack --dry-run`.
