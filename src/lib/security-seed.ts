// Security Seed Data - Initialize default roles, permissions, and admin user

import { generateId, saveRole, savePermission, saveUser, getRoleByCode, getUserByUsername, getAllRoles, getAllPermissions, getDB } from './db';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type Role, type Permission, type User, type RoleCode } from './security-types';

// Simple password hashing (same as auth.ts)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'jimwas_pos_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function isSecurityInitialized(): Promise<boolean> {
  const roles = await getAllRoles();
  return roles.length > 0;
}

export async function initializeSecurityData(): Promise<void> {
  console.log('Checking security initialization...');

  const db = await getDB();

  // Initialize permissions (only if not exists)
  const existingPerms = await getAllPermissions();
  if (existingPerms.length === 0) {
    console.log('Initializing permissions...');
    const now = new Date().toISOString();
    for (const perm of PERMISSIONS) {
      const permission: Permission = {
        ...perm,
        created_at: now,
      };
      await savePermission(permission);
    }
  }

  // Initialize roles (only if not exists)
  const existingRoles = await getAllRoles();
  if (existingRoles.length === 0) {
    console.log('Initializing roles...');
    const now = new Date().toISOString();
    const roleData: Array<{ code: RoleCode; name: string; description: string }> = [
      { code: 'admin', name: 'Administrator', description: 'Full system access with all permissions' },
      { code: 'manager', name: 'Manager', description: 'Store manager with sales, inventory, and approval permissions' },
      { code: 'cashier', name: 'Cashier', description: 'Cashier with basic sales and customer permissions' },
    ];

    for (const rd of roleData) {
      const role: Role = {
        id: generateId(),
        code: rd.code,
        name: rd.name,
        description: rd.description,
        permissions: DEFAULT_ROLE_PERMISSIONS[rd.code],
        is_system: true,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
      };
      await saveRole(role);
    }
  }

  // Create default admin user (only if not exists)
  const existingAdmin = await getUserByUsername('admin');
  if (!existingAdmin) {
    console.log('Creating default admin user...');
    const adminRole = await getRoleByCode('admin');
    if (!adminRole) {
      console.error('Admin role not found - cannot create admin user');
      return;
    }

    const now = new Date().toISOString();
    const defaultPassword = 'admin123'; // Should be changed on first login
    const passwordHash = await hashPassword(defaultPassword);

    const adminUser: User = {
      id: generateId(),
      username: 'admin',
      email: 'admin@jimwas.com',
      password_hash: passwordHash,
      full_name: 'System Administrator',
      role_id: adminRole.id,
      role_code: 'admin',
      is_active: true,
      failed_login_attempts: 0,
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
    };

    await saveUser(adminUser);
    console.log('Default admin user created: admin / admin123');
    console.log('IMPORTANT: Change the default admin password immediately!');
  }

  console.log('Security data check complete');
}

export async function createDefaultBranchManager(branchId?: string): Promise<void> {
  const existingManager = await getUserByUsername('manager');
  if (existingManager) return;

  const managerRole = await getRoleByCode('manager');
  if (!managerRole) return;

  const now = new Date().toISOString();
  const passwordHash = await hashPassword('manager123');

  const managerUser: User = {
    id: generateId(),
    username: 'manager',
    email: 'manager@jimwas.com',
    password_hash: passwordHash,
    full_name: 'Store Manager',
    role_id: managerRole.id,
    role_code: 'manager',
    branch_id: branchId,
    is_active: true,
    failed_login_attempts: 0,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveUser(managerUser);
  console.log('Default manager user created: manager / manager123');
}

export async function createDefaultCashier(branchId?: string): Promise<void> {
  const existingCashier = await getUserByUsername('cashier');
  if (existingCashier) return;

  const cashierRole = await getRoleByCode('cashier');
  if (!cashierRole) return;

  const now = new Date().toISOString();
  const passwordHash = await hashPassword('cashier123');

  const cashierUser: User = {
    id: generateId(),
    username: 'cashier',
    email: 'cashier@jimwas.com',
    password_hash: passwordHash,
    full_name: 'Default Cashier',
    role_id: cashierRole.id,
    role_code: 'cashier',
    branch_id: branchId,
    is_active: true,
    failed_login_attempts: 0,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveUser(cashierUser);
  console.log('Default cashier user created: cashier / cashier123');
}
