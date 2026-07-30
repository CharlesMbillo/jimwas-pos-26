import { BusinessSettings, ReceiptSettings } from './settings-types';

interface PrintTransaction {
  id: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  total_amount: number;
  amount_paid: number;
  change_amount: number;
  payment_method: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  cashier_name?: string;
  mpesa_receipt?: string;
}

interface PrintOptions {
  business: BusinessSettings;
  receipt: ReceiptSettings;
  transaction: PrintTransaction;
}

function buildReceiptHtml(options: PrintOptions): string {
  const { business, receipt, transaction } = options;
  const paperWidth = receipt.paper_width === '80mm' ? 80 : 58;
  const charsPerLine = paperWidth === '80mm' ? 48 : 32;
  const fontSize = paperWidth === '80mm' ? '12px' : '10px';

  const formatLine = (left: string, right?: string): string => {
    if (!right) return left.padEnd(charsPerLine);
    const leftStr = left.substring(0, Math.floor(charsPerLine * 0.6));
    const rightStr = right.substring(0, Math.floor(charsPerLine * 0.4));
    const spaces = Math.max(1, charsPerLine - leftStr.length - rightStr.length);
    return leftStr + ' '.repeat(spaces) + rightStr;
  };

  const divider = '-'.repeat(charsPerLine);
  const doubleDivider = '='.repeat(charsPerLine);
  const lines: string[] = [];

  if (business.business_name) {
    const name = business.business_name.toUpperCase();
    const pad = Math.max(0, Math.floor((charsPerLine - name.length) / 2));
    lines.push(' '.repeat(pad) + name);
  }
  if (business.business_address) lines.push(business.business_address);
  if (business.business_phone) lines.push(`Tel: ${business.business_phone}`);
  if (business.business_email) lines.push(`Email: ${business.business_email}`);
  if (receipt.receipt_header) {
    lines.push('');
    lines.push(receipt.receipt_header);
  }

  lines.push(doubleDivider);
  lines.push(formatLine('Receipt:', transaction.id));
  lines.push(formatLine('Date:', new Date(transaction.created_at).toLocaleString()));
  lines.push(formatLine('Cashier:', transaction.cashier_name || 'System'));

  if (receipt.show_customer_name && transaction.customer_name) {
    lines.push(formatLine('Customer:', transaction.customer_name));
  }
  if (receipt.show_customer_phone && transaction.customer_phone) {
    lines.push(formatLine('Phone:', transaction.customer_phone));
  }

  lines.push(divider);
  lines.push(formatLine('ITEM', 'TOTAL'));
  lines.push(divider);

  for (const item of transaction.items) {
    lines.push(item.product_name.substring(0, charsPerLine));
    lines.push(formatLine('  ' + `${item.quantity} x ${item.unit_price.toLocaleString()}`, item.subtotal.toLocaleString()));
  }

  lines.push(divider);
  lines.push(formatLine('TOTAL:', `KES ${transaction.total_amount.toLocaleString()}`));
  lines.push(formatLine('PAID:', `KES ${transaction.amount_paid.toLocaleString()}`));
  lines.push(formatLine('CHANGE:', `KES ${transaction.change_amount.toLocaleString()}`));
  lines.push(formatLine('Method:', transaction.payment_method.toUpperCase()));

  if (transaction.mpesa_receipt) {
    lines.push(formatLine('M-Pesa Ref:', transaction.mpesa_receipt));
  }

  lines.push(divider);

  if (receipt.receipt_footer) {
    lines.push('');
    lines.push(receipt.receipt_footer);
  }
  lines.push('');
  lines.push('Thank you for your business!');
  lines.push('');
  lines.push(doubleDivider);

  const text = lines.join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt - ${transaction.id}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      line-height: 1.4;
      margin: 0;
      padding: 8px;
      background: white;
      color: black;
    }
    pre {
      margin: 0;
      padding: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 4mm; size: ${receipt.paper_width} auto; }
    }
  </style>
</head>
<body>
  <pre>${text}</pre>
</body>
</html>`;
}

// Prints via a hidden iframe — no popup permission required
export function printReceipt(options: PrintOptions): void {
  const html = buildReceiptHtml(options);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for iframe content to fully load before printing
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Remove iframe after print dialog is handled
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  };
}

export function testPrint(business: BusinessSettings, receipt: ReceiptSettings): void {
  printReceipt({
    business,
    receipt,
    transaction: {
      id: 'TEST-' + Date.now().toString(36).toUpperCase(),
      items: [
        { product_name: 'Milk 500ml', quantity: 2, unit_price: 65, subtotal: 130 },
        { product_name: 'Bread', quantity: 1, unit_price: 55, subtotal: 55 },
        { product_name: 'Sugar 1kg', quantity: 1, unit_price: 180, subtotal: 180 },
      ],
      total_amount: 365,
      amount_paid: 400,
      change_amount: 35,
      payment_method: 'cash',
      created_at: new Date().toISOString(),
      customer_name: 'John Doe',
      customer_phone: '0712345678',
      cashier_name: 'Admin',
    },
  });
}
