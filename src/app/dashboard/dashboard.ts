import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User, UserRole } from '../models/user.model';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';
import { CustomerDashboardComponent } from './customer-dashboard/customer-dashboard';
import { AgentDashboardComponent } from './agent-dashboard/agent-dashboard';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  imports: [
    CommonModule,
    AdminDashboardComponent,
    CustomerDashboardComponent,
    AgentDashboardComponent
  ]
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  router = inject(Router);

  currentUser = this.authService.currentUser;
  currentRole = this.authService.currentRole;
  UserRole = UserRole;

  ngOnInit(): void {
    // Redirect to login if no user is logged in
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getUserGreeting(): string {
    const user = this.currentUser();
    if (!user) return 'User';
    return user.fullName || user.username;
  }

  getRoleBadgeClass(): string {
    const role = this.currentRole();
    switch (role) {
      case UserRole.ADMIN:
        return 'badge-admin';
      case UserRole.AGENT:
        return 'badge-agent';
      case UserRole.CUSTOMER:
        return 'badge-customer';
      default:
        return 'badge-default';
    }
  }
}
