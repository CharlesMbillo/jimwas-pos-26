// RBAC Enforcement - System-wide permission checks and enforcement

import { User } from './security-types';
import { hasPermission, hasAnyPermission, hasAllPermissions } from './permissions';
import { ROUTE_CONFIG, FEATURE_CONFIG, COMPONENT_CONFIG } from './rbac-config';

/**
 * Enforce RBAC for an action
 * Returns result with access status and message
 */
export interface RBACEnforcementResult {
  allowed: boolean;
  message: string;
  requiresApproval?: boolean;
  reason?: string;
}

/**
 * Check if user can access a route
 */
export async function enforceRouteAccess(
  user: User | null,
  routePath: string
): Promise<RBACEnforcementResult> {
  if (!user) {
    return {
      allowed: false,
      message: 'User not authenticated',
      reason: 'User session required',
    };
  }

  const route = Object.values(ROUTE_CONFIG).find(r => r.path === routePath);
  if (!route) {
    return {
      allowed: false,
      message: 'Route not found',
      reason: 'Unknown route',
    };
  }

  // Check role
  if (!route.allowedRoles.includes(user.role_code)) {
    return {
      allowed: false,
      message: `Route access denied for role: ${user.role_code}`,
      reason: `Only ${route.allowedRoles.join(', ')} can access this route`,
    };
  }

  // Check permissions if specified
  if (route.permissions && route.permissions.length > 0) {
    const hasPerm = await hasAllPermissions(user.id, route.permissions);
    if (!hasPerm) {
      return {
        allowed: false,
        message: 'Insufficient permissions',
        reason: `Missing permissions: ${route.permissions.join(', ')}`,
      };
    }
  }

  return {
    allowed: true,
    message: 'Route access granted',
    requiresApproval: route.requiresApproval,
  };
}

/**
 * Check if user can use a feature
 */
export async function enforceFeatureAccess(
  user: User | null,
  featureName: string
): Promise<RBACEnforcementResult> {
  if (!user) {
    return {
      allowed: false,
      message: 'User not authenticated',
      reason: 'User session required',
    };
  }

  const feature = FEATURE_CONFIG[featureName];
  if (!feature) {
    return {
      allowed: false,
      message: 'Feature not found',
      reason: 'Unknown feature',
    };
  }

  // Check role
  if (!feature.allowedRoles.includes(user.role_code)) {
    return {
      allowed: false,
      message: `Feature access denied for role: ${user.role_code}`,
      reason: `Only ${feature.allowedRoles.join(', ')} can use this feature`,
    };
  }

  // Check permissions
  if (feature.requiredPermissions && feature.requiredPermissions.length > 0) {
    const hasPerm = await hasAllPermissions(user.id, feature.requiredPermissions);
    if (!hasPerm) {
      return {
        allowed: false,
        message: 'Insufficient permissions',
        reason: `Missing permissions: ${feature.requiredPermissions.join(', ')}`,
      };
    }
  }

  return {
    allowed: true,
    message: 'Feature access granted',
  };
}

/**
 * Check if user can render a component
 */
export async function enforceComponentAccess(
  user: User | null,
  componentName: string
): Promise<RBACEnforcementResult> {
  if (!user) {
    return {
      allowed: false,
      message: 'User not authenticated',
      reason: 'User session required',
    };
  }

  const component = COMPONENT_CONFIG[componentName];
  if (!component) {
    return {
      allowed: false,
      message: 'Component not found',
      reason: 'Unknown component',
    };
  }

  // Check role
  if (!component.allowedRoles.includes(user.role_code)) {
    return {
      allowed: false,
      message: `Component access denied for role: ${user.role_code}`,
      reason: `Only ${component.allowedRoles.join(', ')} can view this component`,
    };
  }

  // Check permissions if specified
  if (component.requiredPermissions && component.requiredPermissions.length > 0) {
    const hasPerm = await hasAllPermissions(user.id, component.requiredPermissions);
    if (!hasPerm) {
      return {
        allowed: false,
        message: 'Insufficient permissions',
        reason: `Missing permissions: ${component.requiredPermissions.join(', ')}`,
      };
    }
  }

  return {
    allowed: true,
    message: 'Component access granted',
  };
}

/**
 * Check if user can perform a specific action with all required permissions
 */
export async function enforceActionAccess(
  user: User | null,
  action: string,
  requiredPermissions: string[]
): Promise<RBACEnforcementResult> {
  if (!user) {
    return {
      allowed: false,
      message: 'User not authenticated',
      reason: 'User session required',
    };
  }

  if (requiredPermissions.length === 0) {
    return {
      allowed: true,
      message: 'Action access granted',
    };
  }

  const hasPerm = await hasAllPermissions(user.id, requiredPermissions);
  if (!hasPerm) {
    return {
      allowed: false,
      message: `Cannot perform ${action}`,
      reason: `Missing permissions: ${requiredPermissions.join(', ')}`,
    };
  }

  return {
    allowed: true,
    message: `Action ${action} allowed`,
  };
}

/**
 * Check if user can perform any of the specified actions
 */
export async function enforceAnyActionAccess(
  user: User | null,
  action: string,
  requiredPermissions: string[]
): Promise<RBACEnforcementResult> {
  if (!user) {
    return {
      allowed: false,
      message: 'User not authenticated',
      reason: 'User session required',
    };
  }

  if (requiredPermissions.length === 0) {
    return {
      allowed: true,
      message: 'Action access granted',
    };
  }

  const hasPerm = await hasAnyPermission(user.id, requiredPermissions);
  if (!hasPerm) {
    return {
      allowed: false,
      message: `Cannot perform ${action}`,
      reason: `Missing at least one of: ${requiredPermissions.join(', ')}`,
    };
  }

  return {
    allowed: true,
    message: `Action ${action} allowed`,
  };
}

/**
 * Get detailed access report for a user
 */
export async function getUserAccessReport(user: User | null): Promise<{
  user: User | null;
  accessibleRoutes: string[];
  availableFeatures: string[];
  visibleComponents: string[];
  restrictedActions: string[];
}> {
  if (!user) {
    return {
      user: null,
      accessibleRoutes: [],
      availableFeatures: [],
      visibleComponents: [],
      restrictedActions: [],
    };
  }

  const { getAccessibleRoutes, getAvailableFeatures, getVisibleComponents } = await import('./rbac-config');

  const accessibleRoutes = getAccessibleRoutes(user.role_code)
    .map(r => r.path)
    .sort();

  const availableFeatures = getAvailableFeatures(user.role_code)
    .map(f => f.featureName)
    .sort();

  const visibleComponents = getVisibleComponents(user.role_code)
    .map(c => c.componentName)
    .sort();

  // Restricted actions are features the user cannot access
  const allFeatures = Object.keys(FEATURE_CONFIG);
  const restrictedActions = allFeatures
    .filter(f => !availableFeatures.includes(FEATURE_CONFIG[f].featureName))
    .sort();

  return {
    user,
    accessibleRoutes,
    availableFeatures,
    visibleComponents,
    restrictedActions,
  };
}

/**
 * Audit RBAC violation
 */
export async function auditRBACViolation(
  user: User | null,
  action: string,
  resource: string,
  reason: string
): Promise<void> {
  console.warn('[RBAC Violation]', {
    user: user?.username || 'unknown',
    role: user?.role_code || 'none',
    action,
    resource,
    reason,
    timestamp: new Date().toISOString(),
  });

  // In production, this should be logged to audit trail
  // For now, just console warning
  if (typeof window !== 'undefined') {
    console.error(`[RBAC] Unauthorized ${action} attempt on ${resource}: ${reason}`);
  }
}

/**
 * Log successful permission use
 */
export async function auditRBACSuccess(
  user: User | null,
  action: string,
  resource: string
): Promise<void> {
  console.log('[RBAC Success]', {
    user: user?.username || 'unknown',
    role: user?.role_code || 'none',
    action,
    resource,
    timestamp: new Date().toISOString(),
  });
}
