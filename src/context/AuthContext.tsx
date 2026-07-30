// Auth Context - Provide authentication state to React components

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../lib/security-types';
import { getCurrentUser, login as authLogin, logout as authLogout, initializeSecurity } from '../lib/auth';
import { clearAllPermissionCache } from '../lib/permissions';
import { initializeApp, shouldAutoRestore } from '../lib/init';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        // Initialize app (default settings, etc.)
        await initializeApp();

        // Check if we should auto-restore from last backup
        const needsRestore = await shouldAutoRestore();
        if (needsRestore) {
          console.log('[v0] Auto-restoring backup data from previous session...');
          // Note: Actual restore logic happens in backup module on-demand
          // This is just a signal that data should be available from IndexedDB
        }

        // Initialize security data (roles, permissions, admin user)
        await initializeSecurity();

        // Get current session
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  const login = async (username: string, password: string) => {
    const result = await authLogin(username, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  };

  const logout = async () => {
    await authLogout();
    setUser(null);
    clearAllPermissionCache();
  };

  const refreshUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Permission Guard component
interface PermissionGuardProps {
  permission: string | string[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, requireAll = false, children, fallback = null }: PermissionGuardProps) {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    async function checkPermission() {
      if (!user) {
        setHasPermission(false);
        return;
      }

      const { hasPermission: checkSingle, hasAnyPermission, hasAllPermissions } = await import('../lib/permissions');

      const permissions = Array.isArray(permission) ? permission : [permission];

      if (requireAll) {
        const result = await hasAllPermissions(user.id, permissions);
        setHasPermission(result);
      } else {
        const result = await hasAnyPermission(user.id, permissions);
        setHasPermission(result);
      }
    }

    checkPermission();
  }, [user, permission, requireAll]);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Role Guard component
interface RoleGuardProps {
  allowedRoles: Array<'admin' | 'manager' | 'cashier'>;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role_code)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
