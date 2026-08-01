import { restoreFromBackup, type BackupData } from './db';

export async function populateDatabase() {
  try {
    const response = await fetch('/data/jimwas-backup-sample.json');
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? 'Sample backup file not found'
          : `Failed to load backup: ${response.statusText}`
      );
    }

    // Validate response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid response format. Expected JSON.');
    }

    const backup = (await response.json()) as BackupData;

    // Validate backup structure
    if (!backup.data) {
      throw new Error('Invalid backup format: missing data field');
    }

    const result = await restoreFromBackup(backup);
    return result;
  } catch (error) {
    throw error;
  }
}
