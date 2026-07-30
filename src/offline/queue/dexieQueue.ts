import Dexie from 'dexie';
import type { QueueItem } from '../../payments/orchestrator/types';

export class DexieQueueDB extends Dexie {
  queue: Dexie.Table<QueueItem, string>;

  constructor(dbName = 'jimwas_offline') {
    super(dbName);
    this.version(1).stores({
      queue: 'id, paymentId, status, nextAttemptAt, createdAt',
    });
    this.queue = this.table('queue');
  }

  async enqueue(item: QueueItem) {
    await this.queue.put(item);
  }

  async getPending(limit = 10) {
    const now = new Date().toISOString();
    return this.queue.where('status').equals('PENDING').and((q) => !q.nextAttemptAt || q.nextAttemptAt <= now).limit(limit).toArray();
  }

  async markProcessing(id: string) {
    return this.queue.update(id, { status: 'PROCESSING', updatedAt: new Date().toISOString() });
  }

  async updateItem(id: string, patch: Partial<QueueItem>) {
    patch.updatedAt = new Date().toISOString();
    return this.queue.update(id, patch as any);
  }
}
