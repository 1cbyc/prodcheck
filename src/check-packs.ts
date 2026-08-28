import type { CheckPackFinding, RepoFacts } from "./types.js";

export function buildCheckPacks(facts: RepoFacts): readonly CheckPackFinding[] {
  const packs: CheckPackFinding[] = [];
  const categories = new Set(facts.riskCategories);

  if (categories.has("migrations")) {
    packs.push({
      category: "migrations",
      title: "Migration safety pack",
      items: [
        "Confirm the migration has been tested from the current production schema.",
        "Confirm whether it is backward-compatible with the currently deployed application.",
        "Write down the rollback limit, especially if data is transformed or dropped.",
        "Confirm backup/restore expectations before applying it to production."
      ]
    });
  }

  if (categories.has("auth")) {
    packs.push({
      category: "auth",
      title: "Auth safety pack",
      items: [
        "Test login, logout, session refresh, and expired-session behavior.",
        "Verify authorization boundaries for at least one allowed and one denied user.",
        "Confirm cookies, tokens, redirects, and callback URLs in the target environment.",
        "Check whether the change affects existing sessions or password reset flows."
      ]
    });
  }

  if (categories.has("billing")) {
    packs.push({
      category: "billing",
      title: "Billing safety pack",
      items: [
        "Exercise checkout, subscription update, cancellation, and entitlement refresh in sandbox.",
        "Confirm webhook events reconcile to the correct local account or team.",
        "Check idempotency for repeated provider events.",
        "Confirm failed-payment and incomplete-checkout states are visible to operators."
      ]
    });
  }

  if (categories.has("webhooks")) {
    packs.push({
      category: "webhooks",
      title: "Webhook safety pack",
      items: [
        "Verify signature validation with a real provider sample.",
        "Replay the same event twice and confirm idempotent behavior.",
        "Check retry behavior for transient failures.",
        "Confirm malformed events fail closed without losing evidence."
      ]
    });
  }

  return packs;
}
