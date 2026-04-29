import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  private router = inject(Router);

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
  private validateCustomerData(data: any, dataType: string): any[] {
    if (!this.user) {
      console.warn(`[CustomerDashboard] No user context for ${dataType} validation`);
      return [];
    }

    // Handle case where API returns { data: [...] } instead of direct array
    let dataArray = Array.isArray(data) ? data : (data?.data || []);
    
    if (!Array.isArray(dataArray)) {
      console.warn(`[CustomerDashboard] Expected array for ${dataType}, got:`, typeof dataArray, dataArray);
      return [];
    }

    const userId = this.user.userId || this.user.user_id;
    if (!userId) {
      console.warn(`[CustomerDashboard] No user ID found for ${dataType} validation`);
      return [];
    }

    // Filter data to ensure it belongs to this customer
    const validatedData = dataArray.filter(item => {
      // Direct userId match (for policies)
      const itemUserId = item.userId || item.user_id;
      if (itemUserId === userId) {
        return true;
      }
      
      // For claims and payments, check if they belong to customer's policies
      if (dataType === 'claims' || dataType === 'payments') {
        // If item has a policyId, check if that policy belongs to this customer
        const itemPolicyId = item.policyId || item.policy_id;
        if (itemPolicyId && this.policies()) {
          const belongsToPolicyId = this.policies().some(p => p.policyId === itemPolicyId);
          return belongsToPolicyId;
        }
        
        // If no userId and no policyId match, include it (backend might be filtering already)
        // This is a fallback for when backend returns filtered data
        return true;
      }
      
      return false;
    });

    if (validatedData.length !== dataArray.length) {
      console.warn(
        `[CustomerDashboard] Filtered ${dataArray.length - validatedData.length} ${dataType} items for customer ${userId}. `,
        `Raw data sample:`, 
        dataArray.slice(0, 2)
      );
    }

    console.log(`[CustomerDashboard] Validated ${validatedData.length} ${dataType} items for customer ${userId}`);
    return validatedData;
  }

  loadCustomerData(): void {
    this.isLoading.set(true);

    // Load policies first
    this.dashboardService.getCustomerPolicies().subscribe(
      (policies) => {
        const validatedPolicies = this.validateCustomerData(policies, 'policies');
        this.policies.set(validatedPolicies);

        // After policies are loaded, load claims and payments
        this.loadClaimsAndPayments();
      },
      (error) => {
        console.error('Error loading policies:', error);
        this.policies.set([]);
        this.loadClaimsAndPayments(); // Still load claims/payments even if policies fail
      }
    );
  }

  /**
   * Load claims and payments after policies are loaded
   */
  private loadClaimsAndPayments(): void {
    let completedRequests = 0;
    const totalRequests = 2;

    const checkLoadingComplete = () => {
      completedRequests++;
      if (completedRequests === totalRequests) {
        this.isLoading.set(false);
      }
    };

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
    const userId = Number(localStorage.getItem('userId'));

// Load payments
this.dashboardService.getCustomerPayments().subscribe(
  (payments) => {
    const validatedPayments = this.validateCustomerData(payments, 'payments');

    const filteredPayments = validatedPayments.filter(
      (payment: any) => Number(payment.userId) === userId
    );

    this.payments.set(filteredPayments);

    console.log('Filtered customer payments:', filteredPayments);

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
    const activePolicies = this.policies().filter((p: any) => 
      p.status && p.status.toLowerCase() === 'active'
    ).length;
    const totalClaims = this.claims().length;
    const pendingClaims = this.claims().filter((c: any) => 
      c.claimStatus && (
        c.claimStatus.toLowerCase().includes('pending') || 
        c.claimStatus.toLowerCase().includes('under review')
      )
    ).length;
    const totalPremium = this.policies().reduce((sum, p) => sum + (p.premiumAmount || 0), 0);

    return [
      { label: 'Active Policies', value: activePolicies, icon: '📋' },
      { label: 'Total Claims', value: totalClaims, icon: '📝' },
      { label: 'Pending Claims', value: pendingClaims, icon: '⏳' },
      { label: 'Monthly Premium', value: `₹${totalPremium.toLocaleString('en-IN')}`, icon: '💰' }
    ];
  });

  recentDocuments = computed(() => {
    // Map recent payments as documents with proper properties
    return this.payments().slice(0, 5).map((payment: any) => ({
      name: `${payment.paymentType || 'Payment'} - ${payment.paymentReference || 'REF'}`,
      size: this.formatFileSize(payment.amount || 0),
      uploaded: this.formatDate(payment.paymentDate || payment.createdDate || new Date()),
      paymentId: payment.paymentId,
      amount: payment.amount,
      status: payment.paymentStatus
    }));
  });

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  }

  /**
   * Format date for display
   */
  private formatDate(date: any): string {
    if (!date) return 'Unknown';
    try {
      const dateObj = new Date(date);
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor(diff / (1000 * 60));
      
      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      return 'Just now';
    } catch (e) {
      return 'Unknown';
    }
  }

  /**
   * Navigation methods
   */
  viewAllPolicies(): void {
    this.router.navigate(['/policies']);
  }

  viewAllClaims(): void {
    this.router.navigate(['/claims']);
  }

  viewAllPayments(): void {
    this.router.navigate(['/payments']);
  }

  viewPolicyDetails(policyId: number): void {
    this.router.navigate(['/policies', policyId]);
  }

  viewClaimDetails(claimId: number): void {
    this.router.navigate(['/claims', claimId]);
  }

  downloadPolicy(policyId: number): void {
    // Call backend to download policy document
    const policyUrl = `/api/policies/${policyId}/download`;
    window.open(policyUrl, '_blank');
  }

  downloadPaymentReceipt(paymentId: number): void {
    // Call backend to download payment receipt
    const receiptUrl = `/api/payments/${paymentId}/receipt`;
    window.open(receiptUrl, '_blank');
  }

  navigateToPayments(): void {
    this.router.navigate(['/payments']);
  }
}
