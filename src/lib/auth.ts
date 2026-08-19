// Authentication Service for Jimwas POS
// Handles login, logout, session management, and password operations

import { generateId, saveUser, getUserByUsername, getUser, saveLoginHistory } from './db';
import type { User, RoleCode } from './security-types';
import { getRoleByCode } from './db';
import { initialAuthRedirectError, supabase } from './supabaseClient';

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
    ['deriveBits']
  );

  // deriveBits returns the hash bytes directly, avoiding extractability restrictions
  // that apply when a PBKDF2-derived CryptoKey is exported.
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.slice().buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
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

export interface SetupResult {
  success: boolean;
  error?: string;
}

function getAuthCallbackUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SUPABASE_REDIRECT_URL;
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured;
  }
  return `${window.location.origin}/auth/callback`;
}

export function consumeAuthRedirectError(): string | null {
  const hash = window.location.hash;
  if (!hash && !initialAuthRedirectError) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const errorCode = params.get('error_code') || initialAuthRedirectError;
  const description = params.get('error_description');
  if (!errorCode && !description) return null;
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  if (errorCode === 'otp_expired') {
    return 'This confirmation link has expired or was already used. Request a new confirmation email and open the newest link.';
  }
  if (errorCode === 'access_denied') {
    return 'Email confirmation was not completed. Request a new confirmation email and try again.';
  }
  return 'The email confirmation link could not be completed. Request a new confirmation email and try again.';
}

export interface SessionData {
  userId: string;
  token: string;
  loginAt: string;
  deviceInfo: string;
}

export async function hasRemoteUsers(): Promise<boolean> {
  if (!supabase) return false;
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });
  if (error) {
    console.error('[v0] Supabase user count failed:', error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function setupFirstAdministrator(
  username: string,
  email: string,
  password: string,
  fullName: string,
): Promise<SetupResult> {
  if (!supabase) return { success: false, error: 'Authentication service is unavailable' };
  if (!username.trim() || !email.trim() || !fullName.trim()) {
    return { success: false, error: 'All fields are required' };
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return { success: false, error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number' };
  }
  if (await hasRemoteUsers()) {
    return { success: false, error: 'An administrator already exists. Sign in or ask an administrator to create your account.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const normalizedName = fullName.trim();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
      data: {
        username: normalizedUsername,
        full_name: normalizedName,
        role_code: 'admin',
      },
    },
  });
  if (authError || !authData.user) {
    const message = authError?.message.toLowerCase() ?? '';
    if (message.includes('already registered') || message.includes('already been registered')) {
      return { success: false, error: 'This email already has an account. Sign in with the email and password you created.' };
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return { success: false, error: 'Supabase has temporarily rate-limited confirmation emails. Wait before trying again, then use the newest email link.' };
    }
    return { success: false, error: authError?.message || 'Unable to create the administrator account' };
  }

  // The database trigger creates the matching public.users profile with the
  // metadata above. This avoids a client-side insert being blocked by RLS.
  if (authData.session) {
    await supabase.auth.signOut();
  }

  return { success: true };
}

async function getRemoteUserByUsername(username: string): Promise<User | undefined> {
  if (!supabase) return undefined;

  const client = supabase;
  if (!client) return undefined;
  const identifier = username.trim();
  const lookup = async (column: 'username' | 'email', value: string) =>
    client.from('users').select('*').eq(column, value).maybeSingle();

  const first = await lookup('username', identifier);
  if (first.error) {
    console.error('[v0] Supabase user lookup failed:', first.error.message);
    return undefined;
  }
  if (first.data) return first.data as User;

  const second = await lookup('email', identifier.toLowerCase());
  if (second.error) {
    console.error('[v0] Supabase email lookup failed:', second.error.message);
    return undefined;
  }
  return second.data as User | undefined;
}

async function updateRemoteUser(user: User): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('users')
    .update({
      failed_login_attempts: user.failed_login_attempts,
      locked_until: user.locked_until ?? null,
      last_login_at: user.last_login_at ?? null,
      updated_at: user.updated_at,
      password_hash: user.password_hash,
      is_active: user.is_active,
    })
    .eq('id', user.id);

  if (error) console.error('[v0] Supabase user update failed:', error.message);
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

async function getAuthenticatedUser(): Promise<User | null> {
  if (!supabase) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.email) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', authData.user.email)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;
  return data as User;
}

// Get current user from the Supabase Auth session
export async function getCurrentUser(): Promise<User | null> {
  if (supabase) {
    const user = await getAuthenticatedUser();
    if (!user) clearSession();
    return user;
  }

  return null;
}

// Check if user is locked out
function isUserLockedOut(user: User): boolean {
  if (!user.locked_until) return false;
  const lockedUntil = new Date(user.locked_until);
  return lockedUntil > new Date();
}

// Login function
export async function login(username: string, password: string): Promise<LoginResult> {
  if (!supabase) {
    return { success: false, error: 'Authentication service is unavailable' };
  }

  const identifier = username.trim();
  const user = await getRemoteUserByUsername(identifier);

  // For email sign-in, authenticate directly with Supabase first. This keeps
  // login working even when the POS profile lookup is temporarily blocked by RLS.
  if (!user && identifier.includes('@')) {
    const { data: authData, error: directSignInError } = await supabase.auth.signInWithPassword({
      email: identifier.toLowerCase(),
      password,
    });
    if (directSignInError || !authData.user) {
      return { success: false, error: 'Invalid username or password' };
    }
    const profile = await getAuthenticatedUser();
    if (!profile) {
      await supabase.auth.signOut();
      return { success: false, error: 'Your account is confirmed, but its POS profile is missing. Contact an administrator.' };
    }
    return { success: true, user: profile };
  }

  if (!user) {
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

  // Supabase Auth owns password verification and session issuance.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (signInError) {
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
    const failedUser = { ...user, ...updates } as User;
    await saveUser(failedUser);
    await updateRemoteUser(failedUser);

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
  await updateRemoteUser(updatedUser);

  // Supabase Auth persists the session securely through its client session storage.
  // Keep the app-specific login audit record separate from authentication state.
  await logLoginAttempt(user.id, username, true);

  return { success: true, user: updatedUser };
}

// Logout function
export async function logout(): Promise<void> {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[v0] Supabase sign out failed:', error.message);
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

  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { success: false, error: 'New password must be at least 8 characters and include uppercase, lowercase, and a number' };
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

// Administrator-only password reset. The plaintext password is never persisted or logged.
export async function resetUserPassword(
  targetUserId: string,
  newPassword: string,
  actorId: string,
): Promise<{ success: boolean; error?: string }> {
  const actor = await getUser(actorId);
  if (!actor || actor.role_code !== 'admin') {
    return { success: false, error: 'Only a system administrator can reset passwords' };
  }

  if (targetUserId === actorId) {
    return { success: false, error: 'Use Change Password to update your own password' };
  }

  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { success: false, error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number' };
  }

  const target = await getUser(targetUserId);
  if (!target) {
    return { success: false, error: 'User not found' };
  }

  const now = new Date().toISOString();
  await saveUser({
    ...target,
    password_hash: await hashPassword(newPassword),
    failed_login_attempts: 0,
    locked_until: undefined,
    updated_at: now,
    sync_status: 'pending',
  });

  await logAuditEvent('USER_PASSWORD_RESET', actorId, 'user', targetUserId, `Password reset for ${target.username}`);
  await logSecurityEvent('USER_PASSWORD_RESET', targetUserId, `Password reset by administrator ${actor.username}`);
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
  try {
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
  } catch (err) {
    console.error('[v0] Error in createUser:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create user' };
  }
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
