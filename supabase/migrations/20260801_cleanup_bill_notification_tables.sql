-- Drop bill validation and notification tables (no longer used)
-- These were part of the IPN notification flow which has been removed

-- Drop bill_validations table if it exists
DROP TABLE IF EXISTS bill_validations CASCADE;

-- Drop kcb_notifications table if it exists
DROP TABLE IF EXISTS kcb_notifications CASCADE;

-- Ensure all related functions and triggers are cleaned up
DROP FUNCTION IF EXISTS handle_bill_validation() CASCADE;
DROP FUNCTION IF EXISTS handle_notification() CASCADE;
