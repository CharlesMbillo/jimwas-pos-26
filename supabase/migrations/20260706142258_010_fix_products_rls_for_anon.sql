-- Fix products RLS policies to allow anon access for sync

DROP POLICY IF EXISTS insert_products_authenticated ON products;
DROP POLICY IF EXISTS update_products_authenticated ON products;
DROP POLICY IF EXISTS delete_products_authenticated ON products;

CREATE POLICY "insert_products_public" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_products_public" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_products_public" ON products FOR DELETE
  TO anon, authenticated USING (true);