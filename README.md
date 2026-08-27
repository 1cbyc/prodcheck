# prodcheck

`prodcheck` is a local-first prod readiness checker for repos and release candidates.

It audits the current git repository, identifies project shape and risky change areas, then writes a Markdown report that separates verified evidence from recommended checks.

## Usage

```sh
npm install
npm run build
npm link
readiness audit
```

By default, `readiness audit` does not run tests, builds, or other project commands. It only inspects local files and git metadata.

To run commands that look safe and are already defined by the repository:

```sh
readiness audit --run
```

Options:

```sh
readiness audit --base main --output readiness-report.md
readiness audit --run --max-command-seconds 120
readiness audit --json-output readiness-report.json
```

## What It Checks

- current branch and git status
- changed files against a base branch
- package managers and language markers
- test, lint, typecheck, build, and check scripts
- CI workflows
- Docker and deployment files
- environment and config surfaces without printing secret values
- database migrations
- risky change categories such as auth, billing, webhooks, migrations, deployment, secrets, routing, and dependencies

## Report

The report is written to `readiness-report.md` unless another output path is passed.

It is meant to be pasted into a PR, release note, or deployment checklist.

For concrete usage patterns, see [Real-world use](docs/real-world-use.md).
