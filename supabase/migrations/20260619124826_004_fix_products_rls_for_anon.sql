-- Drop existing restrictive policies
DROP POLICY IF EXISTS select_products ON products;
DROP POLICY IF EXISTS insert_products ON products;
DROP POLICY IF EXISTS update_products ON products;
DROP POLICY IF EXISTS delete_products ON products;

-- Products should be readable by anyone (anon) for POS to work
CREATE POLICY "select_products_public" ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only authenticated users can modify products
CREATE POLICY "insert_products_authenticated" ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "update_products_authenticated" ON products FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "delete_products_authenticated" ON products FOR DELETE
  TO authenticated
  USING (true);

-- Also fix stock_movements to allow anon reads
DROP POLICY IF EXISTS select_stock_movements ON stock_movements;
CREATE POLICY "select_stock_movements_public" ON stock_movements FOR SELECT
  TO anon, authenticated
  USING (true);