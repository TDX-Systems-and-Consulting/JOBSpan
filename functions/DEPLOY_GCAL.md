# Deploying Google Calendar Sync (needs Google Cloud Console + your terminal)

Client-side is done: the Calendar page has a "Connect Google Calendar"
button, and both sync triggers (personal events + job phases) are written
and ready. Nothing will actually sync until this one-time OAuth setup is
done, though - similar shape to the Twilio setup, but in Google Cloud
Console instead of Twilio's site.

## One-time setup

### 1. Google Cloud Console

1. Go to **console.cloud.google.com**
2. Create a new project (or use an existing one) - if you can, create it
   from **inside** your 7pillarsgroup.com Google Workspace admin account,
   since that makes step 3 much simpler
3. **APIs & Services > Library** → search "Google Calendar API" → Enable
4. **APIs & Services > OAuth consent screen**:
   - **User Type: Internal** if the project is tied to the
     7pillarsgroup.com Workspace (this skips Google's app verification
     review entirely - only people with a 7pillarsgroup.com account can
     ever connect, which is exactly what we want)
   - If Internal isn't available (project not Workspace-tied), use
     External and add each team member's email under "Test users" -
     works fine for a small team, just an extra step
   - App name: "JOBSpan" (or whatever), your email as contact
   - Scope: add `https://www.googleapis.com/auth/calendar.events`
5. **APIs & Services > Credentials > + Create Credentials > OAuth client ID**:
   - Application type: **Web application**
   - Name: "JOBSpan Calendar Sync"
   - Authorized redirect URIs: leave blank for now (see step 3 below -
     you'll add the real URL after first deploy)
   - Save it - you'll get a **Client ID** and **Client Secret**

### 2. First deploy (to get the callback URL)

```
firebase deploy --only functions
```

After it finishes, look for the deployed URL of `gcalOAuthCallback` in
the output - it'll look like:
```
https://us-central1-kytrac-72d91.cloudfunctions.net/gcalOAuthCallback
```

### 3. Add the redirect URI

Back in Google Cloud Console → your OAuth client → add that exact URL
under "Authorized redirect URIs" → Save.

### 4. Set the config and redeploy

```
firebase functions:config:set google.client_id="xxx.apps.googleusercontent.com" google.client_secret="your_secret_here" google.redirect_uri="https://us-central1-kytrac-72d91.cloudfunctions.net/gcalOAuthCallback"

firebase deploy --only functions
```

### 5. Connect your own calendar

Open JOBSpan → Calendar page → click **"Connect Google Calendar"** → sign
in with your 7pillarsgroup.com account → approve. Each team member does
this individually for their own calendar - nobody else's account gets
touched.

## What syncs, and how

- **One-way only**: JOBSpan → Google Calendar. Editing an event directly
  in Google Calendar won't change anything back in JOBSpan.
- **Personal events** (Calendar page "+ Event") sync to whichever person
  is set as the assignee.
- **Job phases** (schedule items under a job) sync to every crew member
  on that job who's connected their calendar - one JOBSpan phase can
  become several different Google Calendar events, one per crew member.
- Deleting an event/phase in JOBSpan deletes the corresponding Google
  Calendar event(s) too.

## Known limitations

- If someone hasn't ever signed into JOBSpan (no Firebase Auth account
  yet), they can't be matched to a calendar even if they're on a job's
  crew list - they need to log in at least once first.
- No conflict handling if someone manually deletes the JOBSpan-created
  event directly in their Google Calendar - the next sync will just fail
  silently (logged server-side) rather than recreating it. Not expected
  to come up often, but worth knowing.
