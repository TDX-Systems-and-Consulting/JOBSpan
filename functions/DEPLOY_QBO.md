# Deploying QuickBooks Online Integration (needs Intuit Developer + your terminal)

Client-side is done: Settings has a "Connect QuickBooks" button, and every
invoice has a "Push to QuickBooks" button that cascades Customer → Estimate
→ Invoice → Payment. Nothing will actually push until this one-time OAuth
setup is done, though — same shape as the Google Calendar setup, but in the
Intuit Developer dashboard instead of Google Cloud Console.

## One-time setup

### 1. Intuit Developer dashboard

You said the app's already created, so:

1. Go to **developer.intuit.com** → sign in → your app
2. **Keys & OAuth** tab — you'll need these two, from whichever
   environment you're using first (Sandbox or Production — see step 2):
   - **Client ID**
   - **Client Secret**
3. Leave "Redirect URIs" open in another tab — you'll add the real one
   after first deploy (step 3 below), same chicken-and-egg as Google
   Calendar.

### 2. Pick sandbox or production

- **Sandbox** — Intuit gives you a free fake test company to push into.
  Safest place to prove the whole Customer → Estimate → Invoice →
  Payment chain actually works before it touches TDX Holdings' real
  books. Recommended for the very first test push.
- **Production** — connects to TDX Holdings' real QuickBooks Online
  company directly. Switch to this once a sandbox test push looks right.

Whichever you pick determines the `qbo.environment` config value below.

### 3. First deploy (to get the callback URL)

```
firebase deploy --only functions
```

After it finishes, look for the deployed URL of `qbOAuthCallback` in the
output — it'll look like:
```
https://us-central1-kytrac-72d91.cloudfunctions.net/qbOAuthCallback
```

### 4. Add the redirect URI

Back in the Intuit dashboard → your app → Keys & OAuth → Redirect URIs →
add that exact URL → Save. (Sandbox and Production keep separate redirect
URI lists in Intuit's dashboard — make sure you add it under the one that
matches the environment you picked in step 2.)

### 5. Set the config and redeploy

```
firebase functions:config:set qbo.client_id="your_client_id" qbo.client_secret="your_client_secret" qbo.redirect_uri="https://us-central1-kytrac-72d91.cloudfunctions.net/qbOAuthCallback" qbo.environment="sandbox"
```
(Use `qbo.environment="production"` instead once you're past sandbox testing.)

```
firebase deploy --only functions
```

### 6. Connect

Open JOBSpan → Settings → scroll to "QuickBooks Connection" → click
**Connect QuickBooks** → sign into Intuit → if asked, pick the company
file to authorize (this becomes the `realmId` you'll see in Settings once
connected — for production, pick **TDX Holdings**) → approve.

Only Owner, Project Manager, or Accounting roles can connect or
disconnect — everyone else won't see a working button (this is enforced
server-side, not just hidden in the UI).

### 7. Test push

Open any job with an invoice → click **Push to QuickBooks** on that
invoice → confirm:
- A Customer shows up in QuickBooks matching the job's linked customer
- An Estimate shows up if the job had a proposal
- The Invoice shows up with the right amount
- If the invoice already has `amtPaid` > 0, a Payment shows up too,
  linked to that Invoice

## What pushes, and how

- **Manual, not automatic** — nothing pushes until you click "Push to
  QuickBooks" on a specific invoice. Editing an invoice, proposal, or
  customer in JOBSpan does NOT auto-sync; you push when you're ready.
- **One button, four steps** — clicking it cascades Customer → Estimate
  → Invoice → Payment, skipping any step already done. Safe to click
  again later (e.g. after a partial payment comes in) — it'll only
  push the *new* payment amount, never double-count.
- **v1 simplification**: every Estimate/Invoice pushes as ONE lump-sum
  line (not itemized line-by-line), against a single catch-all Service
  item in QuickBooks (auto-detected on first push). If your QuickBooks
  company has no Service or Non-Inventory item at all yet, create one
  first — the push will tell you if it can't find one.
- Deleting an invoice/proposal in JOBSpan does **not** delete or void
  anything already pushed to QuickBooks — financial records don't get
  auto-removed. If something needs to be voided, do it directly in
  QuickBooks.

## Known limitations

- Line-item-by-line mapping (JOBSpan catalog items → matching QuickBooks
  Items) isn't in v1 — everything nets to one line per document. Flagged
  as a real v2 upgrade, not an oversight.
- A job needs a linked Customer record (companies/{cid}/customers) before
  it can push — if a job only has the old free-text `client` name field
  and no real customer record, the push will say so rather than guessing.
- No conflict handling if someone edits or deletes the pushed Invoice
  directly inside QuickBooks — the next push from JOBSpan will just try
  to update it using the last-known SyncToken and may fail if QuickBooks'
  version has moved on. Not expected to come up often if QuickBooks stays
  a one-way destination for JOBSpan-originated invoices.
