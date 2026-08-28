# Configuration

`prodcheck` reads `prodcheck.config.json` or `.prodcheck.json` from the repository root.

CLI options override config defaults.

```json
{
  "base": "origin/main",
  "output": "readiness-report.md",
  "jsonOutput": "readiness-report.json",
  "prCommentOutput": "readiness-pr-comment.md",
  "github": true,
  "runKinds": ["typecheck", "lint"],
  "smokeUrls": ["http://localhost:3000"],
  "commands": [
    {
      "kind": "check",
      "command": "npm run verify",
      "source": "prodcheck config"
    }
  ],
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

Secret values should not be placed in this file.
