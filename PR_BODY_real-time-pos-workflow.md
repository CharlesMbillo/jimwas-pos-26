Title: real-time-pos-workflow — simplify POS workflow, add receipt printing & automation

Summary: Replace the KCB-heavy refactor with a simplified, STK-push-only POS workflow. Adds automatic receipt printing + history, IPN notification handler, database triggers to mark invoices paid and deduct inventory, webhook alerts for low stock, and deployment & quick-start documentation. Removes the large KCB_BUNI documentation/refactor files that were previously in the branch.

Why: simplify production workflow, reduce surface area, provide a maintainable automated POS flow and clear deployment steps.

Notes: This branch deletes many KCB_BUNI files and adds new migrations and edge functions — run migrations and verify environment variables before deploying.

---

## Deployment & Migration Checklist

- [ ] Create a staging environment and run the included database migrations there first (supabase/migrations/*).  
- [ ] Backup production database before applying migrations.  
- [ ] Verify and set required environment variables for Supabase Edge Functions and any payment provider integrations (e.g., MPESA/STK credentials, webhook secret keys).  
- [ ] Deploy Supabase Edge Functions (supabase/functions/kcb-ipn-notification and any other new functions).  
- [ ] Update any webhook endpoints and IPN URLs in your payment provider dashboard to point to the deployed edge function endpoints.  
- [ ] Run manual smoke tests: create an invoice, trigger the STK push, confirm IPN handler records payment, confirm inventory is deducted, and receipt printing triggers.  
- [ ] Monitor logs and alerts for errors during initial deploy.  
- [ ] Rollback plan: Have a snapshot of pre-migration DB and a branch with the previous KCB_BUNI files if needed.  

---

Acceptance tests / QA steps

1. Run the QUICK_START_CHECKLIST.md steps end-to-end in staging.  
2. Verify the receipt printing feature produces receipts matching the template in RECEIPT_PRINTING_GUIDE.md and that history entries are stored.  
3. Simulate IPN calls (both success and failure) to ensure edge function handles them correctly and the DB triggers mark invoices paid.  
4. Test low-stock webhook alerts by reducing inventory to threshold values and confirm alert delivery.

---

Breaking changes & Risks

- Deletions of KCB_BUNI_* files are large and may break teams relying on that prior integration. Confirm these deletions are intentional.  
- Migrations and edge functions require proper environment setup and secrets — missing them will break payment flows.  

---

Suggested reviewers / stakeholders

- @your-team-payments  
- @ops  
- @frontend-lead  

---

Please run CI and attach the results here. If you'd like, I can open the PR now using this title and body.