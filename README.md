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
readiness audit --pr-comment-output readiness-pr-comment.md
readiness audit --github --smoke-url https://example.com
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
- GitHub Actions readback when `--github` is used
- smoke URL checks when `--smoke-url` or config `smokeUrls` are provided
- domain check packs for migrations, auth, billing, and webhooks

## Config

Create `prodcheck.config.json` or `.prodcheck.json` in a repository:

```json
{
  "base": "origin/main",
  "github": true,
  "runKinds": ["typecheck", "lint"],
  "smokeUrls": ["http://localhost:3000"],
  "riskRules": [
    {
      "category": "backend",
      "severity": "high",
      "title": "Queue worker changed",
      "why": "Worker changes can affect background processing and retries.",
      "pattern": "^workers/"
    }
  ]
}
```

## Report

The report is written to `readiness-report.md` unless another output path is passed.

It is meant to be pasted into a PR, release note, or deployment checklist.

For concrete usage patterns, see [Real-world use](docs/real-world-use.md). For config details, see [Configuration](docs/configuration.md).
