# crm-standard

Operations software for small Indian real-estate brokerages — five to twenty agents,
one deployment per customer.

## The core constraint

It has to run comfortably on a $6 droplet with 1GB of RAM.

That single number decides most of the architecture. SQLite instead of Postgres, one
Node process instead of services, static files behind Caddy instead of a rendering
server, systemd instead of a container runtime. There is no Docker here and no queue.
Backup is copying one file.

This is the opposite of the multi-tenant edge platform in
[wa-agent-platform](https://github.com/logiclovingmind/wa-agent-platform), and
deliberately so. There, one deployment serves every customer. Here, one droplet serves
exactly one customer and tenant isolation is a machine boundary rather than a policy —
which is far easier to reason about when the customer is a twelve-person brokerage that
wants to know precisely where their data sits.

## Access control is a query concern, not a UI concern

Three roles — `owner`, `manager`, `agent` — and agents may only ever see leads assigned
to them. The interesting part is where that gets enforced: `scopeLeadsToUser` middleware
appends the ownership predicate to the query itself, so a lead-fetching route cannot
forget the check. Hiding a button is not access control.

`server/tests/roleScoping.test.js` exists to keep that honest.

## What it does

- **Leads** through a fixed pipeline: New → Contacted → Site Visit → Negotiation →
  Closed/Lost. Every status change is written to `lead_activity` with actor, timestamp
  and the transition, which is what follow-up logic reads.
- **Intake from the WhatsApp agent**, which is the reason this exists — the agent
  qualifies, this is where the qualified lead lands.
- **Inventory** of projects and units, with brochures.
- **Notes**, append-only, timestamped and attributed.
- **English and Kannada** interfaces.

## Security

Passwords are bcrypt at cost 12. The login endpoint is rate limited to 5 attempts per
15 minutes per IP, with fail2ban banning at 10 failures by reading Caddy's logs. Session
cookies are `httpOnly`, `secure`, `sameSite=lax`, twelve-hour expiry. Every query is a
prepared statement — no SQL is ever built by string concatenation. CSRF protection on
all mutating routes. Configuration lives in `/etc/crm/.env`; nothing secret is in this
repository.

## Tests

37 tests across role scoping, WhatsApp intake, dashboard revenue and brochures.

```
npm install && npm test
```

## Stack

Node.js 22 · Express · SQLite via `better-sqlite3` in WAL mode · React 18 + Vite ·
Caddy for automatic HTTPS · systemd · Vitest

## Layout

```
server/     Express API, migrations, role middleware, tests
client/     React + Vite front end, en/kn locales
deploy/     systemd unit and Caddy configuration
docs/       operator guide
```
