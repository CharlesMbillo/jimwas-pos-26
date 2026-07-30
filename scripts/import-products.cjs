const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/jimwas-backup-2026-06-15_(1).json', 'utf8'));

// Filter to non-archived products
const products = data.products.filter(p => !p.archived);

const escapeSingleQuote = (str) => {
  if (!str) return null;
  return str.replace(/'/g, "''");
};

const generateUUID = (legacyId) => {
  // Generate a deterministic UUID from legacy numeric ID
  const idStr = String(legacyId).padStart(12, '0');
  return `${idStr.slice(0, 8)}-${idStr.slice(8, 12)}-0000-0000-000000000000`;
};

// Generate INSERT statements in batches of 50
const batchSize = 50;
let sqlStatements = [];

for (let i = 0; i < products.length; i += batchSize) {
  const batch = products.slice(i, i + batchSize);
  const values = batch.map(p => {
    const id = generateUUID(p.id);
    const name = escapeSingleQuote(p.name) || '';
    const sku = escapeSingleQuote((p.sku || '').trim()) || null;
    const category = escapeSingleQuote(p.category) || null;
    const barcode = escapeSingleQuote(p.barcode) || null;

    return `('${id}', '${name}', ${sku ? `'${sku}'` : 'NULL'}, ${p.price}, ${p.cost || 0}, ${Math.max(0, p.stock || 0)}, ${category ? `'${category}'` : 'NULL'}, ${p.lowStockAlert || 5}, '${p.taxCategory || 'standard_16'}', ${barcode ? `'${barcode}'` : 'NULL'}, true, '${p.createdAt}', '${p.updatedAt}', 'synced')`;
  });

  sqlStatements.push(`INSERT INTO products (id, name, sku, price, cost, stock, category, low_stock_alert, tax_category, barcode, is_active, created_at, updated_at, sync_status) VALUES
${values.join(',\n')};`);
}

// Generate stock movements for initial inventory
const stockMovements = products.filter(p => (p.stock || 0) > 0).map(p => {
  const id = generateUUID(`sm-${p.id}`);
  const productId = generateUUID(p.id);
  const qty = Math.max(0, p.stock || 0);

  return `('${id}', '${productId}', ${qty}, 'initial', 'Imported from backup', ${qty}, 'initial', NULL, NULL, '${p.createdAt}', 'system', 'synced', NULL)`;
});

sqlStatements.push(`
-- Initial stock movements
INSERT INTO stock_movements (id, product_id, qty_delta, reason, note, balance_after, reference_type, reference_id, branch_id, created_at, created_by, sync_status, local_id) VALUES
${stockMovements.slice(0, 100).join(',\n')};`);

// Output all SQL
console.log(sqlStatements.join('\n\n'));
console.error(`Total products: ${products.length}`);
console.error(`Total stock movements: ${stockMovements.length}`);
