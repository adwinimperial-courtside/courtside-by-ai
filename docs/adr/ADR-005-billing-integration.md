# ADR-005 — Billing Integration

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI is a commercial SaaS platform. Billing infrastructure must be designed before implementation begins, even though monetization has not yet started. The platform currently has ~100 free users across Finland, Philippines, Spain, and Canada — all jurisdictions with VAT/GST obligations the moment charging begins.

Pricing amounts are not decided and are explicitly excluded from this ADR. This ADR covers the billing model, provider choice, and technical architecture only.

---

## Decision

### 1. Billing provider — Paddle

Paddle is selected as the billing provider.

**Rationale:**
- Paddle operates as the **merchant of record** — it handles all tax collection and remittance (EU VAT, Canadian GST, Philippines VAT) automatically on Win's behalf
- No VAT registrations, no tax filings, no compliance overhead for Win as a solo founder
- Transaction-based pricing — zero cost until the first transaction occurs
- Integrating now costs nothing; billing is activated only when Win decides to monetize

Stripe was considered and rejected due to the tax compliance burden across multiple jurisdictions from day one of charging.

### 2. Billing model

Billing is **per league, per month**, calculated as the sum of role fees for all members in that league.

| Role | Billing |
|------|---------|
| league_admin | Charged per seat |
| coach | Charged per seat |
| player | Charged per seat |
| viewer | Free — not included in bill |

Specific pricing amounts are not decided and will be configured in Paddle when monetization begins.

**Example calculation (illustrative only — prices TBD):**
```
League members: 2 admins, 10 coaches, 50 players, 30 viewers
Bill = (2 × admin_price) + (10 × coach_price) + (50 × player_price) + (30 × 0)
```

The league admin's intent is that this cost can be passed on to participants via tournament or season entry fees — the platform bill is a known, predictable operating cost for the league.

### 3. Billing currency

Billing is denominated in **EUR**. Paddle handles currency conversion for customers paying in other currencies — they see their local currency, Win receives EUR.

### 4. Who pays — billing admin

Each league has a designated **billing admin** — the league member responsible for the league's Paddle subscription and monthly invoice.

- The billing admin is selected by Win from the league's existing `league_admin` members
- A league can have multiple league admins but exactly one billing admin
- The billing admin role is a flag on the `user_league_memberships` row, not a separate role

```sql
-- Addition to user_league_memberships (ADR-001)
alter table user_league_memberships
  add column is_billing_admin boolean default false;

-- Constraint: only one billing admin per league
create unique index one_billing_admin_per_league
  on user_league_memberships (league_id)
  where is_billing_admin = true;
```

### 5. Billing lifecycle

```
1. League is created (ADR-004)
2. Paddle subscription created in inactive/free state — no charge yet
3. Win decides to monetize → activates billing in Paddle dashboard
4. From activation date: monthly invoices generated per league
5. Invoice = sum of all non-viewer member seats for that billing period
6. Billing admin receives invoice and pays via Paddle
7. Non-payment → league access suspended (Paddle webhook triggers suspension)
8. Payment restored → access reinstated
```

### 6. Technical integration

Paddle is integrated via the Paddle.js client and Paddle webhooks processed by Supabase Edge Functions.

#### Key webhook events to handle

| Webhook event | Action |
|---------------|--------|
| `subscription.created` | Record subscription in database |
| `subscription.updated` | Update seat counts / plan changes |
| `subscription.cancelled` | Flag league for suspension |
| `transaction.completed` | Record payment, extend access |
| `transaction.payment_failed` | Notify billing admin, begin grace period |

#### Database additions

```sql
create table league_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid references leagues not null unique,
  paddle_subscription_id  text,
  status            text check (status in ('inactive', 'active', 'past_due', 'cancelled')),
  billing_admin_user_id   uuid references auth.users,
  activated_at      timestamptz,
  current_period_end timestamptz,
  created_at        timestamptz default now()
);
```

### 7. Current state — free period

Paddle is integrated but billing is inactive. All leagues operate in free mode until Win explicitly activates monetization. No charges are incurred during this period — Paddle only charges on completed transactions.

When Win is ready to monetize:
1. Configure pricing plans in Paddle dashboard
2. Set activation date
3. Notify existing league admins in advance
4. Existing leagues are grandfathered or transitioned per Win's decision at that time

### 8. Viewer restrictions

Viewers are free and do not contribute to the league bill. In exchange, viewer access is restricted to:
- League schedule (upcoming and past games)
- Stats for completed games

Viewers do not have access to live game tracking, analytics dashboards, team management, or any write operations.

---

## Alternatives Considered

### Stripe

Rejected. Requires Win to independently handle VAT registration and remittance across EU (Finland, Spain), Canada, and Philippines from the first transaction. Compliance cost and complexity far outweighs Stripe's lower per-transaction fee at current and near-term scale.

### Lemon Squeezy

Considered. Also a merchant of record. Rejected in favour of Paddle due to Paddle's greater maturity, more robust webhook infrastructure, and better documentation for per-seat SaaS billing models.

### Delay billing integration until monetization decision

Rejected. Integrating billing after the core architecture is built requires retrofitting — modifying provisioning flows, adding subscription state to RLS logic, and updating the data model. Integrating now in inactive mode costs nothing and avoids this risk.

---

## Consequences

### Positive
- Zero cost until first transaction — safe to integrate immediately
- All international tax compliance handled by Paddle automatically
- Per-seat billing model scales linearly with platform usage
- Billing admin concept cleanly separates payment responsibility from league management

### Negative / risks
- Paddle's per-transaction fee is higher than Stripe — acceptable at current scale, revisit if volume grows significantly
- Seat count must be kept in sync with `user_league_memberships` — a sync failure could result in under or over-billing
- Grace period and suspension logic must be implemented carefully to avoid incorrectly locking out paying leagues
