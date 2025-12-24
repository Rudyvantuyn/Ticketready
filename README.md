# Ticketready
Ticket text generator

# TicketReady (Vercel-ready)

## What it is
A simple webapp that generates:
- Ticket-ready Incident descriptions (primary)
- Service catalog text
- Tier-1 troubleshooting checklists

Includes:
- Free mode: 3 generations/day (server-side)
- Pro mode: unlock by license key
- Pro is stored in a signed httpOnly cookie

---

## Deploy on Vercel (no local steps)
1) Create a new GitHub repo and add the files exactly as in this project structure.
2) In Vercel: New Project → Import the repo → Deploy.

### Environment Variables (required)
- OPENAI_API_KEY
- OPENAI_MODEL (optional, default: gpt-5.2)
- COOKIE_SECRET (any long random string)
- LICENSE_KEYS (comma-separated list, e.g. TR-AAAA-1111-BBBB,TR-CCCC-2222-DDDD)

### Environment Variables (recommended for persistent daily limit)
Upstash Redis REST (works perfectly on Vercel):
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

If UPSTASH vars are missing, the app uses in-memory fallback for the daily limit (resets on redeploy/cold starts).

---

## Branding
Edit `config/brand.json` to change name/colors/tagline.

---

## Selling (no-contact flow)
- Sell license keys on your checkout platform (Lemon Squeezy/Gumroad).
- Buyer receives key automatically.
- Buyer pastes key into “Unlock Pro”.
- No accounts, no onboarding, no demos.

Next step (optional):
- Replace allowlist with real license verification (provider API).
