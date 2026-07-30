-- Add sale type fields to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'standard' CHECK (sale_type IN ('standard', 'wholesale', 'lipa_mdogo', 'kyama'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(12,2) DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN transactions.sale_type IS 'Type of sale: standard (full payment at checkout), wholesale (bulk orders), lipa_mdogo (goods collected after full payment), kyama (agreed deposit with later checkout)';
COMMENT ON COLUMN transactions.deposit_amount IS 'For lipa_mdogo and kyama sales: the deposit/initial payment made';
COMMENT ON COLUMN transactions.balance_amount IS 'For lipa_mdogo and kyama sales: the remaining balance to be paid';
