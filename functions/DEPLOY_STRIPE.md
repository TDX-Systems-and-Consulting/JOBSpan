# Deploying Stripe Payment Integration (Bluevine payout, replaces QuickBooks Payments)

Client-side is done: opening "Email Invoice" on any invoice with a
remaining balance now automatically generates a fresh Stripe payment
link and embeds it as the "Pay Now" button — same place QuickBooks
Payments' link used to show up. Nothing will actually work until the
one-time Stripe setup below is done, though.

## Why this exists

QuickBooks Payments deposits into QuickBooks Checking, which is
white-labeled by Green Dot Bank — the thing causing the slow
funds-access problem. Stripe deposits straight into Bluevine instead,
skipping that hop entirely. QuickBooks Online itself is untouched —
still the books of record, still gets every payment recorded via the
existing "Push to QuickBooks" logic (now also triggered automatically
by the Stripe webhook, not just the manual button).

## One-time setup

### 1. Get your Stripe Secret Key

1. Go to **dashboard.stripe.com** → Developers → API keys
2. Copy the **Secret key** (starts with `sk_live_...` for real payments,
   or `sk_test_...` if you want to test with fake cards first —
   recommended for the first test, same as QBO's sandbox-first approach)

### 2. Set the Bluevine payout destination (do this in Stripe, not code)

This is the actual step that makes money land in Bluevine instead of
anywhere else — it's a Stripe account setting, not something either of
these Cloud Functions controls:

1. Stripe Dashboard → Settings → **Bank accounts and scheduling**
2. Add Bluevine's account/routing number as the payout bank account
3. Remove or deactivate any other payout destination that's currently set
4. Payout schedule defaults to daily — leave as-is unless you want it
   different

### 3. First deploy (to get the webhook URL)

```
firebase deploy --only functions:createStripePaymentLink,functions:stripeWebhook
```

After it finishes, look for the deployed URL of `stripeWebhook` in the
output — it'll look like:
```
https://us-central1-kytrac-72d91.cloudfunctions.net/stripeWebhook
```

### 4. Register the webhook in Stripe

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. Endpoint URL: paste the `stripeWebhook` URL from step 3
3. Events to send: select just **checkout.session.completed** (that's
   the only event type this listens for)
4. Save — Stripe will show a **Signing secret** (starts with `whsec_...`)
   for this specific endpoint. Copy it.

### 5. Set the config and redeploy

```
firebase functions:config:set stripe.secret_key="sk_live_your_key_here" stripe.webhook_secret="whsec_your_signing_secret_here"
```

```
firebase deploy --only functions
```

### 6. Test

1. Open any job with an invoice that has a remaining balance
2. Click **Email Invoice** — this silently generates a Stripe payment
   link behind the scenes (no button changed, just watch the invoice
   doc pick up a `paymentLink` field pointing to checkout.stripe.com)
3. Send the email to yourself, click the Pay Now button, pay with a
   real card (or Stripe's test card `4242 4242 4242 4242` if you're
   still on `sk_test_...`)
4. Confirm:
   - The invoice's `amtPaid`/`status` update in JOBSMETRIX within a
     few seconds (no page refresh needed — Firestore listeners pick it
     up live)
   - The payment shows up in QuickBooks Online, linked to that
     invoice's QBO record (same as a manual "Push to QuickBooks" would
     produce)
   - The money lands in Bluevine on the next payout cycle, not
     QuickBooks Checking

## What's automatic, and what isn't

- **Payment link generation is automatic** — happens every time you
  open "Email Invoice" on an invoice with a balance still owed. No
  button to click for this part.
- **Payment confirmation is automatic** — Stripe calls the webhook the
  moment a customer pays; `amtPaid`/`status`/`paidDate` update
  immediately, no manual step.
- **QBO bookkeeping sync is automatic on payment**, reusing the exact
  same logic the manual "Push to QuickBooks" button already uses — if
  the invoice was never pushed to QBO before, this creates the
  Customer/Estimate/Invoice there too, then records the payment.
- **What's deliberately NOT automatic**: this does not replicate
  everything the "Mark Paid" button does manually (auto-advancing job
  status to Approved, flagging the sprint board, change-order
  handling). Only the invoice-level fields (`amtPaid`, `status`,
  `paidDate`) update automatically. If you want the full cascade to
  also fire automatically on Stripe payment, that's a follow-up change,
  not something silently bundled into this one — didn't want a webhook
  making that call without you deciding it first.

## Known limitations

- If Stripe isn't configured yet (keys missing), "Email Invoice" falls
  back silently to whatever `paymentLink`/`qbPaymentLink` already
  exists — sending invoices still works, it just won't have a fresh
  Stripe link until the config above is set.
- No partial-refund handling — if a customer disputes or you refund a
  Stripe payment, `amtPaid` in JOBSMETRIX won't automatically decrease.
  Would need to be corrected manually for now.
- Stripe Checkout Sessions expire after 24 hours by default. A fresh
  one gets generated every time "Email Invoice" is opened, so this only
  matters if someone holds onto an old email without opening it again.
