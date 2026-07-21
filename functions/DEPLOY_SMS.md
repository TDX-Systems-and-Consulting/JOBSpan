# Deploying SMS Message Routing (needs your Mac)

Everything client-side is already live: @mention parsing, the Customer
Portal "Message Us" box, per-team-member phone numbers in Settings, and
the routing logic (who gets notified). Messages save and route correctly
right now — they just don't send an actual text yet. That's this piece.

## One-time setup

1. **Install the Firebase CLI** (if you don't have it): `npm install -g firebase-tools`
2. **Log in**: `firebase login`
3. **From the repo root**, install function dependencies:
   ```
   cd functions
   npm install
   cd ..
   ```
4. **Get a Twilio account** at twilio.com if you don't have one, and buy a
   phone number capable of sending SMS (a few dollars/month).
5. **Set the Twilio credentials** as Firebase config (replace with your
   real values from the Twilio console):
   ```
   firebase functions:config:set twilio.sid="ACxxxxxxxxxxxxxxxx" twilio.token="your_auth_token_here" twilio.from="+1XXXXXXXXXX"
   ```
6. **Deploy**:
   ```
   firebase deploy --only functions
   ```

## After deploying

- Add cell phone numbers for Jason, Shane, Gonzalo, and yourself in
  **Settings > Team Management** — no phone number saved means no text,
  silently skipped (still shows up in-app either way).
- Test it: send a customer portal message with no @mention (should text
  you), then one with "@Shane" in it (should text Shane instead).
- Check the message doc in Firestore afterward — `notifyStatus` will say
  `sent`, `failed`, or `skipped_no_twilio_config` if something's off, with
  details in `notifyResults`.

## Known v1 limitations (not blockers, just worth knowing)

- Mention matching is first-name only, case-insensitive (e.g. "@Shane").
  No autocomplete UI yet — just type the @ and the name.
- The Customer Portal only shows the customer's own messages back to
  them, not team replies. Team members reply from the job's internal
  Messages tab, which the customer doesn't see live yet. Worth revisiting
  if two-way portal visibility becomes important.
- SMS body is truncated to 300 characters of the message text.
