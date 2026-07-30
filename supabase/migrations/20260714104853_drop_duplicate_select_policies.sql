/*
# Drop Duplicate SELECT Policies

Cleans up leftover SELECT policies from the previous migration that
were not dropped because they had different names than the new ones.
These duplicates are harmless but unnecessary — removing them keeps
the policy surface clean and auditable.

Tables affected:
- deliveries: drop select_deliveries_public (replaced by select_deliveries)
- delivery_items: drop select_delivery_items_public
- installment_payments: drop select_installment_payments_public
- installment_plans: drop select_installment_plans_public
- loyalty_transactions: drop select_loyalty_transactions_public
*/

DROP POLICY IF EXISTS "select_deliveries_public" ON deliveries;
DROP POLICY IF EXISTS "select_delivery_items_public" ON delivery_items;
DROP POLICY IF EXISTS "select_installment_payments_public" ON installment_payments;
DROP POLICY IF EXISTS "select_installment_plans_public" ON installment_plans;
DROP POLICY IF EXISTS "select_loyalty_transactions_public" ON loyalty_transactions;
