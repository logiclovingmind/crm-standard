# Logic Loving Mind OS — Guide Book (IZI Tier)

*A Logic Loving Mind product. This guide covers everything your brokerage team needs to use the OS day-to-day, plus a short admin section for the account owner.*

---

## 1. Getting started

### Logging in

1. Open your OS address in a browser (e.g. `https://yourbrokerage.example.in`).
2. Enter the email and password given to you by your owner/admin.
3. You stay signed in for **12 hours**, after which you must log in again.

> Passwords must be at least 10 characters. If you forget yours, the owner can reset it from the **Users** page.

### Language — English / ಕನ್ನಡ

The OS works in **English and Kannada**. Use the language toggle in the app to switch — your choice is saved to your profile and applies every time you log in. Lead names, notes, and other data are always shown exactly as they were typed.

### Roles at a glance

| | Owner | Manager | Agent |
|---|---|---|---|
| See all leads | ✅ | ✅ | ❌ (own leads only) |
| Assign/reassign leads | ✅ | ✅ | ❌ |
| Update leads, add notes, schedule visits | ✅ | ✅ | ✅ (own leads) |
| Manage inventory (projects/units) | ✅ | ✅ | View only |
| Excel export | ✅ | ❌ | ❌ |
| Manage users & settings | ✅ | ❌ | ❌ |

---

## 2. The Dashboard

The Dashboard is your morning check-in. It shows:

- **Leads this month** — with a comparison to last month.
- **Conversion funnel** — how many leads sit in each pipeline stage.
- **Source breakdown** — where your leads come from (WhatsApp, portals, walk-ins…).
- **Stale leads** — leads that need attention *today* (see §4).
- **Backup warning banner** *(owner only)* — appears only if the weekly backup failed. If you see it, contact support.

Agents see numbers for their own leads; owners and managers see the whole brokerage.

---

## 3. Working with leads

### The pipeline

Every lead moves through a fixed pipeline:

**New → Contacted → Site Visit → Negotiation → Closed / Lost**

Update the status from the lead's detail page as the deal progresses. Every status change is recorded in the lead's **activity timeline** — who changed it, when, and from what to what.

### Where leads come from

Leads arrive two ways:

1. **Automatically from the WhatsApp AI bot** — this is the main flow. When a customer chats with your bot, a lead appears in the OS within seconds, complete with their requirement (e.g. *"2BHK, Whitefield, budget 80L"*) and a summary of the conversation.
   - **No duplicates:** if the same phone number messages again and their lead is still open, the OS adds the new conversation to the *existing* lead instead of creating a copy.
   - If the customer asked for a site visit in chat, that request comes through too.
2. **Manually** — click **New Lead** on the Leads page and enter name, phone, source, and requirement. Sources: `whatsapp`, `walk-in`, `99acres`, `magicbricks`, `referral`, `other`.

> Phone numbers are stored in the format `+91XXXXXXXXXX`.

### Finding leads

- **Search** by name or phone (partial matches work — typing `98450` finds the full number).
- **Filter** by status, source, assigned agent, or date range.

### The lead detail page

Open any lead to:

- **Change status** — moves it along the pipeline.
- **Assign an agent** *(owner/manager only)* — agents automatically own leads they create themselves.
- **Add notes** — free text, timestamped, with your name attached. Notes can never be edited or deleted, so the history is trustworthy.
- **Link units of interest** — connect the lead to specific units they're considering (a lead can be linked to several units).
- **Schedule a site visit** — pick a date/time; see §5.
- **Activity timeline** — the full history: status changes, assignments, notes, and visits in one place.

### What agents see

Agents see **only the leads assigned to them** — on every page, in every search, in every count. This is enforced on the server, not just hidden in the screen.

---

## 4. Follow-up nudges (stale leads)

A lead goes **stale** when it is in `New`, `Contacted`, or `Site Visit` and has had **no activity for 3 days (72 hours)**.

- Stale leads appear as a count and a list on the Dashboard, with the last-activity time.
- Agents see their own stale leads; owners and managers see everyone's.
- Any activity clears it — a note, a status change, a scheduled visit.

**Habit to build:** start each day by emptying the stale list. That's the whole follow-up system — simple on purpose.

---

## 5. Site visits & Google Calendar

### Scheduling

From a lead's detail page, schedule a visit with a date/time and (optionally) the project/unit. The visit is created as **`scheduled`**.

### After the visit

On the **Visits** page, update the outcome:

`scheduled` → `completed`, `no-show`, or `cancelled`

The Visits page can be filtered by status, so "what's coming up this week" and "who no-showed" are one click away.

### Calendar sync

Every visit is synced to your brokerage's **Google Calendar** automatically (one shared calendar per office). Updates and cancellations sync too.

> Sync is one-way (OS → Calendar) and best-effort: if Google is briefly unreachable, the OS still saves the visit and retries in the background. The OS is always the source of truth.

---

## 6. Inventory (projects & units)

*Editable by owner and manager; agents can view.*

- **Projects** hold your developments/sites (name + location).
- **Units** live inside projects: identifier (e.g. `A-1203`), type (`1BHK`, `2BHK`, `3BHK`, `plot`, `villa`), area in sqft, and price.
- Unit status: **`available` → `blocked` → `sold`**. Use `blocked` when a token/booking amount is received.
- Unit identifiers are unique within a project — you can't accidentally create `A-1203` twice.
- The project list shows how many units are still available in each project.

---

## 7. Excel export *(owner only)*

From the Leads page, the owner can export **all leads with a notes summary** to an Excel file — useful for month-end reviews or sharing with a builder.

Every export is recorded in the audit log (who exported, and when).

---

## 8. User management *(owner only)*

On the **Users** page the owner can:

- **Create users** — name, email, phone, password (min 10 characters), and role (`owner`, `manager`, `agent`).
- **Deactivate/reactivate users** — deactivate when an agent leaves; their leads stay in the system and can be reassigned. Don't delete history — deactivate.
- **Reset passwords** — for anyone who's locked out.

> **When an agent leaves:** deactivate their account first, then reassign their open leads from each lead's detail page.

---

## 9. Security & your data (plain-language summary)

- Your OS runs on **its own private server in Bangalore, India**. Your data is never mixed with another brokerage's and never leaves India.
- All traffic is encrypted (HTTPS).
- Login is protected against password-guessing: **5 failed attempts in 15 minutes blocks further tries**, and repeated abuse gets the source blocked at the server level. If you lock yourself out, wait 15 minutes or ask the owner to reset your password.
- Sessions expire after 12 hours.
- Notes and activity history are append-only — nothing can be silently rewritten.

---

## 10. Backups *(for the owner)*

- A full, **encrypted backup runs every Sunday at 2:00 AM IST** and is stored in a separate location (also in the Bangalore region).
- Backups are kept for **30 days**.
- Each backup is verified before upload — a corrupt backup is never silently accepted.
- **You don't need to do anything.** If a backup ever fails, a warning banner appears on your Dashboard — contact support and we'll fix it.

---

## 11. Getting help

- Support is **best-effort, business hours**, with a **24–48 hour response time**.
- Contact: **logiclovingmind@gmail.com**
- When reporting a problem, include: what you were doing, the page you were on, and a screenshot if possible.

### Quick troubleshooting

| Problem | Try this |
|---|---|
| Can't log in | Check email spelling; after 5 failed tries wait 15 min; ask owner for a password reset |
| Lead from WhatsApp not appearing | Check whether it was added to an *existing* lead with the same phone number (dedupe) |
| Can't see a lead a colleague mentions | It's assigned to someone else — ask a manager/owner to reassign it |
| Visit not on Google Calendar | It will retry automatically; if still missing after a few minutes, contact support |
| Backup warning banner | Contact support — no action needed on your side |

---

## Appendix: WhatsApp bot payload (for integrators)

The bot posts leads to `POST /api/integrations/whatsapp/lead` with a static bearer token (configured per deployment, never shared in the app UI):

```json
{
  "name": "string",
  "phone": "+91XXXXXXXXXX",
  "source": "whatsapp",
  "requirement": "2BHK, Whitefield, budget 80L",
  "conversation_summary": "string",
  "site_visit_requested": true,
  "preferred_slot": "2026-07-15T11:00:00+05:30"
}
```

Dedupe rule: same phone + lead not `Closed/Lost` → activity is appended to the existing lead; otherwise a new lead is created.

---

*The IZI tier does not include custom reports, multi-branch support, or date-range dashboards — those are EON-tier features. Ask us about upgrading if your team outgrows this.*
