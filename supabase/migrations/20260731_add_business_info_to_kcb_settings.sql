-- Add business information to KCB settings
-- Required for KCB M-Pesa Express compliance

ALTER TABLE kcb_settings ADD COLUMN IF NOT EXISTS business_paybill TEXT;
ALTER TABLE kcb_settings ADD COLUMN IF NOT EXISTS business_account TEXT;
ALTER TABLE kcb_settings ADD COLUMN IF NOT EXISTS business_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN kcb_settings.business_paybill IS 'M-Pesa Paybill number (e.g., 522522)';
COMMENT ON COLUMN kcb_settings.business_account IS 'M-Pesa Account/Reference number (e.g., 7941675)';
COMMENT ON COLUMN kcb_settings.business_name IS 'Business name for M-Pesa transactions (e.g., JIMWASENTERPRISES)';

-- Update business information for Jimwas Enterprises
UPDATE kcb_settings 
SET 
  business_paybill = '522522',
  business_account = '7941675',
  business_name = 'JIMWASENTERPRISES'
WHERE id = 'kcb-settings';
