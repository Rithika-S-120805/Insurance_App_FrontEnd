import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { DashboardComponent } from './dashboard/dashboard';
import { PolicyManagementComponent } from './policy-management/policy-management';
import { ClaimsManagementComponent } from './claims-management/claims-management';
import { UserManagementComponent } from './user-management/user-management';
import { PaymentsComponent } from './payments/payments';
import { authGuard } from './guards/auth.guard';
import { adminGuard, agentGuard, customerGuard, roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin-dashboard',
    component: DashboardComponent,
    canActivate: [adminGuard],
    data: { role: 'ADMIN' }
  },
  {
    path: 'agent-dashboard',
    component: DashboardComponent,
    canActivate: [agentGuard],
    data: { role: 'AGENT' }
  },
  {
    path: 'customer-dashboard',
    component: DashboardComponent,
    canActivate: [customerGuard],
    data: { role: 'CUSTOMER' }
  },
  {
    path: 'users',
    component: UserManagementComponent,
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'AGENT'] }
  },
  {
    path: 'policies',
    component: PolicyManagementComponent,
    canActivate: [authGuard]
  },
  {
    path: 'claims',
    component: ClaimsManagementComponent,
    canActivate: [authGuard]
  },
  {
    path: 'payments',
    component: PaymentsComponent,
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];

