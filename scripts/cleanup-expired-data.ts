/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DormCare - Automated 365-Day Expired Data Cleanup Script
 * Runs safely in GitHub Actions or Node CLI using Firebase Admin SDK.
 * NEVER run or bundle this in client-side / browser code!
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin with Service Account from environment variable
function initAdminSDK(): Firestore {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT environment variable. Please set it in GitHub Repository Secrets.'
    );
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  initializeApp({
    credential: cert(serviceAccount),
  });

  return getFirestore();
}

const BATCH_SIZE = 350; // Firestore batch write limit is 500 ops; 350 is safe
const RETENTION_DAYS = 365;

interface CleanupReport {
  deletedWorkOrders: number;
  deletedEvents: number;
  deletedTransactions: number;
  skippedInvalidDate: number;
  errors: string[];
}

export async function runCleanup(dryRun = false): Promise<CleanupReport> {
  const db = initAdminSDK();
  const report: CleanupReport = {
    deletedWorkOrders: 0,
    deletedEvents: 0,
    deletedTransactions: 0,
    skippedInvalidDate: 0,
    errors: [],
  };

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[DormCare Cleanup] Starting cleanup at ${now.toISOString()}`);
  console.log(`[DormCare Cleanup] Cutoff threshold: ${cutoffDate.toISOString()} (${RETENTION_DAYS} days)`);
  if (dryRun) {
    console.log('[DormCare Cleanup] MODE: DRY-RUN (No documents will actually be deleted)');
  }

  // ---------------------------------------------------------
  // 1. CLEANUP EXPIRED WORK ORDERS & THEIR EVENTS SUBCOLLECTIONS
  // ---------------------------------------------------------
  console.log('[DormCare Cleanup] Scanning workOrders collection...');
  const workOrdersSnap = await db.collection('workOrders').get();

  let woBatch = db.batch();
  let woBatchCount = 0;

  for (const doc of workOrdersSnap.docs) {
    const data = doc.data();
    let createdAtDate: Date | null = null;

    if (data.createdAt) {
      if (typeof data.createdAt === 'string') {
        createdAtDate = new Date(data.createdAt);
      } else if (data.createdAt.toDate) {
        createdAtDate = data.createdAt.toDate();
      }
    }

    if (!createdAtDate || isNaN(createdAtDate.getTime())) {
      console.warn(`[DormCare Cleanup] Skipping doc ${doc.id}: Missing or invalid createdAt`);
      report.skippedInvalidDate++;
      continue;
    }

    // Check if expired (> 365 days)
    if (createdAtDate < cutoffDate) {
      console.log(`[DormCare Cleanup] Expired ticket found: ${doc.id} (Created: ${createdAtDate.toISOString()})`);

      // 1a. Delete subcollection 'events' first
      const eventsSnap = await doc.ref.collection('events').get();
      for (const eventDoc of eventsSnap.docs) {
        if (!dryRun) {
          woBatch.delete(eventDoc.ref);
        }
        report.deletedEvents++;
        woBatchCount++;

        if (woBatchCount >= BATCH_SIZE) {
          if (!dryRun) await woBatch.commit();
          woBatch = db.batch();
          woBatchCount = 0;
        }
      }

      // 1b. Delete parent workOrder document (embedded images deleted automatically)
      if (!dryRun) {
        woBatch.delete(doc.ref);
      }
      report.deletedWorkOrders++;
      woBatchCount++;

      if (woBatchCount >= BATCH_SIZE) {
        if (!dryRun) await woBatch.commit();
        woBatch = db.batch();
        woBatchCount = 0;
      }
    }
  }

  if (woBatchCount > 0 && !dryRun) {
    await woBatch.commit();
  }

  // ---------------------------------------------------------
  // 2. CLEANUP EXPIRED INVENTORY TRANSACTIONS
  // ---------------------------------------------------------
  console.log('[DormCare Cleanup] Scanning inventoryTransactions collection...');
  const txSnap = await db.collection('inventoryTransactions').get();

  let txBatch = db.batch();
  let txBatchCount = 0;

  for (const doc of txSnap.docs) {
    const data = doc.data();
    let createdAtDate: Date | null = null;

    if (data.createdAt) {
      if (typeof data.createdAt === 'string') {
        createdAtDate = new Date(data.createdAt);
      } else if (data.createdAt.toDate) {
        createdAtDate = data.createdAt.toDate();
      }
    }

    if (!createdAtDate || isNaN(createdAtDate.getTime())) {
      report.skippedInvalidDate++;
      continue;
    }

    if (createdAtDate < cutoffDate) {
      if (!dryRun) {
        txBatch.delete(doc.ref);
      }
      report.deletedTransactions++;
      txBatchCount++;

      if (txBatchCount >= BATCH_SIZE) {
        if (!dryRun) await txBatch.commit();
        txBatch = db.batch();
        txBatchCount = 0;
      }
    }
  }

  if (txBatchCount > 0 && !dryRun) {
    await txBatch.commit();
  }

  console.log('================ CLEANUP SUMMARY ================');
  console.log(`Deleted Work Orders:        ${report.deletedWorkOrders}`);
  console.log(`Deleted Subcollection Events: ${report.deletedEvents}`);
  console.log(`Deleted Inventory TXs:      ${report.deletedTransactions}`);
  console.log(`Skipped (Invalid/No Date):  ${report.skippedInvalidDate}`);
  console.log('Master data (Users, Properties, Items) untouched.');
  console.log('=================================================');

  return report;
}

// CLI entry point
const isDryRun = process.argv.includes('--dry-run');
runCleanup(isDryRun)
  .then(() => {
    console.log('[DormCare Cleanup] Completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[DormCare Cleanup] Fatal error during cleanup:', err);
    process.exit(1);
  });
