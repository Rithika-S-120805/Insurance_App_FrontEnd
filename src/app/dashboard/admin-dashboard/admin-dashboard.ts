import { Component, Input, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../models/user.model';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  imports: [CommonModule]
})
export class AdminDashboardComponent implements OnInit {
  @Input() user!: User;

  private dashboardService = inject(DashboardService);
  private router = inject(Router);

  // Store counts in signals
  totalUsers = signal<number>(0);
  totalPolicies = signal<number>(0);
  totalClaims = signal<number>(0);
  totalPayments = signal<number>(0);
  claims = signal<any[]>([]);
  isLoading = signal(true);

  // User role breakdown
  usersByRole = signal<{[key: string]: number}>({});
  showUserBreakdown = signal(false);

  // Dashboard stats computed from signals
  stats = computed(() => [
    { label: 'Total Users', value: this.totalUsers(), icon: '👥', color: 'primary' },
    { label: 'Total Policies', value: this.totalPolicies(), icon: '📋', color: 'success' },
    { label: 'Total Claims', value: this.totalClaims(), icon: '📝', color: 'warning' },
    { label: 'Total Payments', value: this.totalPayments(), icon: '💳', color: 'info' }
  ]);

  // Recent activities computed from actual data
  pendingClaims = computed(() => this.claims().filter((c: any) => this.mapClaimStatus(c.claimStatus) === 'Pending Review').slice(0, 3));
  recentPayments = computed(() => this.claims().filter((c: any) => this.mapClaimStatus(c.claimStatus) === 'Approved').slice(0, 3));

  quickActions = [
    { label: 'Manage Users', icon: '👥', route: '/users' },
    { label: 'View Policies', icon: '📋', route: '/policies' },
    { label: 'View Claims', icon: '📝', route: '/claims' },
    { label: 'View Payments', icon: '💳', route: '/payments' }
  ];

  ngOnInit(): void {
    // Validate user is admin before loading data
    if (!this.user || this.user.role !== 'ADMIN') {
      console.error('[AdminDashboard] Access denied: User is not an admin');
      this.isLoading.set(false);
      return;
    }
    this.loadStatistics();
  }

  /**
   * Load statistics from backend via DashboardService
   */
  loadStatistics(): void {
    this.isLoading.set(true);
    
    this.dashboardService.getAdminDashboard().subscribe(
      (dashboardData) => {
        console.log('Admin dashboard data:', dashboardData);
        
        // Extract data from backend response
        this.totalUsers.set(dashboardData.totalUsers || 0);
        this.totalPolicies.set(dashboardData.totalPolicies || 0);
        this.totalClaims.set(dashboardData.totalClaims || 0);
        this.totalPayments.set(dashboardData.totalPayments || 0);
        
        // Set role breakdown from stats object
        if (dashboardData.stats) {
          this.usersByRole.set(dashboardData.stats);
        }
        
        this.isLoading.set(false);
      },
      (error) => {
        console.error('Error loading admin dashboard:', error);
        this.isLoading.set(false);
      }
    );
  }

  /**
   * Format number as currency
   */
  formatCurrency(amount: number): string {
    return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  /**
   * Handle stat card clicks
   */
  onStatClick(stat: any): void {
    if (stat.label === 'Total Users') {
      this.showUserBreakdown.set(!this.showUserBreakdown());
    }
  }

  /**
   * Handle quick action clicks
   */
  onQuickActionClick(action: any): void {
    if (action.route) {
      this.router.navigate([action.route]);
    }
  }

  private mapClaimStatus(apiStatus: string): string {
    switch (apiStatus) {
      case 'APPROVED': return 'Approved';
      case 'PENDING': return 'Pending Review';
      case 'REJECTED': return 'Denied';
      case 'UNDER_REVIEW': return 'Pending Review';
      default: return apiStatus;
    }
  }
}
