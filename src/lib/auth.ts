// Authentication Service for Jimwas POS
// Handles login, logout, session management, and password operations

import { generateId, saveUser, getUserByUsername, getUser, saveLoginHistory, saveSecurityEvent } from './db';
import type { User, Role, RoleCode } from './security-types';
import { getRoleByCode, saveRole, getAllRoles } from './db';

// Session storage keys
const SESSION_KEY = 'pos_session';
const CURRENT_USER_KEY = 'pos_current_user';

// Lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// Secure password hashing using PBKDF2 with random salt
// This provides strong protection against rainbow table and brute force attacks
async function hashPassword(password: string, existingHash?: string): Promise<string> {
  const encoder = new TextEncoder();

  // Extract salt from existing hash or generate new one
  let salt: Uint8Array;
  if (existingHash) {
    const saltHex = existingHash.split(':')[0];
    salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  } else {
    salt = crypto.getRandomValues(new Uint8Array(32));
  }

  // Use PBKDF2 with 100,000 iterations for strong key derivation
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Export the derived key to get the hash bytes
  const exportedKey = await crypto.subtle.exportKey('raw', derivedKey);
  const hashArray = Array.from(new Uint8Array(exportedKey));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Check for legacy hash format (no colon separator - old SHA256 format)
  if (!hash.includes(':')) {
    // Legacy verification for backward compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'jimwas_pos_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === hash;
  }

  // New PBKDF2 format: salt:hash
  const computedHash = await hashPassword(password, hash);
  return computedHash === hash;
}

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const browser = ua.includes('Chrome') ? 'Chrome' :
                  ua.includes('Firefox') ? 'Firefox' :
                  ua.includes('Safari') ? 'Safari' :
                  ua.includes('Edge') ? 'Edge' : 'Unknown';
  const os = ua.includes('Windows') ? 'Windows' :
             ua.includes('Mac') ? 'macOS' :
             ua.includes('Linux') ? 'Linux' :
             ua.includes('Android') ? 'Android' :
             ua.includes('iPhone') ? 'iOS' : 'Unknown';
  return `${browser} on ${os}`;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
  requiresPasswordChange?: boolean;
}

export interface SessionData {
  userId: string;
  token: string;
  loginAt: string;
  deviceInfo: string;
}

// Get current session
export function getCurrentSession(): SessionData | null {
  const sessionStr = localStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

// Get current user from session
export async function getCurrentUser(): Promise<User | null> {
  const session = getCurrentSession();
  if (!session) return null;

  const user = await getUser(session.userId);
  if (!user || !user.is_active) {
    clearSession();
    return null;
  }

  return user;
}

// Check if user is locked out
function isUserLockedOut(user: User): boolean {
  if (!user.locked_until) return false;
  const lockedUntil = new Date(user.locked_until);
  return lockedUntil > new Date();
}

// Generate session token
function generateToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
}

// Login function
export async function login(username: string, password: string): Promise<LoginResult> {
  const user = await getUserByUsername(username);

  if (!user) {
    // Log failed login attempt
    await logLoginAttempt('', username, false, 'User not found');
    return { success: false, error: 'Invalid username or password' };
  }

  // Check if user is active
  if (!user.is_active) {
    await logLoginAttempt(user.id, username, false, 'Account deactivated');
    return { success: false, error: 'Account is deactivated. Contact administrator.' };
  }

  // Check if user is locked out
  if (isUserLockedOut(user)) {
    await logLoginAttempt(user.id, username, false, 'Account locked');
    return { success: false, error: `Account locked. Try again after ${new Date(user.locked_until!).toLocaleString()}` };
  }

  // Verify password
  const validPassword = await verifyPassword(password, user.password_hash);

  if (!validPassword) {
    // Increment failed attempts
    const failedAttempts = user.failed_login_attempts + 1;
    const updates: Partial<User> = {
      failed_login_attempts: failedAttempts,
    };

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      updates.locked_until = lockedUntil.toISOString();

      // Log security event for lockout
      await logSecurityEvent('ACCOUNT_LOCKOUT', user.id, `Account locked after ${failedAttempts} failed attempts`);
    }

    // Update user with failed attempt count
    await saveUser({ ...user, ...updates } as User);

    await logLoginAttempt(user.id, username, false, 'Invalid password');
    return { success: false, error: 'Invalid username or password' };
  }

  // Successful login - reset failed attempts and update last login
  const now = new Date().toISOString();
  const updatedUser: User = {
    ...user,
    failed_login_attempts: 0,
    locked_until: undefined,
    last_login_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveUser(updatedUser);

  // Create session
  const session: SessionData = {
    userId: user.id,
    token: generateToken(),
    loginAt: now,
    deviceInfo: getDeviceInfo(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

  // Log successful login
  await logLoginAttempt(user.id, username, true);

  return { success: true, user: updatedUser };
}

// Logout function
export async function logout(): Promise<void> {
  const session = getCurrentSession();
  if (session) {
    // Get all login history for this user and update the latest one with logout time
    const { getLoginHistoryByUser } = await import('./db');
    const history = await getLoginHistoryByUser(session.userId);
    const currentSession = history.find(h => h.login_at === session.loginAt && !h.logout_at);
    if (currentSession) {
      const logoutAt = new Date().toISOString();
      const duration = Math.round((new Date(logoutAt).getTime() - new Date(currentSession.login_at).getTime()) / 60000);
      await saveLoginHistory({
        ...currentSession,
        logout_at: logoutAt,
        session_duration_minutes: duration,
      });
    }
  }

  clearSession();
}

// Clear session data
function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

// Log login attempt
async function logLoginAttempt(userId: string, username: string, success: boolean, reason?: string): Promise<void> {
  const loginRecord = {
    id: generateId(),
    user_id: userId,
    user_name: username,
    device_info: getDeviceInfo(),
    login_at: new Date().toISOString(),
    login_status: (success ? 'success' : 'failed') as 'success' | 'failed',
    failure_reason: success ? undefined : reason,
    sync_status: 'pending' as const,
  };

  await saveLoginHistory(loginRecord);

  // Check for suspicious activity - multiple failed logins
  if (!success && userId) {
    const { getLoginHistoryByUser } = await import('./db');
    const recentLogins = await getLoginHistoryByUser(userId);
    const recentFailures = recentLogins.filter(l =>
      l.login_status === 'failed' &&
      new Date(l.login_at).getTime() > Date.now() - 3600000 // Last hour
    );

    if (recentFailures.length >= 3) {
      await logSecurityEvent('MULTIPLE_FAILED_LOGINS', userId, `${recentFailures.length} failed login attempts in the last hour`);
    }
  }
}

// Log security event
async function logSecurityEvent(eventType: string, userId: string | undefined, description: string): Promise<void> {
  const { saveSecurityEvent } = await import('./db');
  await saveSecurityEvent({
    id: generateId(),
    event_type: eventType as any,
    severity: eventType === 'ACCOUNT_LOCKOUT' ? 'high' : 'medium',
    user_id: userId,
    description,
    metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
    is_resolved: false,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
  });
}

// Change password
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const user = await getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const validOldPassword = await verifyPassword(oldPassword, user.password_hash);
  if (!validOldPassword) {
    return { success: false, error: 'Current password is incorrect' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters' };
  }

  // Generate new secure hash with random salt
  const newPasswordHash = await hashPassword(newPassword);
  const updatedUser: User = {
    ...user,
    password_hash: newPasswordHash,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  await saveUser(updatedUser);

  // Update session user if current user
  const session = getCurrentSession();
  if (session && session.userId === userId) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  }

  // Log password change
  await logAuditEvent('USER_PASSWORD_CHANGED', userId, 'user', userId);

  return { success: true };
}

// Log audit event helper
async function logAuditEvent(eventType: string, userId: string, entityType: string, entityId: string, reason?: string): Promise<void> {
  const { saveAuditLog, getUser } = await import('./db');
  const user = await getUser(userId);

  await saveAuditLog({
    id: generateId(),
    event_type: eventType as any,
    user_id: userId,
    user_name: user?.full_name || user?.username || 'Unknown',
    user_role: user?.role_code || 'cashier',
    entity_type: entityType,
    entity_id: entityId,
    reason,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
  });
}

// Initialize default roles and admin user
export async function initializeSecurity(): Promise<void> {
  // Import security seed
  const { initializeSecurityData } = await import('./security-seed');
  await initializeSecurityData();
}

// Create new user (admin only)
export async function createUser(
  username: string,
  email: string,
  password: string,
  fullName: string,
  roleCode: RoleCode,
  createdBy: string,
  branchId?: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  // Check if username exists
  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    return { success: false, error: 'Username already exists' };
  }

  // Check if email exists
  const { getUserByEmail } = await import('./db');
  const existingEmail = await getUserByEmail(email);
  if (existingEmail) {
    return { success: false, error: 'Email already exists' };
  }

  // Get role
  const role = await getRoleByCode(roleCode);
  if (!role) {
    return { success: false, error: 'Invalid role' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const user: User = {
    id: generateId(),
    username,
    email,
    password_hash: passwordHash,
    full_name: fullName,
    role_id: role.id,
    role_code: roleCode,
    branch_id: branchId,
    is_active: true,
    failed_login_attempts: 0,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveUser(user);
  await logAuditEvent('USER_CREATED', createdBy, 'user', user.id, `Created user ${username} with role ${roleCode}`);

  return { success: true, user };
}

// Update user status (activate/deactivate)
export async function updateUserStatus(
  userId: string,
  isActive: boolean,
  actorId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const now = new Date().toISOString();
  const updatedUser: User = {
    ...user,
    is_active: isActive,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveUser(updatedUser);
  await logAuditEvent(
    isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    actorId,
    'user',
    userId,
    reason
  );

  return { success: true };
}

// Update user role
export async function updateUserRole(
  userId: string,
  newRoleCode: RoleCode,
  actorId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const role = await getRoleByCode(newRoleCode);
  if (!role) {
    return { success: false, error: 'Invalid role' };
  }

  const now = new Date().toISOString();
  const updatedUser: User = {
    ...user,
    role_id: role.id,
    role_code: newRoleCode,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveUser(updatedUser);
  await logAuditEvent('USER_ROLE_CHANGED', actorId, 'user', userId, `Role changed from ${user.role_code} to ${newRoleCode}. ${reason || ''}`);

  return { success: true };
}
