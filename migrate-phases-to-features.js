// ═══════════════════════════════════════════════════════════════════════
// JobSpan Schedule Redesign — Phases → Features migration
// Added: 06/Jul/2026 · NOT wired into app boot. Run manually from the
// browser console after loading JobSpan, once you've confirmed you're Owner.
//
// Per the locked design doc:
//   - Only jobs with status in ['Work In Progress','Approved','Scheduled']
//     are migrated. Everything else is left untouched.
//   - SHELL migration only: each phases doc becomes an EMPTY-TASK Feature
//     under a single default Epic ("Job Scope") per job. No Tasks are
//     auto-generated from estimate items (rejected in design — see doc).
//   - Preserved fields: name→Feature name, status, startDate, endDate,
//     estHours (as Feature-level metadata), assigned, trade.
//   - The old `phases` collection is LEFT IN PLACE, untouched, dormant.
//     This script only ADDS a new estimateGroups/subgroups tree — it never
//     deletes or modifies phases.
//
// USAGE (run in browser console while logged in as Owner):
//   1. DRY RUN FIRST — always. Shows exactly what would happen, writes nothing:
//        migratePhasesToFeatures({ dryRun: true }).then(r => console.table(r.jobs))
//   2. Review the output carefully. Confirm the job list and phase counts
//      match what you expect.
//   3. REAL RUN — only after reviewing the dry run:
//        migratePhasesToFeatures({ dryRun: false }).then(r => console.table(r.jobs))
//
// SAFE TO RE-RUN: if a job already has a "Job Scope" default Epic (from a
// prior run), this script skips re-migrating that job rather than
// duplicating Features. Each job is migrated at most once.
// ═══════════════════════════════════════════════════════════════════════

const MIGRATION_QUALIFYING_STATUSES = ['Work In Progress', 'Approved', 'Scheduled'];
const MIGRATION_DEFAULT_EPIC_NAME = 'Job Scope';

/**
 * Run the phases -> Features shell migration.
 * @param {object} opts
 * @param {boolean} opts.dryRun - if true (default), makes no writes; just
 *   reports what it would do. ALWAYS run with dryRun:true first.
 * @returns {Promise<{jobs: Array, totalJobsMigrated: number, totalPhasesConverted: number}>}
 */
async function migratePhasesToFeatures(opts) {
  const dryRun = !opts || opts.dryRun !== false; // default true — safest default
  if (!isOwnerOrAdmin()) {
    throw new Error('Only Owner/PM can run this migration.');
  }
  if (!currentCompanyId) {
    throw new Error('No company loaded — cannot resolve job collection.');
  }

  console.log(dryRun
    ? '🔍 DRY RUN — no data will be written.'
    : '⚠️ LIVE RUN — this will write new data. Old phases are left untouched.');

  const jobsSnap = await coll('jobs').get();
  const report = [];
  let totalJobsMigrated = 0;
  let totalPhasesConverted = 0;

  for (const jobDoc of jobsSnap.docs) {
    const job = jobDoc.data();
    const jobId = jobDoc.id;
    const status = job.status;

    if (MIGRATION_QUALIFYING_STATUSES.indexOf(status) === -1) {
      report.push({ jobId, jobNum: job.jobNum || jobId, status, action: 'skipped (status not eligible)' });
      continue;
    }

    // Check if this job already has the default Epic (idempotency guard)
    const existingEpics = await coll('jobs').doc(jobId).collection('estimateGroups')
      .where('name', '==', MIGRATION_DEFAULT_EPIC_NAME)
      .limit(1).get();

    if (!existingEpics.empty) {
      report.push({ jobId, jobNum: job.jobNum || jobId, status, action: 'skipped (already migrated)' });
      continue;
    }

    const phasesSnap = await coll('jobs').doc(jobId).collection('phases').orderBy('order').get();
    if (phasesSnap.empty) {
      report.push({ jobId, jobNum: job.jobNum || jobId, status, action: 'skipped (no phases to migrate)' });
      continue;
    }

    if (dryRun) {
      report.push({
        jobId, jobNum: job.jobNum || jobId, status,
        action: `WOULD migrate ${phasesSnap.size} phase(s) into "${MIGRATION_DEFAULT_EPIC_NAME}" Epic`,
        phaseNames: phasesSnap.docs.map(p => p.data().name).join(', '),
      });
      totalPhasesConverted += phasesSnap.size;
      totalJobsMigrated++;
      continue;
    }

    // ── LIVE RUN: create the default Epic, then one Feature per phase ──
    const epicRef = await coll('jobs').doc(jobId).collection('estimateGroups').add({
      name: MIGRATION_DEFAULT_EPIC_NAME,
      order: 9999, // place after any existing estimate groups
      sprintEnabled: false,
      migratedFromPhases: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    let featureOrder = 0;
    for (const phaseDoc of phasesSnap.docs) {
      const p = phaseDoc.data();
      await coll('jobs').doc(jobId).collection('estimateGroups').doc(epicRef.id)
        .collection('subgroups').add({
          name: p.name,
          order: featureOrder++,
          status: p.status || 'not-started',
          sprintId: null,
          dependsOn: [],
          assignedTeamLead: p.assigned || null,
          requestedStatus: null,
          // Preserved phase metadata, per locked design:
          startDate: p.startDate || null,
          endDate: p.endDate || null,
          estHours: p.estHours || 0,
          trade: p.trade || null,
          migratedFromPhaseId: phaseDoc.id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      // NOTE: zero Tasks (items) created — shell migration per locked design.
      // Team Leads add real Tasks by hand.
    }

    report.push({
      jobId, jobNum: job.jobNum || jobId, status,
      action: `migrated ${phasesSnap.size} phase(s) into "${MIGRATION_DEFAULT_EPIC_NAME}" Epic (${epicRef.id})`,
    });
    totalPhasesConverted += phasesSnap.size;
    totalJobsMigrated++;
  }

  console.log(dryRun ? '🔍 DRY RUN complete.' : '✅ LIVE RUN complete.');
  console.log(`Jobs migrated: ${totalJobsMigrated} · Phases converted: ${totalPhasesConverted}`);
  return { jobs: report, totalJobsMigrated, totalPhasesConverted };
}
window.migratePhasesToFeatures = migratePhasesToFeatures;
