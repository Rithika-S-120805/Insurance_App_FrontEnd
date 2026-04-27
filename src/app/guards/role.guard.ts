import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Role Guard - Protects routes based on user role
 * Usage: { path: 'admin', component: AdminComponent, canActivate: [roleGuard], data: { roles: ['ADMIN'] } }
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // Get required roles from route data
  const requiredRoles = route.data['roles'] as string[];

  // If no specific roles required, allow access
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // Get current user role
  const userRole = authService.getUserRole();

  // Check if user has one of the required roles
  if (userRole && requiredRoles.includes(userRole)) {
    return true;
  }

  // User doesn't have required role, redirect to dashboard
  router.navigate(['/dashboard']);
  return false;
};

/**
 * Admin Guard - Protects routes that only admin can access
 * Usage: { path: 'admin', component: AdminComponent, canActivate: [adminGuard] }
 */
export const adminGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasRole(UserRole.ADMIN)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

/**
 * Agent Guard - Protects routes that only agent can access
 */
export const agentGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasRole(UserRole.AGENT)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

/**
 * Customer Guard - Protects routes that only customer can access
 */
export const customerGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.hasRole(UserRole.CUSTOMER)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
