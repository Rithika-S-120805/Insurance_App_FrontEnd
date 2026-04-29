import { Component, Input, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../models/user.model';
import { DashboardService } from '../../services/dashboard.service';
import { ClaimsService } from '../../claims-management/claims.service';
import { PaymentsService } from '../../payments/payments.service';
  import { PolicyService } from '../../policy-management/policy.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  imports: [CommonModule, FormsModule]
})
export class AdminDashboardComponent implements OnInit {
  @Input() user!: User;

  private dashboardService = inject(DashboardService);
  private claimsService = inject(ClaimsService);
  private paymentsService = inject(PaymentsService);
  private policyService = inject(PolicyService);
  private router = inject(Router);

  // Store counts in signals
  totalUsers = signal<number>(0);
  totalPolicies = signal<number>(0);
  totalClaims = signal<number>(0);
  totalPayments = signal<number>(0);
  claims = signal<any[]>([]);
  payments = signal<any[]>([]);
  policies = signal<any[]>([]);
  isLoading = signal(true);

  // User role breakdown
  usersByRole = signal<{[key: string]: number}>({});
  showUserBreakdown = signal(false);

  // Policies filter signals
  policiesSearchText = signal<string>('');
  policiesStatusFilter = signal<string>('');
  policiesTypeFilter = signal<string>('');
  policiesMinAmount = signal<number | null>(null);
  policiesMaxAmount = signal<number | null>(null);

  // Payments filter signals
  paymentsSearchText = signal<string>('');
  paymentsStatusFilter = signal<string>('');
  paymentsMethodFilter = signal<string>('');
  paymentsMinAmount = signal<number | null>(null);
  paymentsMaxAmount = signal<number | null>(null);

  // Dashboard stats computed from signals
  stats = computed(() => [
    { label: 'Total Users', value: this.totalUsers(), icon: '👥', color: 'primary' },
    { label: 'Total Policies', value: this.totalPolicies(), icon: '📋', color: 'success' },
    { label: 'Total Claims', value: this.totalClaims(), icon: '📝', color: 'warning' },
    { label: 'Total Payments', value: this.totalPayments(), icon: '💳', color: 'info' }
  ]);

  // Recent activities computed from actual data
  pendingClaims = computed(() => this.claims()
    .filter((c: any) => {
      const status = c.claimStatus || c.status || '';
      return status.toLowerCase().includes('pending') || status.toLowerCase().includes('under review');
    })
    .slice(0, 3)
  );
  recentPayments = computed(() => this.payments().slice(0, 3));

  // Filtered policies computed from search and filter signals
  filteredPolicies = computed(() => {
    let filtered = this.policies();

    // Search by policy number or holder name
    if (this.policiesSearchText()) {
      const searchLower = this.policiesSearchText().toLowerCase();
      filtered = filtered.filter((p: any) => {
        const policyNumber = (p.policyNumber || '').toLowerCase();
        const holderName = (p.user?.fullName || p.policyHolder?.name || '').toLowerCase();
        return policyNumber.includes(searchLower) || holderName.includes(searchLower);
      });
    }

    // Filter by status
    if (this.policiesStatusFilter()) {
      filtered = filtered.filter((p: any) => (p.status || '').toLowerCase() === this.policiesStatusFilter().toLowerCase());
    }

    // Filter by type
    if (this.policiesTypeFilter()) {
      filtered = filtered.filter((p: any) => (p.policyType || '').toLowerCase() === this.policiesTypeFilter().toLowerCase());
    }

    // Filter by premium amount range
    if (this.policiesMinAmount() !== null) {
      filtered = filtered.filter((p: any) => (p.premiumAmount || 0) >= this.policiesMinAmount()!);
    }
    if (this.policiesMaxAmount() !== null) {
      filtered = filtered.filter((p: any) => (p.premiumAmount || 0) <= this.policiesMaxAmount()!);
    }

    return filtered.slice(0, 5); // Show top 5
  });

  // Filtered payments computed from search and filter signals
  filteredPayments = computed(() => {
    let filtered = this.payments();

    // Search by payment ID or method
    if (this.paymentsSearchText()) {
      const searchLower = this.paymentsSearchText().toLowerCase();
      filtered = filtered.filter((p: any) => {
        const paymentId = (p.paymentId || '').toString().toLowerCase();
        const method = (p.paymentMethod || '').toLowerCase();
        return paymentId.includes(searchLower) || method.includes(searchLower);
      });
    }

    // Filter by status
    if (this.paymentsStatusFilter()) {
      filtered = filtered.filter((p: any) => (p.status || '').toLowerCase() === this.paymentsStatusFilter().toLowerCase());
    }

    // Filter by method
    if (this.paymentsMethodFilter()) {
      filtered = filtered.filter((p: any) => (p.paymentMethod || '').toLowerCase() === this.paymentsMethodFilter().toLowerCase());
    }

    // Filter by amount range
    if (this.paymentsMinAmount() !== null) {
      filtered = filtered.filter((p: any) => (p.amount || 0) >= this.paymentsMinAmount()!);
    }
    if (this.paymentsMaxAmount() !== null) {
      filtered = filtered.filter((p: any) => (p.amount || 0) <= this.paymentsMaxAmount()!);
    }

    return filtered.slice(0, 5); // Show top 5
  });

  // Get unique policy types for filter dropdown
  uniquePolicyTypes = computed(() => {
    const types = new Set(this.policies().map((p: any) => p.policyType).filter(Boolean));
    return Array.from(types).sort();
  });

  // Get unique payment methods for filter dropdown
  uniquePaymentMethods = computed(() => {
    const methods = new Set(this.payments().map((p: any) => p.paymentMethod).filter(Boolean));
    return Array.from(methods).sort();
  });

  quickActions = [
    { label: 'Manage Users', icon: '👥', route: '/users' },
    { label: 'Manage Policies', icon: '📋', route: '/policies' },
    { label: 'Manage Claims', icon: '📝', route: '/claims' },
    { label: 'Manage Payments', icon: '💳', route: '/payments' }
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
    let completedRequests = 0;
    const totalRequests = 4;

    const checkLoadingComplete = () => {
      completedRequests++;
      if (completedRequests === totalRequests) {
        this.isLoading.set(false);
        console.log('[AdminDashboard] All data loaded successfully');
      }
    };

    // Load dashboard data (users, policies, claims, payments counts)
    this.dashboardService.getAdminDashboard().subscribe(
      (dashboardData) => {
        console.log('[AdminDashboard] Admin dashboard data:', dashboardData);
        
        // Extract data from backend response
        this.totalUsers.set(dashboardData.totalUsers || 0);
        this.totalPolicies.set(dashboardData.totalPolicies || 0);
        this.totalClaims.set(dashboardData.totalClaims || 0);
        this.totalPayments.set(dashboardData.totalPayments || 0);
        
        // Set role breakdown from stats object
        if (dashboardData.stats) {
          this.usersByRole.set(dashboardData.stats);
        }
        
        checkLoadingComplete();
      },
      (error) => {
        console.error('[AdminDashboard] Error loading admin dashboard:', error);
        checkLoadingComplete();
      }
    );

    // Load all policies
    this.policyService.getAll().subscribe(
      (policiesData) => {
        console.log('[AdminDashboard] Policies loaded:', policiesData.length);
        this.policies.set(policiesData);
        checkLoadingComplete();
      },
      (error) => {
        console.error('[AdminDashboard] Error loading policies:', error);
        this.policies.set([]);
        checkLoadingComplete();
      }
    );

    // Load all claims
    this.claimsService.getAll().subscribe(
      (claimsData) => {
        console.log('[AdminDashboard] Claims loaded:', claimsData.length);
        this.claims.set(claimsData);
        checkLoadingComplete();
      },
      (error) => {
        console.error('[AdminDashboard] Error loading claims:', error);
        this.claims.set([]);
        checkLoadingComplete();
      }
    );

    // Load all payments
    this.paymentsService.getAll().subscribe(
      (paymentsData) => {
        console.log('[AdminDashboard] Payments loaded:', paymentsData.length);
        this.payments.set(paymentsData);
        checkLoadingComplete();
      },
      (error) => {
        console.error('[AdminDashboard] Error loading payments:', error);
        this.payments.set([]);
        checkLoadingComplete();
      }
    );
  }

  /**
   * Clear all policies filters
   */
  clearPoliciesFilters(): void {
    this.policiesSearchText.set('');
    this.policiesStatusFilter.set('');
    this.policiesTypeFilter.set('');
    this.policiesMinAmount.set(null);
    this.policiesMaxAmount.set(null);
  }

  /**
   * Clear all payments filters
   */
  clearPaymentsFilters(): void {
    this.paymentsSearchText.set('');
    this.paymentsStatusFilter.set('');
    this.paymentsMethodFilter.set('');
    this.paymentsMinAmount.set(null);
    this.paymentsMaxAmount.set(null);
  }

  /**
   * Format number as currency
   */
  formatCurrency(amount: number): string {
    return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN');
    } catch {
      return dateString;
    }
  }

  /**
   * Get claim status label with proper formatting
   */
  getClaimStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
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
