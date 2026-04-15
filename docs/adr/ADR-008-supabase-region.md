# ADR-008 — Supabase Region

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI serves users across Finland, Philippines, Spain, and Canada. The app includes a live game console where a scorekeeper tracks stats in real time, and a live box score visible to all users simultaneously. Database region directly affects latency for both features.

The current Base44 platform hosts all apps in the USA with no EU option. This means Finnish and Spanish users have been experiencing transatlantic latency on the live game console, and EU user data has been stored outside the EU — a GDPR compliance issue.

---

## Decision

### Region — eu-central-1 (Frankfurt, Germany)

Supabase project is created in **eu-central-1 (Frankfurt)**.

### Rationale

| Factor | Detail |
|--------|--------|
| User concentration | Majority of users are in Finland and Spain — both EU, both close to Frankfurt |
| Live game console | Scorekeepers are primarily in Finland and Spain — low latency writes are critical for real-time stat tracking |
| GDPR compliance | EU user data stays within the EU — satisfies data residency requirements for Finnish and Spanish users |
| Improvement over Base44 | Base44 hosts in the USA — Frankfurt is a significant latency improvement for EU users on the live game console |
| Philippines and Canada | Higher latency than EU users, but no worse than their current Base44 experience — acceptable tradeoff |

### Latency expectations by region

| Region | Approximate latency to Frankfurt | Impact |
|--------|----------------------------------|--------|
| Finland | ~20ms | Excellent — live game console will feel responsive |
| Spain | ~30ms | Excellent — live game console will feel responsive |
| Canada | ~100-120ms | Acceptable — same as current Base44 US latency |
| Philippines | ~180-200ms | Acceptable — same or better than current Base44 US latency |

### GDPR implication

Storing EU user data in Frankfurt satisfies the GDPR data residency requirement that personal data of EU residents must not leave the EU without adequate safeguards. This removes a compliance risk that currently exists on Base44's US-hosted infrastructure.

---

## Alternatives Considered

### us-east-1 (North Virginia)

Rejected. Similar to Base44's current setup. No latency improvement for the majority EU user base. Continues the GDPR data residency problem.

### ap-southeast-1 (Singapore)

Rejected. Closer to Philippines but significantly worse for Finland and Spain, which represent the majority of users and the primary scorekeeper locations.

### us-west-1 (Oregon)

Rejected. No meaningful advantage over us-east-1 for any of the user locations.

### Multiple regions with read replicas

Considered for future scale. Supabase supports read replicas in additional regions, which would reduce latency for Philippines and Canada users on read-heavy operations (live box score). This is not necessary at current scale but should be revisited if the user base in those regions grows significantly.

---

## Consequences

### Positive
- Significant latency improvement for Finnish and Spanish users on the live game console
- EU data residency compliance from day one — no GDPR data residency risk
- Frankfurt is a mature, well-connected AWS region with high availability
- Supabase Realtime (used for live game console and live box score) will perform well for EU users

### Negative / risks
- Philippines and Canada users experience ~180-200ms latency — acceptable today but worth monitoring as those user bases grow
- If a major league operator emerges in the Philippines or Canada, read replicas should be evaluated at that point
- All Supabase project configuration, API keys, and connection strings must reference eu-central-1 — never accidentally create resources in a different region
