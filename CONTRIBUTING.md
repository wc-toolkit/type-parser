# Contributing

Thanks for contributing to `@wc-toolkit/type-parser`.

This guide is for both human contributors and coding agents working in this repository.

## Getting started

1. Use **pnpm** for local commands in this repo.
2. Install dependencies with `pnpm install`.
3. Create a branch from `main`.

Common commands:

```bash
pnpm run build
pnpm run lint
pnpm run test
pnpm run format
```

## Development expectations

- Keep changes focused and avoid unrelated refactors.
- Follow existing code style and project structure.
- Update docs when behavior, APIs, or usage change.
- Do not overwrite or revert work you did not intend to change.

For agents:

- Prefer small, surgical edits.
- Read relevant files before changing them.
- Preserve existing behavior unless the task explicitly changes it.

## Pull requests

When opening a PR:

1. Branch from `main`.
2. Make the smallest complete change that solves the problem.
3. Run the relevant project commands before opening the PR.
4. Write a clear PR description that explains **what changed** and **why**.
5. Link any related issue or discussion when applicable.

PRs are easier to review when they stay scoped to a single concern.

## Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) to manage releases.

Add a changeset for any change that affects published package behavior, including:

- new features
- bug fixes
- breaking changes
- user-facing API or output changes

You can create one with:

```bash
pnpm run changeset
```

Choose the appropriate bump type:

- **patch** for fixes and small backward-compatible changes
- **minor** for new backward-compatible features
- **major** for breaking changes

Your changeset summary should clearly describe the user-visible impact.

You generally do **not** need a changeset for:

- documentation-only changes
- CI or workflow-only updates
- refactors with no user-facing effect
- test-only changes

If you are unsure whether a changeset is needed, include one unless the change is clearly internal-only.

## Release notes

Changeset entries may become release notes. Write them as short, clear statements focused on the impact to package users.
