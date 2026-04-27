import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../models/user.model';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  templateUrl: './customer-dashboard.html',
  styleUrl: './customer-dashboard.css',
  imports: [CommonModule]
})
export class CustomerDashboardComponent implements OnInit {
  @Input() user!: User;

  private dashboardService = inject(DashboardService);

  policies = signal<any[]>([]);
  claims = signal<any[]>([]);
  payments = signal<any[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    this.loadCustomerData();
  }

  /**
   * Validate that data belongs to current customer
   */
  private validateCustomerData(data: any[], dataType: string): any[] {
    if (!this.user) {
      console.warn(`[CustomerDashboard] No user context for ${dataType} validation`);
      return [];
    }

    const userId = this.user.userId || this.user.user_id;
    if (!userId) {
      console.warn(`[CustomerDashboard] No user ID found for ${dataType} validation`);
      return [];
    }

    // Filter data to ensure it belongs to this customer
    const validatedData = data.filter(item => {
      const itemUserId = item.userId || item.user_id;
      return itemUserId === userId;
    });

    if (validatedData.length !== data.length) {
      console.warn(`[CustomerDashboard] Filtered ${data.length - validatedData.length} ${dataType} items that don't belong to customer ${userId}`);
    }

    console.log(`[CustomerDashboard] Validated ${validatedData.length} ${dataType} items for customer ${userId}`);
    return validatedData;
  }

  loadCustomerData(): void {
    this.isLoading.set(true);
    let completedRequests = 0;
    const totalRequests = 3;

    const checkLoadingComplete = () => {
      completedRequests++;
      if (completedRequests === totalRequests) {
        this.isLoading.set(false);
      }
    };

    // Load policies
    this.dashboardService.getCustomerPolicies().subscribe(
      (policies) => {
        const validatedPolicies = this.validateCustomerData(policies, 'policies');
        this.policies.set(validatedPolicies);
        checkLoadingComplete();
      },
      (error) => {
        console.error('Error loading policies:', error);
        this.policies.set([]);
        checkLoadingComplete();
      }
    );

    // Load claims
    this.dashboardService.getCustomerClaims().subscribe(
      (claims) => {
        const validatedClaims = this.validateCustomerData(claims, 'claims');
        this.claims.set(validatedClaims);
        checkLoadingComplete();
      },
      (error) => {
        console.error('Error loading claims:', error);
        this.claims.set([]);
        checkLoadingComplete();
      }
    );

    // Load payments
    this.dashboardService.getCustomerPayments().subscribe(
      (payments) => {
        const validatedPayments = this.validateCustomerData(payments, 'payments');
        this.payments.set(validatedPayments);
        checkLoadingComplete();
      },
      (error) => {
        console.error('Error loading payments:', error);
        this.payments.set([]);
        checkLoadingComplete();
      }
    );
  }

  quickStats = computed(() => {
    const activePolicies = this.policies().filter((p: any) => p.status === 'Active').length;
    const totalClaims = this.claims().length;
    const pendingClaims = this.claims().filter((c: any) => c.claimStatus === 'Pending' || c.claimStatus === 'Under Review').length;
    const totalPremium = this.policies().reduce((sum, p) => sum + (p.premiumAmount || 0), 0);

    return [
      { label: 'Active Policies', value: activePolicies, icon: '📋' },
      { label: 'Total Claims', value: totalClaims, icon: '📝' },
      { label: 'Pending Claims', value: pendingClaims, icon: '⏳' },
      { label: 'Monthly Premium', value: `₹${totalPremium.toLocaleString('en-IN')}`, icon: '💰' }
    ];
  });

  recentDocuments = computed(() => {
    // Return recent payments as documents
    return this.payments().slice(0, 5);
  });
}
