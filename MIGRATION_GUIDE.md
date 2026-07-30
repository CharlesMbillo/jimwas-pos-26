# Migration Guide: Replacing legacy M-Pesa Daraja code with KCB BUNI provider

This guide walks through migrating from Daraja/Safaricom-specific STK implementations to the new provider-agnostic KCB BUNI integration.

1. Branch & Backup
   - Create a working branch and ensure you have DB backups and application backups.

2. Add environment variables
   - Populate KCB_BUNI_* variables in your environment or secrets manager. Do NOT commit secrets.

3. Apply Prisma schema & migrations
   - Place the provided prisma/schema.prisma and then run:
       npx prisma migrate dev --name init_kcb_buni
   - Or apply the SQL in migrations/0001-create-payments-table.sql directly if you prefer manual SQL.

4. Wire the provider into your app
   - Instantiate PrismaClient and pass it to PaymentRepository.
   - Instantiate KcbBuniMpesaService with process.env values and register it in the providers map used by PaymentService.
   - Mount routes:
       app.use('/api/payments', createPaymentController(paymentService));
       app.use('/api/kcb-buni', createKcbBuniCallbackRouter({ repository, providerService }));

5. Replace legacy calls
   - Search for daraja, safaricom, mpesa-stk, BusinessShortCode, PartyA, PartyB, ConsumerKey, ConsumerSecret and replace calls to the new PaymentService.initiatePayment with the KCB contract payload.

6. Validate callbacks
   - Ensure your platform uses HTTPS for callback endpoints.
   - If KCB provides signature headers, implement verification in KcbBuniCallbackHandler.

7. Tests & CI
   - Run tests: npm test
   - Ensure CI env provides Prisma DATABASE_URL and KCB_BUNI_* test values.

8. Deploy
   - Deploy to staging first. Validate end-to-end with a sandbox KCB environment.

9. Cutover
   - After validating, switch production config and monitor logs. Keep legacy code in a feature branch until cutover is confirmed.

