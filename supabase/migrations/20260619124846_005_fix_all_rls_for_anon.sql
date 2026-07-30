-- Fix RLS policies for all tables to allow anon read access
-- This is needed because the POS uses the anon key for initial sync

-- Customers
DROP POLICY IF EXISTS select_customers ON customers;
CREATE POLICY "select_customers_public" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS insert_customers ON customers;
CREATE POLICY "insert_customers_public" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS update_customers ON customers;
CREATE POLICY "update_customers_public" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Transactions
DROP POLICY IF EXISTS select_transactions ON transactions;
CREATE POLICY "select_transactions_public" ON transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS insert_transactions ON transactions;
CREATE POLICY "insert_transactions_public" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS update_transactions ON transactions;
CREATE POLICY "update_transactions_public" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Transaction items
DROP POLICY IF EXISTS select_transaction_items ON transaction_items;
CREATE POLICY "select_transaction_items_public" ON transaction_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS insert_transaction_items ON transaction_items;
CREATE POLICY "insert_transaction_items_public" ON transaction_items FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Installment plans
DROP POLICY IF EXISTS select_installment_plans ON installment_plans;
CREATE POLICY "select_installment_plans_public" ON installment_plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS insert_installment_plans ON installment_plans;
CREATE POLICY "insert_installment_plans_public" ON installment_plans FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS update_installment_plans ON installment_plans;
CREATE POLICY "update_installment_plans_public" ON installment_plans FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Installment payments
DROP POLICY IF EXISTS select_installment_payments ON installment_payments;
CREATE POLICY "select_installment_payments_public" ON installment_payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS insert_installment_payments ON installment_payments;
CREATE POLICY "insert_installment_payments_public" ON installment_payments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Loyalty transactions
DROP POLICY IF EXISTS select_loyalty_transactions ON loyalty_transactions;
CREATE POLICY "select_loyalty_transactions_public" ON loyalty_transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS insert_loyalty_transactions ON loyalty_transactions;
CREATE POLICY "insert_loyalty_transactions_public" ON loyalty_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Stock movements (immutable - insert only)
DROP POLICY IF EXISTS insert_stock_movements ON stock_movements;
CREATE POLICY "insert_stock_movements_public" ON stock_movements FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Suppliers
DROP POLICY IF EXISTS select_suppliers ON suppliers;
CREATE POLICY "select_suppliers_public" ON suppliers FOR SELECT TO anon, authenticated USING (true);

-- Deliveries
DROP POLICY IF EXISTS select_deliveries ON deliveries;
CREATE POLICY "select_deliveries_public" ON deliveries FOR SELECT TO anon, authenticated USING (true);

-- Delivery items
DROP POLICY IF EXISTS select_delivery_items ON delivery_items;
CREATE POLICY "select_delivery_items_public" ON delivery_items FOR SELECT TO anon, authenticated USING (true);

-- Stock adjustments
DROP POLICY IF EXISTS select_stock_adjustments ON stock_adjustments;
CREATE POLICY "select_stock_adjustments_public" ON stock_adjustments FOR SELECT TO anon, authenticated USING (true);