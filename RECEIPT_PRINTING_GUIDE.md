# Receipt Printing Feature Guide

## Overview
The jimwas-pos-26 POS system now includes comprehensive receipt printing capabilities with:
- **Automatic printing** after successful transactions
- **Receipt history** for reprinting previous receipts
- **Print preview** functionality
- **Customizable receipt layouts** (80mm and 58mm thermal printers)
- **Customer & payment information** tracking

## Features

### 1. Automatic Receipt Printing
When a transaction completes successfully:
- Receipt automatically prints to the default printer
- Receipt is saved to local history for later reprinting
- Works with all payment methods: Cash, Card, KCB BUNI STK Push
- Includes customer details, items, totals, and payment method

### 2. Receipt History Panel
Access the Receipt History from the POS terminal:
- Click the **History** button in the toolbar
- View all receipts from the current session
- Reprint any previous receipt with one click
- Receipts stored locally (up to 100 most recent)

### 3. Reprint After Completion
After a successful payment:
- Click the **Reprint Receipt** button in the success confirmation
- Quickly reprint if the first print failed or you need multiple copies

### 4. Receipt Customization
Configure receipt settings in the POS Settings:
- **Paper width**: 80mm (standard) or 58mm (smaller thermal printers)
- **Receipt header**: Custom business branding text
- **Receipt footer**: Custom thank you message
- **Show customer info**: Toggle display of customer name and phone
- **Receipt number format**: Customizable receipt ID

## Implementation Details

### Core Functions

#### `printReceipt(options: PrintOptions)`
Main printing function using browser's print dialog
```typescript
printReceipt({
  business: BusinessSettings,
  receipt: ReceiptSettings,
  transaction: PrintTransaction
});
```

#### `previewReceipt(options: PrintOptions)`
Opens receipt in new window for preview before printing
```typescript
previewReceipt({
  business: BusinessSettings,
  receipt: ReceiptSettings,
  transaction: PrintTransaction
});
```

#### `saveReceiptToHistory(transaction: PrintTransaction)`
Saves receipt to localStorage for later reprinting
```typescript
saveReceiptToHistory({
  id: 'RCP-001',
  items: [...],
  total_amount: 1000,
  // ... other receipt data
});
```

#### `getReceiptHistory()`
Retrieves all saved receipts from localStorage
```typescript
const history = getReceiptHistory();
// Returns: PrintTransaction[]
```

#### `clearReceiptHistory()`
Clears all stored receipts
```typescript
clearReceiptHistory();
```

### Receipt Data Structure

```typescript
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
  payment_method: string;  // 'cash' | 'card' | 'kcb'
  created_at: string;      // ISO timestamp
  customer_name?: string;
  customer_phone?: string;
  cashier_name?: string;
  mpesa_receipt?: string;  // KCB BUNI receipt number
}
```

## Workflow Integration

### At Point of Sale
1. Customer selects items → Add to cart
2. Choose payment method (Cash/Card/KCB)
3. Complete payment
4. ✅ **Receipt automatically prints**
5. Receipt saved to history automatically

### Reprint Scenarios

#### Scenario 1: Immediate Reprint
- Print failed or customer wants second copy
- Click **Reprint Receipt** button in success dialog
- Receipt prints immediately

#### Scenario 2: Later Reprint
- Customer returns needing duplicate receipt
- Click **History** button in POS toolbar
- Find receipt by date/customer/amount
- Click **Reprint** to send to printer

#### Scenario 3: Preview Before Print
- Use `previewReceipt()` API to open in browser
- Verify content looks correct
- Print from preview window

## Hardware Support

### Thermal Printers (Recommended)
- **58mm & 80mm** widths supported
- Connect via USB or Network
- No special drivers needed (uses browser print)
- Automatic paper cutting on most models

### Inkjet/Laser Printers
- Works with standard A4 paper
- Receipts print as single tickets
- Good for backup/secondary printing

### Print to File
- Select "Print to PDF" to save digital copies
- Good for email receipts or archives

## Settings Configuration

### In POS Settings → Receipt Settings

```
Paper Width: 80mm (or 58mm for smaller printers)
Receipt Header: "Welcome to [Business Name]"
Receipt Footer: "Thank you for your business!"
Show Customer Name: Enabled
Show Customer Phone: Enabled
Show Items: Enabled
Show Cashier Name: Enabled
```

## API Integration

### Supabase Triggers
When a payment completes via IPN:
1. Payment record created in `payments` table
2. **Trigger 1** → Creates invoice record
3. **Trigger 2** → Deducts from inventory
4. **Trigger 3** → Sends alert webhook if low stock

### After Triggers Complete
- POS receives confirmation
- Receipt data prepared with all details
- Receipt automatically prints
- Receipt saved to history

## Troubleshooting

### Receipt Won't Print
**Cause**: No printer configured or permission denied

**Solution**:
1. Check browser print permissions
2. Set default printer in OS settings
3. Try print preview first
4. Check printer is online and has paper

### Receipt History Not Showing
**Cause**: localStorage cleared or disabled

**Solution**:
1. Check browser privacy settings
2. Ensure cookies/storage enabled
3. Manual reprint from last transaction ID

### Formatting Issues
**Cause**: Wrong paper width selected

**Solution**:
1. Go to POS Settings
2. Change paper width to match printer (58mm or 80mm)
3. Reprint receipt

### Missing Customer Info
**Cause**: Receipt settings have customer display disabled

**Solution**:
1. Go to POS Settings → Receipt Settings
2. Enable "Show Customer Name" and "Show Customer Phone"
3. Reprint previous receipt or complete new sale

## Best Practices

### For Business Owners
- ✅ Test print settings with sample receipt
- ✅ Set professional header/footer text
- ✅ Enable customer information for loyalty tracking
- ✅ Regularly backup receipt history (export to CSV)
- ✅ Configure correct paper width for your printer

### For Cashiers
- ✅ Check printer paper level daily
- ✅ Verify each receipt prints clearly
- ✅ Use Reprint button if first copy fails
- ✅ Keep backup of important receipts
- ✅ Report printer issues immediately

### For Troubleshooting
- ✅ Verify printer is default in OS
- ✅ Test with Preview first before reprinting
- ✅ Check localStorage not disabled
- ✅ Confirm receipt settings saved
- ✅ Try different paper width if formatting off

## Future Enhancements

Potential improvements to receipt printing:
- Email receipts to customer email
- SMS receipt to customer phone
- QR codes for receipt lookup
- Receipt templates per sale type
- Multi-receipt printing (for carbon forms)
- Scheduled receipt reports
- Receipt archive to cloud storage

## Technical Stack

- **Frontend**: React + TypeScript
- **Storage**: Browser localStorage (receipts)
- **Printing**: Native browser print API
- **Backend**: Supabase (transaction data)
- **Database**: Supabase PostgreSQL (receipts table)

## Support

For issues or questions about receipt printing:
1. Check this guide first
2. Review POS Settings configuration
3. Test with preview before reprinting
4. Check browser console for errors
5. Contact admin support with error details

---

**Last Updated**: 2026-08-01
**Version**: 1.0
**Status**: Production Ready
