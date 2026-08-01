import { PaymentRepository } from '../repositories/PaymentRepository';
import { PaymentProvider } from './provider';
import { PaymentIntent, QueueItem } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * PaymentOrchestrator
 * - creates local payments
 * - enqueues job in Dexie (client) or server queue
 * - selects provider, performs provider calls with retries/fallbacks
 * - updates payments via PaymentRepository
 */
export class PaymentOrchestrator {
  private providers: Map<string, PaymentProvider>;
  private repo: PaymentRepository;
  private defaultProvider: string;
  private maxAttempts = 3;
  private backoffMs = 2000;

  constructor(opts: {
    repo: PaymentRepository;
    providers: PaymentProvider[];
    defaultProvider: string;
    maxAttempts?: number;
    backoffMs?: number;
  }) {
    this.repo = opts.repo;
    this.providers = new Map(opts.providers.map((p) => [p.name, p]));
    this.defaultProvider = opts.defaultProvider;
    if (opts.maxAttempts) this.maxAttempts = opts.maxAttempts;
    if (opts.backoffMs) this.backoffMs = opts.backoffMs;
  }

  // Creates a Payment (PENDING) locally and returns a QueueItem for client enqueueing
  async createAndEnqueue(intent: PaymentIntent) {
    // ensure idempotency key
    intent.idempotencyKey = intent.idempotencyKey ?? uuidv4();

    const payment = await this.repo.createFromInitiation({
      provider: intent.preferredProvider ?? this.defaultProvider,
      merchantRequestId: intent.merchantRequestId,
      checkoutRequestId: undefined,
      providerTransactionId: undefined,
      phoneNumber: intent.phoneNumber,
      amount: intent.amount,
      invoiceNumber: intent.invoiceNumber,
      status: 'PENDING',
      raw: intent.metadata ?? null,
    });

    const queueItem: QueueItem = {
      id: uuidv4(),
      paymentId: payment.id,
      intent,
      attempts: 0,
      status: 'PENDING',
      nextAttemptAt: null,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Return queueItem for client-side Dexie enqueue or server queue insertion
    return { payment, queueItem };
  }

  // Process a queue item (called by background worker)
  async processQueueItem(item: QueueItem) {
    item.status = 'PROCESSING';
    item.attempts = item.attempts + 1;
    item.updatedAt = new Date().toISOString();

    const providerName = item.intent.preferredProvider ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      item.status = 'FAILED';
      item.lastError = `No provider named ${providerName}`;
      return item;
    }

    try {
      const resp = await provider.initiate(item.intent, { timeoutMs: 30_000 });

      // Map provider response -> update Payment in DB
      const updates: any = {
        status: resp.status ?? (resp.success ? 'SUCCESS' : 'FAILED'),
        providerTransactionId: resp.providerTransactionId,
        receiptNumber: resp.receiptNumber,
        callbackPayload: resp.raw ?? null,
        merchantRequestId: resp.merchantRequestId ?? item.intent.merchantRequestId ?? null,
      };

      // Use merchantRequestId when available; repo.updateFromCallback looks up by merchantRequestId
      await this.repo.updateFromCallback(updates.merchantRequestId ?? item.paymentId ?? '', updates);

      item.status = resp.success ? 'SUCCEEDED' : 'FAILED';
      item.updatedAt = new Date().toISOString();
      return item;
    } catch (err: any) {
      item.lastError = err?.message ?? String(err);
      item.updatedAt = new Date().toISOString();

      if (item.attempts >= this.maxAttempts) {
        item.status = 'FAILED';
        return item;
      }

      // schedule retry with exponential backoff
      const backoff = this.backoffMs * Math.pow(2, item.attempts - 1);
      item.nextAttemptAt = new Date(Date.now() + backoff).toISOString();
      item.status = 'PENDING';
      return item;
    }
  }


}
