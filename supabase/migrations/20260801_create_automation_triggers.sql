-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA public;

-- Create IPN notifications table for audit trail
CREATE TABLE IF NOT EXISTS public.ipn_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_request_id TEXT NOT NULL UNIQUE,
  checkout_request_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  response_code TEXT,
  response_description TEXT,
  mpesa_receipt_number TEXT,
  raw_payload JSONB,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS ipn_notifications_merchant_request_id_idx 
  ON public.ipn_notifications(merchant_request_id);

-- TRIGGER 1: Payment → Invoice Update
-- When payment is marked as SUCCESS, update the corresponding invoice
CREATE OR REPLACE FUNCTION public.trigger_payment_to_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUCCESS' AND OLD.status != 'SUCCESS' THEN
    -- Update invoice to mark as paid
    UPDATE public.invoices
    SET 
      payment_status = 'PAID',
      paid_date = NOW(),
      payment_method = 'M-PESA',
      updated_at = NOW()
    WHERE invoice_number = NEW.invoice_number;
    
    RAISE LOG 'Payment to Invoice Trigger: Invoice % updated from payment %', 
              NEW.invoice_number, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_to_invoice ON public.kcb_payments;
CREATE TRIGGER trigger_payment_to_invoice
AFTER UPDATE ON public.kcb_payments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_payment_to_invoice();

-- TRIGGER 2: Invoice → Inventory Update
-- When invoice is marked as PAID, deduct inventory quantities
CREATE OR REPLACE FUNCTION public.trigger_invoice_to_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'PAID' AND OLD.payment_status != 'PAID' THEN
    -- Get all line items from the invoice
    INSERT INTO public.inventory_movements (
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      created_at
    )
    SELECT 
      li.product_id,
      'SALE',
      li.quantity,
      'INVOICE',
      NEW.id,
      'Sale from invoice ' || NEW.invoice_number,
      NOW()
    FROM public.invoice_line_items li
    WHERE li.invoice_id = NEW.id;
    
    -- Update product inventory
    UPDATE public.inventory
    SET 
      quantity_available = quantity_available - (
        SELECT COALESCE(SUM(li.quantity), 0)
        FROM public.invoice_line_items li
        WHERE li.invoice_id = NEW.id AND li.product_id = inventory.product_id
      ),
      updated_at = NOW()
    WHERE product_id IN (
      SELECT DISTINCT li.product_id
      FROM public.invoice_line_items li
      WHERE li.invoice_id = NEW.id
    );
    
    RAISE LOG 'Invoice to Inventory Trigger: Inventory updated for invoice %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoice_to_inventory ON public.invoices;
CREATE TRIGGER trigger_invoice_to_inventory
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.trigger_invoice_to_inventory();

-- TRIGGER 3: Inventory → Alert Webhook
-- When inventory drops below threshold, send alert
CREATE OR REPLACE FUNCTION public.trigger_inventory_alert_webhook()
RETURNS TRIGGER AS $$
DECLARE
  alert_url TEXT;
  webhook_payload JSONB;
  threshold INTEGER;
BEGIN
  -- Get alert configuration
  SELECT value::integer INTO threshold
  FROM public.settings
  WHERE key = 'inventory_alert_threshold'
  LIMIT 1;
  
  threshold := COALESCE(threshold, 10); -- Default threshold
  
  -- Check if inventory is below threshold
  IF NEW.quantity_available < threshold THEN
    -- Get webhook URL from settings
    SELECT value INTO alert_url
    FROM public.settings
    WHERE key = 'inventory_alert_webhook_url'
    LIMIT 1;
    
    -- If webhook URL is configured, send alert
    IF alert_url IS NOT NULL THEN
      webhook_payload := jsonb_build_object(
        'event', 'inventory_low',
        'product_id', NEW.product_id,
        'product_name', (SELECT name FROM public.products WHERE id = NEW.product_id),
        'current_quantity', NEW.quantity_available,
        'alert_threshold', threshold,
        'timestamp', NOW(),
        'action_required', 'Reorder stock immediately'
      );
      
      -- Send webhook asynchronously using http extension
      PERFORM http_post(
        alert_url,
        webhook_payload::text,
        'application/json'::text
      );
      
      RAISE LOG 'Inventory Alert Webhook: Sent alert for product %', NEW.product_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_alert_webhook ON public.inventory;
CREATE TRIGGER trigger_inventory_alert_webhook
AFTER UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.trigger_inventory_alert_webhook();

-- Enable RLS for ipn_notifications
ALTER TABLE public.ipn_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for ipn_notifications
CREATE POLICY "IPN notifications are readable by authenticated users" 
  ON public.ipn_notifications FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "IPN notifications can be inserted by service role" 
  ON public.ipn_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Add index on invoice payment_status for faster lookups
CREATE INDEX IF NOT EXISTS invoices_payment_status_idx 
  ON public.invoices(payment_status);
