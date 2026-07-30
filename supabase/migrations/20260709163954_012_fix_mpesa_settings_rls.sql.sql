-- Fix M-Pesa settings RLS policies with explicit CRUD policies
-- The FOR ALL policy wasn't properly setting WITH CHECK for INSERT/UPDATE

-- Drop the problematic FOR ALL policy
DROP POLICY IF EXISTS "mpesa_settings_all" ON mpesa_settings;

-- Create explicit policies for each operation
CREATE POLICY "select_mpesa_settings" ON mpesa_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_mpesa_settings" ON mpesa_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_mpesa_settings" ON mpesa_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_mpesa_settings" ON mpesa_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Also fix business_settings with explicit policies
DROP POLICY IF EXISTS "business_settings_all" ON business_settings;

CREATE POLICY "select_business_settings" ON business_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_business_settings" ON business_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_business_settings" ON business_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_business_settings" ON business_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Fix payment_methods with explicit policies
DROP POLICY IF EXISTS "payment_methods_all" ON payment_methods;

CREATE POLICY "select_payment_methods" ON payment_methods FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_payment_methods" ON payment_methods FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_payment_methods" ON payment_methods FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_payment_methods" ON payment_methods FOR DELETE
  TO anon, authenticated USING (true);

-- Fix loyalty_settings with explicit policies
DROP POLICY IF EXISTS "loyalty_settings_all" ON loyalty_settings;

CREATE POLICY "select_loyalty_settings" ON loyalty_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_loyalty_settings" ON loyalty_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_loyalty_settings" ON loyalty_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_loyalty_settings" ON loyalty_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Fix receipt_settings with explicit policies
DROP POLICY IF EXISTS "receipt_settings_all" ON receipt_settings;

CREATE POLICY "select_receipt_settings" ON receipt_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_receipt_settings" ON receipt_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_receipt_settings" ON receipt_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_receipt_settings" ON receipt_settings FOR DELETE
  TO anon, authenticated USING (true);