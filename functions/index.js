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
