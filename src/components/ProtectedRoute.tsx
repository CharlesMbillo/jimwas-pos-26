// Protected Route Component - Route-level access control

import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute, getRouteConfig } from '../lib/rbac-config';
import { hasPermission } from '../lib/permissions';
import { useState, useEffect } from 'react';

interface ProtectedRouteProps {
  routePath: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedRoute({ routePath, children, fallback }: ProtectedRouteProps) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      if (!user) {
        setHasAccess(false);
        setIsChecking(false);
        return;
      }

      // Admin bypasses permission checks and can access newly registered protected modules.
      // Other roles must still pass the explicit route matrix below.
      if (user.role_code === 'admin') {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      // Check role-based access
      const roleAccess = canAccessRoute(user.role_code, routePath);
      if (!roleAccess) {
        setHasAccess(false);
        setIsChecking(false);
        return;
      }

      // Non-admin roles must also satisfy the route permission checks.
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      // Check permission-based access
      const routeConfig = getRouteConfig(routePath);
      if (routeConfig?.permissions && routeConfig.permissions.length > 0) {
        const hasPerms = await Promise.all(
          routeConfig.permissions.map(perm => hasPermission(user.id, perm))
        );
        setHasAccess(hasPerms.every(p => p));
      } else {
        setHasAccess(true);
      }

      setIsChecking(false);
    }

    checkAccess();
  }, [user, routePath]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-8 max-w-md">
            <h1 className="text-xl font-bold text-red-400 mb-2">Access Denied</h1>
            <p className="text-red-300 mb-4">
              You don&apos;t have permission to access this page.
            </p>
            <p className="text-sm text-red-400">
              Your current role: <strong>{user?.role_code}</strong>
            </p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

// Component Guard - Component-level access control
interface ComponentGuardProps {
  componentName: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ComponentGuard({ componentName, children, fallback }: ComponentGuardProps) {
  const { user } = useAuth();
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      if (!user) {
        setCanRender(false);
        return;
      }

      const { canRenderComponent } = await import('../lib/rbac-config');
      const access = canRenderComponent(user.role_code, componentName);
      setCanRender(access);
    }

    checkAccess();
  }, [user, componentName]);

  if (!canRender) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Feature Guard - Feature-level access control
interface FeatureGuardProps {
  featureName: string;
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

export function FeatureGuard({ featureName, children, fallback, showError = false }: FeatureGuardProps) {
  const { user } = useAuth();
  const [canUse, setCanUse] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      if (!user) {
        setCanUse(false);
        return;
      }

      const { canUseFeature } = await import('../lib/rbac-config');
      const access = canUseFeature(user.role_code, featureName);
      setCanUse(access);
    }

    checkAccess();
  }, [user, featureName]);

  if (!canUse) {
    if (showError) {
      return (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded px-4 py-2">
          <p className="text-yellow-400 text-sm">
            You don&apos;t have permission to use this feature.
          </p>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
