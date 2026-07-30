import fs from 'fs';
import path from 'path';

// Read the backup file
const backupPath = path.join(__dirname, '../src/data/jimwas-backup-2026-06-30.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

// Generate deterministic UUID from numeric ID using a namespace
function generateProductUUID(id: number): string {
  // Use a fixed namespace UUID for Jimwas products
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace
  const name = `jimwas-product-${id}`;

  // Simple UUID v5-like generation (deterministic)
  const hash = createHash(name + namespace);
  return formatUUID(hash);
}

function createHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // Make it positive and pad
  const hex = Math.abs(hash).toString(16).padStart(32, '0');
  return hex.slice(0, 32);
}

function formatUUID(hex: string): string {
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

// Track seen SKUs to handle duplicates
const seenSkus = new Map<string, number>();

// Generate SQL
const products = backup.products.filter((p: any) => !p.archived);
console.log(`Found ${products.length} active products`);

// Split into batches
const batchSize = 50;
const batches: string[] = [];

for (let i = 0; i < products.length; i += batchSize) {
  const batch = products.slice(i, i + batchSize);
  const values = batch.map((p: any) => {
    let sku = p.sku?.trim() || `SKU-${p.id}`;

    // Handle duplicate SKUs
    if (seenSkus.has(sku)) {
      const count = seenSkus.get(sku)! + 1;
      seenSkus.set(sku, count);
      sku = `${sku}-${count}`;
    } else {
      seenSkus.set(sku, 1);
    }

    const uuid = generateProductUUID(p.id);
    const name = p.name?.replace(/'/g, "''") || 'Unknown';
    const price = Number(p.price) || 0;
    const cost = Number(p.cost) || 0;
    const stock = Number(p.stock) || 0;
    const category = p.category?.replace(/'/g, "''") || null;
    const lowStockAlert = Number(p.lowStockAlert) || 5;
    const taxCategory = p.taxCategory || 'standard_16';

    return `('${uuid}', '${name}', '${sku}', ${price}, ${cost}, ${stock}, ${category ? `'${category}'` : 'NULL'}, NULL, ${lowStockAlert}, '${taxCategory}', true, 'synced', NOW(), NOW())`;
  });

  const sql = `INSERT INTO products (id, name, sku, price, cost, stock, category, barcode, low_stock_alert, tax_category, is_active, sync_status, created_at, updated_at)
VALUES
${values.join(',\n')}
ON CONFLICT (id) DO NOTHING;`;

  batches.push(sql);
}

// Write batches to files
const outputDir = path.join(__dirname, '../supabase/seed');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

batches.forEach((sql, index) => {
  const filename = path.join(outputDir, `batch_${index}.sql`);
  fs.writeFileSync(filename, sql);
  console.log(`Written ${filename}`);
});

console.log(`Generated ${batches.length} batch files`);
