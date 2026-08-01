import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, beforeEach, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import axe from 'axe-core';

expect.extend({ toHaveNoViolations } as any);

// Mock Toast and AuthContext and createApprovalRequest
vi.mock('../src/lib/approvals', () => ({
  createApprovalRequest: vi.fn(async () => ({ success: true })),
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../src/components/Toast', () => ({
  useToast: () => ({ show: () => {} }),
}));

import { VoidTransactionModal } from '../src/components/VoidTransactionModal';

const transaction = {
  id: 'tx-1',
  total_amount: 1234,
  payment_method: 'mpesa',
  created_at: new Date().toISOString(),
};

describe('VoidTransactionModal accessibility', () => {
  beforeEach(() => {
    // clear DOM
    document.body.innerHTML = '';
  });

  it('focuses textarea on open and traps focus, closes on Escape', async () => {
    const onClose = vi.fn();
    const onVoidComplete = vi.fn();

    render(
      <div>
        <button>Open</button>
        <VoidTransactionModal transaction={transaction as any} isOpen={true} onClose={onClose} onVoidComplete={onVoidComplete} />
      </div>
    );

    const textarea = await screen.findByPlaceholderText('Explain why this transaction is being voided...');

    await waitFor(() => {
      expect(document.activeElement).toBe(textarea);
    });

    // Tab should cycle inside modal; get focusable elements
    const closeButton = screen.getByLabelText('Close void modal');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const submit = screen.getByRole('button', { name: 'Submit Void Request' });

    // Simulate tabbing forward
    await userEvent.tab(); // from textarea -> next
    expect(document.activeElement === cancel || document.activeElement === submit || document.activeElement === closeButton).toBe(true);

    // Press Escape
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('has no detectable accessibility violations (basic axe run)', async () => {
    const { container } = render(
      <VoidTransactionModal transaction={transaction as any} isOpen={true} onClose={() => {}} onVoidComplete={() => {}} />
    );

    // run axe-core programmatically
    const results = await (axe as any).run(container);
    expect(results.violations.length).toBe(0);
  });
});
