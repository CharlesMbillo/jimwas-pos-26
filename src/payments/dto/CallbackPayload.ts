export interface KcbCallbackMetadata {
  Amount?: number;
  MpesaReceiptNumber?: string;
  TransactionDate?: string | number;
  PhoneNumber?: string;
  [key: string]: any;
}

export interface CallbackPayload {
  provider: 'kcb_buni' | string;
  merchantRequestId: string;
  checkoutRequestId?: string;
  resultCode: number;
  resultDesc?: string;
  callbackMetadata?: KcbCallbackMetadata;
  raw?: any;
  receivedAt?: string;
}
