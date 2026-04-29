import { Component, Input, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../models/user.model';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  templateUrl: './agent-dashboard.html',
  styleUrl: './agent-dashboard.css',
  imports: [CommonModule]
})
export class AgentDashboardComponent implements OnInit {
  @Input() user!: User;

  private dashboardService = inject(DashboardService);
  private router = inject(Router);

  // Agent-specific metrics
  assignedCustomers = signal<number>(0);
  assignedPolicies = signal<number>(0);
  totalClaims = signal<number>(0);
  totalPayments = signal<number>(0);
  renewalsNeeded = signal<number>(0);
  isLoading = signal(true);

  // Data lists
  customers = signal<any[]>([]);
  policies = signal<any[]>([]);
  allClaims = signal<any[]>([]);
  payments = signal<any[]>([]);

  currentAgentId = computed(() => this.user?.agent_id ?? this.user?.agentId ?? this.user?.userId ?? this.user?.user_id);

  // Metrics computed from signals
  metrics = computed(() => [
    { label: 'Assigned Customers', value: this.assignedCustomers(), icon: '👥', color: 'primary' },
    { label: 'Assigned Policies', value: this.assignedPolicies(), icon: '📋', color: 'success' },
    { label: 'Claims', value: this.totalClaims(), icon: '📝', color: 'warning' },
    { label: 'Payments', value: this.totalPayments(), icon: '💳', color: 'info' }
  ]);

  // Computed filtered lists for agent view
  myCustomersForDisplay = computed(() => this.customers().slice(0, 5));
  policyHighlights = computed(() => this.policies().slice(0, 5));
  renewalHighlights = computed(() => this.policies().filter(policy => this.isRenewalDue(policy)).slice(0, 5));
  claimHighlights = computed(() => this.allClaims().filter(claim => this.isClaimNeedingAssistance(claim)).slice(0, 5));
  paymentHighlights = computed(() => this.payments().slice(0, 5));

  quickActions = [
    { label: 'Add Customer', icon: '👤', route: '/users' },
    { label: 'Create Policy', icon: '📋', route: '/policies' },
    { label: 'Review Claims', icon: '📝', route: '/claims' }
  ];

  /**
   * Validate that data belongs to current agent
   */
  private validateAgentData(data: any[], dataType: string): any[] {
    if (!this.user) {
      console.warn(`[AgentDashboard] No user context for ${dataType} validation`);
      return [];
    }

    const agentId = this.currentAgentId();
    if (!agentId) {
      console.warn(`[AgentDashboard] No agent ID found for ${dataType} validation`);
      return [];
    }

    console.log(`[AgentDashboard] Received ${data.length} ${dataType} items for agent ${agentId}`);
    return data;
  }

  ngOnInit(): void {
    this.loadAgentData();
  }

  /**
   * Load all data relevant to the agent via DashboardService
   */
  loadAgentData(): void {
    this.isLoading.set(true);

    this.dashboardService.getAgentDashboard().subscribe({
      next: (dashboard) => {
        const customers = Array.isArray(dashboard?.customers) ? dashboard.customers : [];
        const policies = Array.isArray(dashboard?.policies) ? dashboard.policies : [];
        const claims = Array.isArray(dashboard?.claims) ? dashboard.claims : [];
        const payments = Array.isArray(dashboard?.payments) ? dashboard.payments : [];

        const scopedCustomers = this.validateAgentCustomers(customers);
        const scopedPolicies = this.filterByCurrentAgent(policies);
        const scopedClaims = this.filterByCurrentAgent(claims);
        const scopedPayments = this.filterByCurrentAgent(payments);

        this.customers.set(scopedCustomers);
        this.policies.set(scopedPolicies);
        this.allClaims.set(scopedClaims);
        this.payments.set(scopedPayments);

        this.assignedCustomers.set(dashboard?.totalAssignedCustomers ?? scopedCustomers.length);
        this.assignedPolicies.set(dashboard?.totalAssignedPolicies ?? scopedPolicies.length);
        this.totalClaims.set(dashboard?.totalClaims ?? scopedClaims.length);
        this.totalPayments.set(dashboard?.totalPayments ?? scopedPayments.length);

        this.renewalsNeeded.set(scopedPolicies.filter((policy: any) => this.isRenewalDue(policy)).length);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading agent dashboard:', error);
        this.customers.set([]);
        this.policies.set([]);
        this.allClaims.set([]);
        this.payments.set([]);
        this.assignedCustomers.set(0);
        this.assignedPolicies.set(0);
        this.totalClaims.set(0);
        this.totalPayments.set(0);
        this.renewalsNeeded.set(0);
        this.isLoading.set(false);
      }
    });
  }

  private validateAgentCustomers(customers: any[]): any[] {
    const agentId = this.currentAgentId();
    if (!agentId) {
      return customers;
    }

    return customers.filter(customer => {
      const customerAgentId = customer?.agent_id ?? customer?.agentId;
      if (customerAgentId === null || customerAgentId === undefined) {
        return true;
      }
      return String(customerAgentId) === String(agentId);
    });
  }

  private filterByCurrentAgent(items: any[]): any[] {
    const agentId = this.currentAgentId();
    if (!agentId) {
      return items;
    }

    return items.filter(item => {
      const itemAgentId = item?.agent_id ?? item?.agentId;
      if (itemAgentId === null || itemAgentId === undefined) {
        return true;
      }
      return String(itemAgentId) === String(agentId);
    });
  }

  private isRenewalDue(policy: any): boolean {
    const status = String(policy?.status || '').toLowerCase();
    return status.includes('expiring') || status === 'expired';
  }

  private isClaimNeedingAssistance(claim: any): boolean {
    const status = String(claim?.claimStatus || claim?.status || '').toLowerCase();
    return status.includes('pending') || status.includes('under review');
  }


  /**
   * Handle quick action clicks
   */
  onQuickActionClick(action: any): void {
    if (action.route) {
      this.router.navigate([action.route]);
    }
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    return 'status-' + (status?.toLowerCase() || 'pending');
  }

}
