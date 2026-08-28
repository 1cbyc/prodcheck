# Real-world use

`prodcheck` is meant for the boring moment before software ships.

It is not a replacement for code review, CI, observability, or deployment checks. It is a local pre-ship report that makes the release conversation more honest.

## When To Run It

Run it before opening a pull request:

```sh
readiness audit --base main
```

Run it before merging a risky branch:

```sh
readiness audit --base origin/main --run
```

Run only the cheap checks first when the repo has slow integration tests:

```sh
readiness audit --base origin/main --run-kind typecheck,lint
```

Run it before tagging or deploying a release candidate:

```sh
readiness audit --base v0.1.0 --run --github --json-output readiness-report.json
```

## What To Do With The Report

Paste the Markdown report into a pull request, release note, or deployment checklist.

The report should answer:

- what changed?
- which risky areas were touched?
- what checks were actually run?
- what checks are still only recommended?
- what does someone need to verify outside the local repo?

## How Teams Would Use It

A founder-engineer can run it before deploying from a local branch and use the report as a pause point.

A backend engineer can paste it into a PR when the diff touches migrations, auth, webhooks, billing, or config.

A platform engineer can use the JSON output as input for a CI comment or internal release journal.

A solo builder can keep old reports to remember what was checked before a release.

If a team wants project-specific rules, commit a `prodcheck.config.json` file to the repo. Use it for default base branches, smoke URLs, extra commands, and custom risk rules.

If a team wants a compact PR note, generate one separately:

```sh
readiness audit --base origin/main --github --pr-comment-output readiness-pr-comment.md
```

If a web app is running locally or in a review environment, add smoke checks:

```sh
readiness audit --smoke-url http://localhost:3000 --smoke-url https://preview.example.com
```

## What It Does Not Prove

`prodcheck` only proves what it actually checked.

It does not prove:

- remote CI passed;
- production environment variables are correct;
- the deployed service is healthy;
- a migration is safe on real production data;
- browser flows work;
- third-party provider state matches local config.

Those belong in future integrations or human-owned deployment steps.

When `--github` is used, `prodcheck` reads the latest GitHub Actions run for the current branch through the `gh` CLI. That is useful evidence, but it is still not the same as proving the deployed service is healthy.

The point is to say that clearly instead of letting the silence feel like confidence.
