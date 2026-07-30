import { restoreFromBackup, type BackupData } from './db';

export async function populateDatabase() {
  try {
    const response = await fetch('/data/jimwas-backup-2026-07-14.json');
    if (!response.ok) {
      throw new Error(`Failed to load backup: ${response.statusText}`);
    }
    const backup = (await response.json()) as BackupData;
    const result = await restoreFromBackup(backup);
    return result;
  } catch (error) {
    throw error;
  }
}
