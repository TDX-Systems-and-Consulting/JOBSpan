// JOBSpan Cloud Functions
//
// sendMessageNotificationSms
// ──────────────────────────
// Triggers on every new doc in companies/{companyId}/jobs/{jobId}/messages.
// The client (kytrac-app.js: sendJobMessage / sendPortalMessage) already
// computed WHO should be notified (notifyTargets: [{name,email,phone}])
// and set notifyStatus:'pending' - this function's only job is to
// actually send the SMS via Twilio, since the Twilio auth token can never
// be shipped to the browser.
//
// Routing rule this implements (decided in JOBSpan chat, 7/21/2026):
//   - Customer portal messages -> default to the Owner, UNLESS a specific
//     team member is @mentioned by first name, in which case THEY get it.
//   - Internal team messages -> only notify if someone is @mentioned.
// (Both of those decisions already happened client-side; this function
// doesn't re-derive who to notify, it just sends to whoever's already in
// notifyTargets.)
//
// ── ONE-TIME SETUP REQUIRED (needs Travis's Mac - Firebase CLI + a real
//    Twilio account, neither of which work from the JOBSpan chat sandbox):
//
// 1. cd functions && npm install
// 2. Get a Twilio account (twilio.com) + a Twilio phone number capable of SMS
// 3. Set the Twilio credentials as Firebase Functions config:
//      firebase functions:config:set twilio.sid="ACxxxxxxxx" \
//        twilio.token="your_auth_token" \
//        twilio.from="+1XXXXXXXXXX"
//    (Or migrate to Secret Manager with defineSecret if using functions v2 -
//    either works, config: is simpler to start with.)
// 4. Deploy: firebase deploy --only functions
// 5. Make sure each team member who should get SMS has a phone number saved
//    in Settings > Team Management (the "Cell phone" field added alongside
//    this feature) - no phone number saved = no SMS, silently skipped.
//
// Until deployed, messages still save fine and notifyTargets still gets
// computed and shown in the UI ("📲 Texting so-and-so") - they just won't
// actually receive a text until this function is live.

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

function getTwilioClient() {
  const cfg = functions.config().twilio || {};
  if (!cfg.sid || !cfg.token) return null;
  const twilio = require('twilio');
  return { client: twilio(cfg.sid, cfg.token), from: cfg.from };
}

// syncMyClaims
// ────────────
// Sets Firebase Auth Custom Claims (companyId, role, fullAccessOverride)
// on the calling user, which is the ONLY thing Firestore Security Rules
// can trust for role checks - the client-side role display in the app
// is a UX convenience, this is the actual security boundary. Mirrors the
// same company-resolution logic as resolveCompany()/loadUserRole() in
// kytrac-app.js (owner match, then memberEmails match, then team doc
// lookup by email), but running server-side where it can't be spoofed.
//
// Called by the client right after login, followed by a forced ID token
// refresh (getIdToken(true)) so the new claims take effect immediately
// without requiring a full sign-out/sign-in.
exports.syncMyClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const email = (context.auth.token.email || '').toLowerCase();
  const uid = context.auth.uid;
  const db = admin.firestore();

  let companyId = null;
  let isOwner = false;

  const ownerSnap = await db.collection('companies').where('ownerEmail', '==', email).limit(1).get();
  if (!ownerSnap.empty) {
    companyId = ownerSnap.docs[0].id;
    isOwner = true;
  } else {
    const memberSnap = await db.collection('companies').where('memberEmails', 'array-contains', email).limit(1).get();
    if (!memberSnap.empty) companyId = memberSnap.docs[0].id;
  }

  if (!companyId) {
    // No company yet (brand new user) - clear any stale claims from a
    // previous company; client shows the onboarding flow in this case.
    await admin.auth().setCustomUserClaims(uid, null);
    return { companyId: null, role: null };
  }

  let role = 'Owner';
  let fullAccessOverride = false;

  if (!isOwner) {
    const teamDoc = await db.collection('companies').doc(companyId).collection('settings').doc('team').get();
    const key = email.replace(/\./g, '_');
    const member = teamDoc.exists ? (teamDoc.data().members || {})[key] : null;
    if (!member) {
      // memberEmails said they belong here, but there's no active team
      // entry (removed, or a stale/bad invite) - deny rather than
      // silently granting some default role.
      await admin.auth().setCustomUserClaims(uid, null);
      throw new functions.https.HttpsError('permission-denied', 'You are not an active member of this company. Contact your Owner.');
    }
    role = member.role || 'Field Technician';
    fullAccessOverride = !!member.fullAccessOverride;
  }

  await admin.auth().setCustomUserClaims(uid, { companyId, role, fullAccessOverride });
  return { companyId, role, fullAccessOverride };
});

// ════════════════════════════════════════════════════════════════════
// Google Calendar integration
// ════════════════════════════════════════════════════════════════════
// Direction: JOBSpan -> Google Calendar only (one-way push), decided in
// chat 7/23/2026. Each team member connects their OWN Google Calendar
// (not one shared company calendar). Syncs both:
//   1. Personal calendar events (companies/{cid}/calendarEvents) -> the
//      event's assignee's calendar
//   2. Job phases (companies/{cid}/jobs/{jid}/phases) -> every crew
//      member on that job who has connected their calendar
//
// ── ONE-TIME SETUP REQUIRED (Google Cloud Console, needs Travis - not
//    doable from the JOBSpan chat sandbox):
//
// 1. Go to console.cloud.google.com, create or select a project
// 2. Enable the "Google Calendar API" (APIs & Services > Library)
// 3. APIs & Services > OAuth consent screen:
//    - User Type: "Internal" if this Cloud project is associated with
//      the 7pillarsgroup.com Google Workspace (Internal apps skip
//      Google's verification review entirely - much simpler). If the
//      project isn't Workspace-associated, use "External" and add each
//      team member's email as a test user, or submit for verification.
//    - Scope needed: https://www.googleapis.com/auth/calendar.events
// 4. APIs & Services > Credentials > Create Credentials > OAuth client ID
//    - Application type: Web application
//    - Authorized redirect URI: the deployed URL of gcalOAuthCallback,
//      e.g. https://us-central1-kytrac-72d91.cloudfunctions.net/gcalOAuthCallback
//      (get the exact URL after first deploy, then add it here and
//      redeploy - chicken-and-egg, that's normal)
// 5. Set the client ID/secret as Firebase config:
//      firebase functions:config:set google.client_id="xxx.apps.googleusercontent.com" \
//        google.client_secret="xxx" \
//        google.redirect_uri="https://us-central1-kytrac-72d91.cloudfunctions.net/gcalOAuthCallback"
// 6. Deploy: firebase deploy --only functions
// 7. Each team member clicks "Connect Google Calendar" on the Calendar
//    page in JOBSpan and signs into their 7pillarsgroup.com account.
//
// Until connected, events/phases still save fine in JOBSpan - they just
// don't push anywhere until that person connects their calendar.

const { google } = require('googleapis');

function getGoogleOAuthConfig() {
  const cfg = functions.config().google || {};
  if (!cfg.client_id || !cfg.client_secret || !cfg.redirect_uri) return null;
  return cfg;
}

function newOAuth2Client() {
  const cfg = getGoogleOAuthConfig();
  if (!cfg) return null;
  return new google.auth.OAuth2(cfg.client_id, cfg.client_secret, cfg.redirect_uri);
}

// gcalOAuthStart
// ──────────────
// Client sends their Firebase ID token as ?token=... (verified here
// before redirecting to Google, so a stranger can't kick off an OAuth
// flow that gets tied to someone else's account). Redirects to Google's
// consent screen with state=base64(companyId:uid) so the callback knows
// whose tokens these are without trusting anything else from the client.
exports.gcalOAuthStart = functions.https.onRequest(async (req, res) => {
  const oauth2Client = newOAuth2Client();
  if (!oauth2Client) {
    res.status(500).send('Google Calendar OAuth is not configured yet (functions.config().google missing). See DEPLOY_GCAL.md.');
    return;
  }
  const idToken = req.query.token;
  if (!idToken) { res.status(400).send('Missing token'); return; }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    res.status(401).send('Invalid or expired session - please reload JOBSpan and try again.');
    return;
  }

  const companyId = req.query.companyId;
  if (!companyId) { res.status(400).send('Missing companyId'); return; }

  const state = Buffer.from(JSON.stringify({ companyId, uid: decoded.uid })).toString('base64');
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // needed to get a refresh_token
    prompt: 'consent',           // forces refresh_token on every connect, not just the first
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state
  });
  res.redirect(authUrl);
});

// gcalOAuthCallback
// ──────────────────
// Google redirects here after the user approves. Exchanges the code for
// tokens, stores the refresh_token in the locked-down googleCalendarTokens
// collection (never client-readable), and flips a plain boolean flag on
// the team member record so the UI can show "Connected".
exports.gcalOAuthCallback = functions.https.onRequest(async (req, res) => {
  const oauth2Client = newOAuth2Client();
  if (!oauth2Client) {
    res.status(500).send('Google Calendar OAuth is not configured yet.');
    return;
  }
  const { code, state, error } = req.query;
  if (error) { res.status(400).send('Google denied access: ' + error + '. You can close this tab and try again.'); return; }
  if (!code || !state) { res.status(400).send('Missing code/state from Google.'); return; }

  let parsed;
  try { parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8')); }
  catch (e) { res.status(400).send('Invalid state.'); return; }
  const { companyId, uid } = parsed;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      // Happens if the user had already connected before and Google
      // didn't re-issue a refresh_token this time - prompt=consent above
      // should prevent this, but guard anyway.
      res.status(400).send('Google did not return a refresh token. Please try disconnecting and reconnecting.');
      return;
    }
    const db = admin.firestore();
    await db.collection('companies').doc(companyId).collection('googleCalendarTokens').doc(uid).set({
      refreshToken: tokens.refresh_token,
      connectedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Flip the plain (non-secret) status flag the client can read.
    const email = (await admin.auth().getUser(uid)).email.toLowerCase();
    const key = email.replace(/\./g, '_');
    await db.collection('companies').doc(companyId).collection('settings').doc('team').set(
      { members: { [key]: { googleCalendarConnected: true } } },
      { merge: true }
    );

    res.send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>✅ Google Calendar connected</h2><p>You can close this tab and go back to JOBSpan.</p></body></html>');
  } catch (e) {
    console.error('gcalOAuthCallback error:', e.message);
    res.status(500).send('Error connecting Google Calendar: ' + e.message);
  }
});

// gcalDisconnect (callable)
// ─────────────────────────
// Lets a user disconnect their own calendar - deletes the stored token
// and clears the status flag. Does not revoke the Google-side grant
// (Google still shows JOBSpan under their connected apps until they
// remove it there too) but stops all future syncing immediately.
exports.gcalDisconnect = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  const companyId = data.companyId;
  if (!companyId) throw new functions.https.HttpsError('invalid-argument', 'Missing companyId.');
  const uid = context.auth.uid;
  const db = admin.firestore();
  await db.collection('companies').doc(companyId).collection('googleCalendarTokens').doc(uid).delete();
  const email = (context.auth.token.email || '').toLowerCase();
  const key = email.replace(/\./g, '_');
  await db.collection('companies').doc(companyId).collection('settings').doc('team').set(
    { members: { [key]: { googleCalendarConnected: false } } },
    { merge: true }
  );
  return { disconnected: true };
});

// Loads a ready-to-use Calendar API client for a given user, or null if
// they haven't connected (not an error - just means "don't sync for them").
async function getCalendarClientForUser(companyId, uid) {
  const db = admin.firestore();
  const tokenDoc = await db.collection('companies').doc(companyId).collection('googleCalendarTokens').doc(uid).get();
  if (!tokenDoc.exists) return null;
  const oauth2Client = newOAuth2Client();
  if (!oauth2Client) return null;
  oauth2Client.setCredentials({ refresh_token: tokenDoc.data().refreshToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Looks up the Firebase uid for a team member by email, needed since
// JOBSpan's own data model keys people by email but the Calendar tokens
// are keyed by uid.
async function getUidForEmail(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    return user.uid;
  } catch (e) {
    return null; // they've never signed into JOBSpan/Firebase Auth yet
  }
}

// pushPersonalEventToGCal
// ───────────────────────
// Personal calendar events (companies/{cid}/calendarEvents) already
// belong to one specific assignee - push create/update/delete straight
// to that person's calendar if they're connected.
exports.pushPersonalEventToGCal = functions.firestore
  .document('companies/{companyId}/calendarEvents/{eventId}')
  .onWrite(async (change, context) => {
    const { companyId, eventId } = context.params;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const assigneeEmail = (after || before)?.assignee;
    if (!assigneeEmail) return null; // unassigned events don't sync anywhere

    const uid = await getUidForEmail(assigneeEmail);
    if (!uid) return null;
    const cal = await getCalendarClientForUser(companyId, uid);
    if (!cal) return null; // not connected - nothing to do

    // Deleted in JOBSpan -> delete on Google Calendar too, if we'd
    // previously pushed one.
    if (!after) {
      if (before?.gcalEventId) {
        try { await cal.events.delete({ calendarId: 'primary', eventId: before.gcalEventId }); }
        catch (e) { console.warn('gcal delete failed (may already be gone):', e.message); }
      }
      return null;
    }

    const eventBody = {
      summary: after.title || 'JOBSpan Event',
      description: after.meetLink ? `Meet link: ${after.meetLink}` : undefined,
      start: after.time ? { dateTime: `${after.date}T${after.time}:00` } : { date: after.date },
      end: after.time ? { dateTime: `${after.date}T${after.time}:00` } : { date: after.date }
    };

    try {
      if (after.gcalEventId) {
        await cal.events.update({ calendarId: 'primary', eventId: after.gcalEventId, requestBody: eventBody });
      } else {
        const created = await cal.events.insert({ calendarId: 'primary', requestBody: eventBody });
        await change.after.ref.update({ gcalEventId: created.data.id });
      }
    } catch (e) {
      console.error('pushPersonalEventToGCal failed:', e.message);
    }
    return null;
  });

// pushPhaseToGCal
// ───────────────
// Job phases are shared across whoever's on the crew, not one person -
// push to every crew member's calendar who's connected. Tracks each
// person's Google event ID separately (gcalEventIds: {uid: eventId}),
// since one JOBSpan phase can correspond to several different Google
// Calendar events (one per crew member).
exports.pushPhaseToGCal = functions.firestore
  .document('companies/{companyId}/jobs/{jobId}/phases/{phaseId}')
  .onWrite(async (change, context) => {
    const { companyId, jobId } = context.params;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    const db = admin.firestore();
    const jobDoc = await db.collection('companies').doc(companyId).collection('jobs').doc(jobId).get();
    const job = jobDoc.exists ? jobDoc.data() : null;
    const crew = job?.crew || [];
    if (!crew.length) return null;

    const gcalEventIds = { ...(after?.gcalEventIds || before?.gcalEventIds || {}) };
    let idsChanged = false;

    for (const member of crew) {
      if (!member.email) continue;
      const uid = await getUidForEmail(member.email);
      if (!uid) continue;
      const cal = await getCalendarClientForUser(companyId, uid);
      if (!cal) continue;

      if (!after) {
        // Phase deleted - remove from this person's calendar if we'd pushed one.
        if (gcalEventIds[uid]) {
          try { await cal.events.delete({ calendarId: 'primary', eventId: gcalEventIds[uid] }); }
          catch (e) { console.warn('gcal phase delete failed:', e.message); }
        }
        continue;
      }

      const eventBody = {
        summary: `${after.name || 'Phase'} — ${job.name || 'Job'}`,
        description: `JOBSpan job phase${job.jobNumber ? ' (' + job.jobNumber + ')' : ''}`,
        start: { date: after.startDate },
        end: { date: after.endDate || after.startDate }
      };

      try {
        if (gcalEventIds[uid]) {
          await cal.events.update({ calendarId: 'primary', eventId: gcalEventIds[uid], requestBody: eventBody });
        } else {
          const created = await cal.events.insert({ calendarId: 'primary', requestBody: eventBody });
          gcalEventIds[uid] = created.data.id;
          idsChanged = true;
        }
      } catch (e) {
        console.error('pushPhaseToGCal failed for', member.email, ':', e.message);
      }
    }

    if (after && idsChanged) {
      await change.after.ref.update({ gcalEventIds });
    }
    return null;
  });

exports.sendMessageNotificationSms = functions.firestore
  .document('companies/{companyId}/jobs/{jobId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const msg = snap.data();
    if (!msg || msg.notifyStatus !== 'pending' || !Array.isArray(msg.notifyTargets) || !msg.notifyTargets.length) {
      return null;
    }

    const twilioSetup = getTwilioClient();
    if (!twilioSetup) {
      console.warn('Twilio not configured (functions.config().twilio missing) - skipping SMS, marking as skipped.');
      return snap.ref.update({ notifyStatus: 'skipped_no_twilio_config' });
    }

    const { companyId, jobId } = context.params;

    // Pull job + company name for a useful message body
    const [jobDoc, companyDoc] = await Promise.all([
      admin.firestore().collection('companies').doc(companyId).collection('jobs').doc(jobId).get(),
      admin.firestore().collection('companies').doc(companyId).collection('settings').doc('company').get()
    ]);
    const jobName = jobDoc.exists ? (jobDoc.data().name || 'a job') : 'a job';
    const companyName = companyDoc.exists ? (companyDoc.data().name || 'JOBSpan') : 'JOBSpan';

    const senderLabel = msg.fromCustomer ? 'Customer' : (msg.authorName || 'Team');
    const smsBody = `[${companyName}] ${senderLabel} on ${jobName}: ${(msg.text || '').slice(0, 300)}`;

    const results = [];
    for (const target of msg.notifyTargets) {
      if (!target.phone) { results.push({ ...target, status: 'skipped_no_phone' }); continue; }
      try {
        await twilioSetup.client.messages.create({
          body: smsBody,
          from: twilioSetup.from,
          to: target.phone
        });
        results.push({ ...target, status: 'sent' });
      } catch (err) {
        console.error('Twilio send failed for', target.phone, err.message);
        results.push({ ...target, status: 'failed', error: err.message });
      }
    }

    const anySent = results.some(r => r.status === 'sent');
    return snap.ref.update({
      notifyStatus: anySent ? 'sent' : 'failed',
      notifyResults: results,
      notifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
