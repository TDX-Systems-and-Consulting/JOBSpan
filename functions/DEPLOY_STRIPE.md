# Deploying Stripe Payment Integration (per-company, Bluevine payout)

**Updated Aug 2, 2026**: Stripe is now per-company, matching how QuickBooks
already works — each company connects its own Stripe account in Settings.
The previous version (a single Stripe key shared by the whole deployment)
was a real problem for anything beyond a single-company use: it would have
meant every company's customer payments landed in whoever owned that one
key's Stripe/bank account, not the company that did the job. That's fixed.

## Why this exists

QuickBooks Payments deposits into QuickBooks Checking, which is
white-labeled by Green Dot Bank — the thing causing the slow
funds-access problem. Stripe deposits straight into whatever bank
account each company has set as their own payout destination in their
own Stripe account. QuickBooks Online itself is untouched — still the
books of record, still gets every payment recorded via the existing
"Push to QuickBooks" logic (also triggered automatically by the Stripe
webhook, not just the manual button).

## One-time setup — per company

Each company using JOBSMETRIX does this once, in Settings, for their
own Stripe account. This is a real onboarding step now, not a one-time
deploy config the same way QBO already requires each company to
connect its own account.

### 1. Get your Stripe Secret Key

1. Go to **dashboard.stripe.com** → Developers → API keys
2. Copy the **Secret key** (starts with `sk_live_...` for real payments,
   or `sk_test_...` to test with fake cards first — recommended for the
   first test)

### 2. Set your payout bank account (in Stripe, not this app)

This is the step that actually determines where money lands — it's a
Stripe account setting, not something JOBSMETRIX controls:

1. Stripe Dashboard → Settings → **Bank accounts and scheduling**
2. Add your business bank account as the payout destination
3. Remove or deactivate any other payout destination currently set

### 3. Paste your key into JOBSMETRIX

1. In JOBSMETRIX: **Settings → Stripe Connection**
2. Paste your Secret Key, click **Connect Stripe**
3. JOBSMETRIX verifies the key works before saving it — you'll see a
   confirmation with which mode (test/live) it detected

### 4. Register the webhook (needed before payments auto-confirm)

Each company needs its own webhook registered, since each company has
its own Stripe account:

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. Endpoint URL:
   `https://us-central1-kytrac-72d91.cloudfunctions.net/stripeWebhook`
   (same URL for every company — the function figures out which
   company an event belongs to from the payment's own metadata, then
   verifies it against that company's own webhook secret)
3. Events to send: select just **checkout.session.completed**
4. Save — Stripe shows a **Signing secret** (`whsec_...`) for this
   specific endpoint
5. Back in JOBSMETRIX Settings → Stripe Connection, paste that
   webhook secret too and reconnect (or use the webhook secret field
   alongside the initial connect — either order works)

### 5. Test

1. Open any job with an invoice that has a remaining balance
2. Click **Email Invoice** — this silently generates a Stripe payment
   link behind the scenes using YOUR connected Stripe account
3. Send the email to yourself, click Pay Now, pay with a real card (or
   Stripe's test card `4242 4242 4242 4242` if still on `sk_test_...`)
4. Confirm:
   - The invoice's `amtPaid`/`status` update in JOBSMETRIX within a
     few seconds
   - The payment shows up in QuickBooks Online, linked to that
     invoice
   - The money lands in YOUR bank account on the next payout cycle,
     not anyone else's

## What's automatic, and what isn't

- **Payment link generation is automatic** — happens every time
  "Email Invoice" opens on an invoice with a balance still owed, using
  whichever Stripe account that specific company has connected.
- **Payment confirmation is automatic** — Stripe calls the shared
  webhook URL, which looks up the right company from the payment's
  metadata and verifies against that company's own webhook secret.
- **QBO bookkeeping sync is automatic on payment**, same as before —
  reuses the exact logic the manual "Push to QuickBooks" button uses.
- **Still NOT automatic**: the full cascade "Mark Paid" triggers
  manually (job status auto-advance, sprint board flags, change-order
  handling). Only invoice-level fields (`amtPaid`, `status`,
  `paidDate`) update automatically.

## Security notes

- The secret key and webhook secret are encrypted at rest (same
  AES-256-GCM scheme QBO tokens already use) and stored in a
  Firestore collection (`stripeTokens`) that's locked to
  `allow read, write: if false` — never client-readable regardless of
  role, only ever touched by Cloud Functions using the Admin SDK.
- The client only ever sees a non-sensitive status doc
  (`settings/stripe`: connected boolean, test/live mode, whether a
  webhook secret is set) — never the actual key material.
- `connectStripeAccount` verifies the key actually works (a real
  Stripe API call) before saving it, so a typo'd or revoked key never
  silently gets stored.

## Known limitations

- If a company hasn't connected Stripe yet, "Email Invoice" falls back
  silently to whatever `paymentLink`/`qbPaymentLink` already exists —
  sending invoices still works, it just won't have a fresh Stripe link
  until that company connects one.
- No partial-refund handling — if a customer disputes or a payment
  gets refunded in Stripe, `amtPaid` in JOBSMETRIX won't automatically
  decrease. Would need to be corrected manually for now.
- Stripe Checkout Sessions expire after 24 hours by default. A fresh
  one gets generated every time "Email Invoice" is opened.
- This is a managed-facilitator model (each company brings their own
  full Stripe account) — not Stripe Connect. There's no revenue share
  to JOBSMETRIX from payment volume in this version. That's a
  deliberate, separate future project, not something this setup does.
