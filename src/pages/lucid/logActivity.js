// src/lib/logActivity.js
import { db } from './AuthContext';

export async function logActivity(severity, actor, detail) {
  try {
    await db.entities.ActivityLog.create({ severity, actor, detail });
  } catch (e) {
    // best-effort — logging should never break user flows
  }
}