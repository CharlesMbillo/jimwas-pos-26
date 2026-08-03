import { SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";

export type AuditEventType = 
  | "STK_PUSH_INITIATED"
  | "STK_PUSH_SUCCESS"
  | "STK_PUSH_FAILED"
  | "IPN_RECEIVED"
  | "IPN_VERIFIED"
  | "IPN_FAILED"
  | "RATE_LIMIT_EXCEEDED"
  | "SIGNATURE_VERIFICATION_FAILED"
  | "CONFIG_ERROR";

export interface AuditLogEntry {
  eventType: AuditEventType;
  actor: string;          // User/system identifier
  resource: string;       // Resource affected (e.g., payment ID)
  action: string;         // What was done
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  entry: AuditLogEntry,
  request?: Request
): Promise<void> {
  try {
    const ipAddress = getClientIP(request);
    const userAgent = request?.headers.get("user-agent") || undefined;

    const { error } = await supabase.from("api_audit_logs").insert({
      event_type: entry.eventType,
      actor: entry.actor,
      resource: entry.resource,
      action: entry.action,
      status: entry.status,
      metadata: entry.metadata || {},
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[v0] Audit log error:", error);
    }
  } catch (err) {
    console.error("[v0] Error logging audit event:", err);
    // Don't throw - audit logging shouldn't break the request
  }
}

/**
 * Extract client IP from request
 */
function getClientIP(request?: Request): string | null {
  if (!request) return null;

  // Try Cloudflare header first
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // Try X-Forwarded-For
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();

  // Try X-Real-IP
  const xRealIP = request.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;

  return null;
}

/**
 * Create monitoring alert if needed
 */
export async function createAlertIfNeeded(
  supabase: SupabaseClient,
  eventType: AuditEventType,
  metadata?: Record<string, any>
): Promise<void> {
  // Create alerts for critical events
  const criticalEvents = [
    "STK_PUSH_FAILED",
    "IPN_FAILED",
    "RATE_LIMIT_EXCEEDED",
    "SIGNATURE_VERIFICATION_FAILED",
    "CONFIG_ERROR",
  ];

  if (!criticalEvents.includes(eventType)) return;

  try {
    const { error } = await supabase.from("api_alerts").insert({
      event_type: eventType,
      severity: eventType === "RATE_LIMIT_EXCEEDED" ? "WARN" : "ERROR",
      message: `Alert: ${eventType}`,
      metadata: metadata || {},
      resolved: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[v0] Alert creation error:", error);
    }
  } catch (err) {
    console.error("[v0] Error creating alert:", err);
  }
}
