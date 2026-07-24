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

// ════════════════════════════════════════════════════════════════════
// QuickBooks Online integration
// ════════════════════════════════════════════════════════════════════
// ONE company-wide QuickBooks connection per JOBSpan company (unlike
// Google Calendar above, which is per-team-member) - whoever with full
// access connects it, the whole company's invoices push through that
// one QBO company file. Decided in chat 7/24/2026: v1 is a MANUAL,
// cascading push triggered by clicking "Push to QuickBooks" on an
// invoice - not an automatic sync on every write, so nothing pushes
// until Travis (or another full-access user) chooses to send it.
//
// Clicking that button runs, in order, skipping any step already done:
//   1. Customer - find-or-create a QBO Customer matching this job's
//      linked customer record (companies/{cid}/customers/{custId}),
//      store the returned Id back on that doc (qbCustomerId) so future
//      jobs for the same customer reuse it instead of duplicating.
//   2. Estimate - if the job has a latest proposal that hasn't been
//      pushed yet, create a QBO Estimate for it (qbEstimateId). Not
//      fatal if there's no proposal on file (e.g. a handshake job) -
//      Invoice push still proceeds either way.
//   3. Invoice - create (or update, if already pushed once) the QBO
//      Invoice for this specific invoice doc (qbInvoiceId).
//   4. Payment - if amtPaid has increased since the last push
//      (qbLastSyncedAmtPaid), record a QBO Payment for just the
//      difference, linked to the Invoice - so re-pushing the same
//      invoice after a partial payment never double-counts.
//
// v1 SIMPLIFICATION (flagged, not silently skipped): QBO requires every
// Estimate/Invoice line to reference an Item from their own
// products/services catalog. JOBSpan doesn't maintain a matching
// catalog inside QBO, so each push sends ONE lump-sum line against a
// single catch-all Service item (auto-detected and cached on first
// use - see getDefaultQboItemId). True line-by-line catalog mapping is
// a real v2 upgrade.
//
// ── ONE-TIME SETUP REQUIRED (Intuit Developer + Firebase CLI, needs
//    Travis - not doable from the JOBSpan chat sandbox): see
//    functions/DEPLOY_QBO.md for the full walkthrough.

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const QBO_FULL_ACCESS_ROLES = ['Owner', 'Project Manager', 'Accounting'];

function isQboFullAccess(token) {
  return QBO_FULL_ACCESS_ROLES.includes(token.role) || token.fullAccessOverride === true;
}

function getQboOAuthConfig() {
  const cfg = functions.config().qbo || {};
  if (!cfg.client_id || !cfg.client_secret || !cfg.redirect_uri) return null;
  return {
    clientId: cfg.client_id,
    clientSecret: cfg.client_secret,
    redirectUri: cfg.redirect_uri,
    environment: cfg.environment === 'production' ? 'production' : 'sandbox'
  };
}

function qboApiBase(environment) {
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

function qboBasicAuthHeader(cfg) {
  return 'Basic ' + Buffer.from(cfg.clientId + ':' + cfg.clientSecret).toString('base64');
}

// qbOAuthStart
// ────────────
// Requires a valid Firebase ID token (?token=...) AND a full-access
// role, same protection shape as gcalOAuthStart above but with a
// stricter role check - this connects ONE shared company-wide
// financial account, so it needs to be locked down harder than an
// individual's calendar.
exports.qbOAuthStart = functions.https.onRequest(async (req, res) => {
  const cfg = getQboOAuthConfig();
  if (!cfg) {
    res.status(500).send('QuickBooks OAuth is not configured yet (functions.config().qbo missing). See functions/DEPLOY_QBO.md.');
    return;
  }
  const idToken = req.query.token;
  const companyId = req.query.companyId;
  if (!idToken) { res.status(400).send('Missing token'); return; }
  if (!companyId) { res.status(400).send('Missing companyId'); return; }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    res.status(401).send('Invalid or expired session - please reload JOBSpan and try again.');
    return;
  }
  if (decoded.companyId !== companyId) {
    res.status(403).send('You are not a member of this company.');
    return;
  }
  if (!isQboFullAccess(decoded)) {
    res.status(403).send('Only Owner, Project Manager, or Accounting roles can connect QuickBooks.');
    return;
  }

  const state = Buffer.from(JSON.stringify({ companyId, uid: decoded.uid })).toString('base64');
  const authUrl = QBO_AUTH_URL + '?' + new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state
  }).toString();
  res.redirect(authUrl);
});

// qbOAuthCallback
// ────────────────
// Intuit redirects here after approval, WITH a realmId query param
// identifying which QuickBooks company file was authorized (Intuit
// shows a company picker on its consent screen if the person has
// access to more than one - whichever they pick becomes this realmId).
// Exchanges the code for tokens and stores the refresh token in the
// locked-down quickbooksTokens collection (never client-readable),
// mirroring the googleCalendarTokens pattern above.
exports.qbOAuthCallback = functions.https.onRequest(async (req, res) => {
  const cfg = getQboOAuthConfig();
  if (!cfg) { res.status(500).send('QuickBooks OAuth is not configured yet.'); return; }
  const { code, state, realmId, error } = req.query;
  if (error) { res.status(400).send('Intuit denied access: ' + error + '. You can close this tab and try again.'); return; }
  if (!code || !state || !realmId) { res.status(400).send('Missing code/state/realmId from Intuit.'); return; }

  let parsed;
  try { parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8')); }
  catch (e) { res.status(400).send('Invalid state.'); return; }
  const { companyId, uid } = parsed;

  try {
    const tokenResp = await fetch(QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': qboBasicAuthHeader(cfg),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: cfg.redirectUri
      }).toString()
    });
    const tokens = await tokenResp.json();
    if (!tokenResp.ok || !tokens.refresh_token) {
      console.error('qbOAuthCallback token exchange failed:', tokens);
      res.status(500).send('QuickBooks did not return valid tokens. Please close this tab and try connecting again.');
      return;
    }

    const db = admin.firestore();
    await db.collection('companies').doc(companyId).collection('quickbooksTokens').doc('connection').set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      realmId: String(realmId),
      environment: cfg.environment,
      connectedByUid: uid,
      connectedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Non-sensitive status flag/fields the client reads directly to
    // show connection state - no tokens ever live here.
    await db.collection('companies').doc(companyId).collection('settings').doc('quickbooks').set({
      connected: true,
      realmId: String(realmId),
      environment: cfg.environment,
      connectedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>✅ QuickBooks connected</h2><p>You can close this tab and go back to JOBSpan.</p></body></html>');
  } catch (e) {
    console.error('qbOAuthCallback error:', e.message);
    res.status(500).send('Error connecting QuickBooks: ' + e.message);
  }
});

// qbDisconnect (callable)
// ────────────────────────
// Best-effort revokes the token on Intuit's side too (so it also drops
// out of "My Apps" in their account), then always clears the local
// connection regardless of whether the revoke call succeeded.
exports.qbDisconnect = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  const companyId = data.companyId;
  if (!companyId || context.auth.token.companyId !== companyId) {
    throw new functions.https.HttpsError('permission-denied', 'Not a member of this company.');
  }
  if (!isQboFullAccess(context.auth.token)) {
    throw new functions.https.HttpsError('permission-denied', 'Only Owner, Project Manager, or Accounting can disconnect QuickBooks.');
  }

  const db = admin.firestore();
  const cfg = getQboOAuthConfig();
  const tokenRef = db.collection('companies').doc(companyId).collection('quickbooksTokens').doc('connection');
  const tokenDoc = await tokenRef.get();
  if (cfg && tokenDoc.exists && tokenDoc.data().refreshToken) {
    try {
      await fetch(QBO_REVOKE_URL, {
        method: 'POST',
        headers: { 'Authorization': qboBasicAuthHeader(cfg), 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ token: tokenDoc.data().refreshToken })
      });
    } catch (e) {
      console.warn('QBO revoke call failed (continuing with local disconnect):', e.message);
    }
  }

  await tokenRef.delete();
  await db.collection('companies').doc(companyId).collection('settings').doc('quickbooks').set({ connected: false }, { merge: true });
  return { disconnected: true };
});

// ensureQboAccessToken
// ─────────────────────
// Returns a ready-to-use {accessToken, realmId, environment} for a
// company, refreshing against Intuit first if the current access token
// is expired or about to be (within 2 minutes). Intuit refresh tokens
// ROTATE on every use - the new one returned here is always re-saved,
// or the old one stops working on the next call.
async function ensureQboAccessToken(companyId) {
  const cfg = getQboOAuthConfig();
  if (!cfg) throw new Error('QuickBooks is not configured (functions.config().qbo missing).');
  const db = admin.firestore();
  const ref = db.collection('companies').doc(companyId).collection('quickbooksTokens').doc('connection');
  const doc = await ref.get();
  if (!doc.exists) throw new Error('QuickBooks is not connected for this company yet - connect it in Settings first.');
  const data = doc.data();

  if (data.expiresAt && data.expiresAt - Date.now() > 2 * 60 * 1000) {
    return { accessToken: data.accessToken, realmId: data.realmId, environment: data.environment };
  }

  const resp = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': qboBasicAuthHeader(cfg),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refreshToken }).toString()
  });
  const tokens = await resp.json();
  if (!resp.ok || !tokens.access_token) {
    console.error('QBO token refresh failed:', tokens);
    throw new Error('The QuickBooks connection has expired or was revoked - please reconnect it in Settings.');
  }
  await ref.update({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || data.refreshToken,
    expiresAt: Date.now() + (tokens.expires_in * 1000)
  });
  return { accessToken: tokens.access_token, realmId: data.realmId, environment: data.environment };
}

// Thin wrapper for calling Intuit's Accounting API v3.
async function qboFetch(companyId, method, path, body) {
  const { accessToken, realmId, environment } = await ensureQboAccessToken(companyId);
  const url = `${qboApiBase(environment)}/v3/company/${realmId}/${path}`;
  const resp = await fetch(url, {
    method,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json?.Fault?.Error?.[0]?.Message || json?.Fault?.Error?.[0]?.Detail || resp.statusText;
    throw new Error('QuickBooks API error: ' + msg);
  }
  return json;
}

// Escapes single quotes for QBO's SQL-like query language (their docs
// call it "Data Service query language" - backslash-escape, not '').
function qboEsc(str) { return String(str || '').replace(/'/g, "\\'"); }

// getDefaultQboItemId
// ────────────────────
// See the v1 simplification note at the top of this section - caches
// the chosen Item's Id on settings/quickbooks after the first lookup
// so every subsequent push skips the query.
async function getDefaultQboItemId(companyId) {
  const db = admin.firestore();
  const cfgRef = db.collection('companies').doc(companyId).collection('settings').doc('quickbooks');
  const cfgDoc = await cfgRef.get();
  if (cfgDoc.exists && cfgDoc.data().defaultItemId) return cfgDoc.data().defaultItemId;

  const result = await qboFetch(companyId, 'GET',
    `query?query=${encodeURIComponent("SELECT * FROM Item WHERE Type IN ('Service','NonInventory') MAXRESULTS 1")}`);
  const item = result?.QueryResponse?.Item?.[0];
  if (!item) throw new Error('No usable Item found in QuickBooks to bill against - create at least one Service item in QuickBooks first, then try again.');
  await cfgRef.set({ defaultItemId: item.Id, defaultItemName: item.Name }, { merge: true });
  return item.Id;
}

// ensureQboCustomer
// ──────────────────
// Find-or-create the QBO Customer for a JOBSpan customer record.
// Matches by DisplayName first (covers a customer already created
// manually in QBO, or by an earlier push), otherwise creates a new
// one. Stores the QBO Id back on the JOBSpan customer doc so every
// future job for that same customer reuses it instead of duplicating.
async function ensureQboCustomer(companyId, customerId) {
  const db = admin.firestore();
  const custRef = db.collection('companies').doc(companyId).collection('customers').doc(customerId);
  const custDoc = await custRef.get();
  if (!custDoc.exists) throw new Error('Customer record not found for this job - open the job and confirm it has a linked Customer.');
  const cust = custDoc.data();
  if (cust.qbCustomerId) return cust.qbCustomerId;

  const name = cust.name || 'Unknown Customer';
  const existing = await qboFetch(companyId, 'GET',
    `query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${qboEsc(name)}'`)}`);
  const found = existing?.QueryResponse?.Customer?.[0];
  if (found) {
    await custRef.update({ qbCustomerId: found.Id });
    return found.Id;
  }

  const payload = { DisplayName: name };
  if (cust.email) payload.PrimaryEmailAddr = { Address: cust.email };
  if (cust.phone) payload.PrimaryPhone = { FreeFormNumber: cust.phone };
  if (cust.address) payload.BillAddr = { Line1: cust.address };
  const created = await qboFetch(companyId, 'POST', 'customer', payload);
  const qbId = created?.Customer?.Id;
  if (!qbId) throw new Error('QuickBooks did not return a Customer Id.');
  await custRef.update({ qbCustomerId: qbId });
  return qbId;
}

// ensureQboEstimate
// ──────────────────
// Pushes the job's latest proposal (if any, and if not already pushed)
// as a QBO Estimate. A missing proposal isn't fatal - Invoice push
// still proceeds without one (e.g. a handshake deal with no formal
// estimate on file).
async function ensureQboEstimate(companyId, jobId, qbCustomerId) {
  const db = admin.firestore();
  const propSnap = await db.collection('companies').doc(companyId).collection('jobs').doc(jobId)
    .collection('proposals').orderBy('version', 'desc').limit(1).get();
  if (propSnap.empty) return null;
  const propDoc = propSnap.docs[0];
  const prop = propDoc.data();
  if (prop.qbEstimateId) return prop.qbEstimateId;

  const total = prop.snapshot?.grandTotal || 0;
  const itemId = await getDefaultQboItemId(companyId);
  const payload = {
    CustomerRef: { value: qbCustomerId },
    Line: [{
      Amount: total,
      DetailType: 'SalesItemLineDetail',
      Description: 'JOBSpan Estimate',
      SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: total }
    }]
  };
  const created = await qboFetch(companyId, 'POST', 'estimate', payload);
  const qbId = created?.Estimate?.Id;
  if (qbId) await propDoc.ref.update({ qbEstimateId: qbId });
  return qbId;
}

// qbCreateInvoice (callable)
// ───────────────────────────
// The button Travis clicks: "Push to QuickBooks" on an invoice.
// Cascades Customer -> Estimate -> Invoice -> Payment in order, each
// step skipped if already done, and returns the QBO Invoice Id so the
// button can confirm success.
exports.qbCreateInvoice = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  const { companyId, jobId, invoiceId } = data;
  if (!companyId || !jobId || !invoiceId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing companyId/jobId/invoiceId.');
  }
  if (context.auth.token.companyId !== companyId) {
    throw new functions.https.HttpsError('permission-denied', 'Not a member of this company.');
  }
  if (!isQboFullAccess(context.auth.token)) {
    throw new functions.https.HttpsError('permission-denied', 'Only Owner, Project Manager, or Accounting can push to QuickBooks.');
  }

  const db = admin.firestore();
  const jobRef = db.collection('companies').doc(companyId).collection('jobs').doc(jobId);
  const invRef = jobRef.collection('invoices').doc(invoiceId);
  const [jobDoc, invDoc] = await Promise.all([jobRef.get(), invRef.get()]);
  if (!jobDoc.exists) throw new functions.https.HttpsError('not-found', 'Job not found.');
  if (!invDoc.exists) throw new functions.https.HttpsError('not-found', 'Invoice not found.');
  const job = jobDoc.data();
  const inv = invDoc.data();

  if (!job.customerId) {
    throw new functions.https.HttpsError('failed-precondition', 'This job has no linked Customer record - open the job and set a Customer before pushing to QuickBooks.');
  }

  try {
    // 1. Customer
    const qbCustomerId = await ensureQboCustomer(companyId, job.customerId);

    // 2. Estimate (best-effort - a missing proposal doesn't block the invoice)
    try { await ensureQboEstimate(companyId, jobId, qbCustomerId); }
    catch (e) { console.warn('QBO Estimate push skipped:', e.message); }

    // 3. Invoice
    const itemId = await getDefaultQboItemId(companyId);
    const total = inv.total || 0;
    let qbInvoiceId = inv.qbInvoiceId;
    if (qbInvoiceId) {
      // Updating requires the current SyncToken - QBO rejects updates
      // without the exact token it last handed out (optimistic locking).
      const current = await qboFetch(companyId, 'GET', `invoice/${qbInvoiceId}`);
      const syncToken = current?.Invoice?.SyncToken;
      await qboFetch(companyId, 'POST', 'invoice', {
        Id: qbInvoiceId,
        SyncToken: syncToken,
        sparse: true,
        CustomerRef: { value: qbCustomerId },
        Line: [{
          Amount: total,
          DetailType: 'SalesItemLineDetail',
          Description: job.name || 'JOBSpan Invoice',
          SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: total }
        }]
      });
    } else {
      const created = await qboFetch(companyId, 'POST', 'invoice', {
        CustomerRef: { value: qbCustomerId },
        DueDate: inv.dueDate || undefined,
        Line: [{
          Amount: total,
          DetailType: 'SalesItemLineDetail',
          Description: job.name || 'JOBSpan Invoice',
          SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: total }
        }]
      });
      qbInvoiceId = created?.Invoice?.Id;
      if (!qbInvoiceId) throw new Error('QuickBooks did not return an Invoice Id.');
      await invRef.update({ qbInvoiceId });
    }

    // 4. Payment - only the un-recorded delta, so re-pushing the same
    // invoice after a partial payment never double-counts.
    const amtPaid = inv.amtPaid || 0;
    const lastSynced = inv.qbLastSyncedAmtPaid || 0;
    if (amtPaid > lastSynced) {
      const deltaAmt = amtPaid - lastSynced;
      const createdPayment = await qboFetch(companyId, 'POST', 'payment', {
        CustomerRef: { value: qbCustomerId },
        TotalAmt: deltaAmt,
        Line: [{ Amount: deltaAmt, LinkedTxn: [{ TxnId: qbInvoiceId, TxnType: 'Invoice' }] }]
      });
      const qbPaymentId = createdPayment?.Payment?.Id;
      await invRef.update({
        qbLastSyncedAmtPaid: amtPaid,
        qbPaymentIds: admin.firestore.FieldValue.arrayUnion(qbPaymentId)
      });
    }

    return { success: true, qbInvoiceId };
  } catch (e) {
    console.error('qbCreateInvoice failed:', e.message);
    throw new functions.https.HttpsError('internal', e.message);
  }
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
