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
  activePolicies = signal<number>(0);
  pendingClaims = signal<number>(0);
  renewalsNeeded = signal<number>(0);
  isLoading = signal(true);

  // Data lists
  customers = signal<any[]>([]);
  policies = signal<any[]>([]);
  allClaims = signal<any[]>([]);

  // Metrics computed from signals
  metrics = computed(() => [
    { label: 'Assigned Customers', value: this.assignedCustomers(), icon: '👥', color: 'primary' },
    { label: 'Active Policies', value: this.activePolicies(), icon: '📋', color: 'success' },
    { label: 'Claims to Assist', value: this.pendingClaims(), icon: '📝', color: 'warning' },
    { label: 'Renewals Needed', value: this.renewalsNeeded(), icon: '🔄', color: 'info' }
  ]);

  // Computed filtered lists for agent view
  myCustomersForDisplay = computed(() => this.customers().slice(0, 5));
  claimsNeedingAssistance = computed(() => 
    this.allClaims()
      .filter((c: any) => c.claimStatus === 'Pending' || c.claimStatus === 'Under Review')
      .slice(0, 5)
  );
  policiesNeedingRenewal = computed(() => 
    this.policies()
      .filter((p: any) => p.status === 'Expiring Soon' || p.status === 'Expired')
      .slice(0, 5)
  );

  quickActions = [
    { label: 'Add Customer', icon: '👤', route: '/users' },
    { label: 'Create Policy', icon: '📋', route: '/policies' },
    { label: 'Review Claims', icon: '📝', route: '/claims' },
    { label: 'View Analytics', icon: '📊', route: '/dashboard' }
  ];

  /**
   * Validate that data belongs to current agent
   */
  private validateAgentData(data: any[], dataType: string): any[] {
    if (!this.user) {
      console.warn(`[AgentDashboard] No user context for ${dataType} validation`);
      return [];
    }

    const agentId = this.user.agentId || this.user.agent_id || this.user.userId || this.user.user_id;
    if (!agentId) {
      console.warn(`[AgentDashboard] No agent ID found for ${dataType} validation`);
      return [];
    }

    // Filter data to ensure it belongs to this agent
    const validatedData = data.filter(item => {
      const itemAgentId = item.agent_id || item.agentId;
      return itemAgentId === agentId;
    });

    if (validatedData.length !== data.length) {
      console.warn(`[AgentDashboard] Filtered ${data.length - validatedData.length} ${dataType} items that don't belong to agent ${agentId}`);
    }

    console.log(`[AgentDashboard] Validated ${validatedData.length} ${dataType} items for agent ${agentId}`);
    return validatedData;
  }

  ngOnInit(): void {
    this.loadAgentData();
  }

  /**
   * Load all data relevant to the agent via DashboardService
   */
  loadAgentData(): void {
    this.isLoading.set(true);
    let completedRequests = 0;
    const totalRequests = 3;

    const checkLoadingComplete = () => {
      completedRequests++;
      if (completedRequests === totalRequests) {
        this.isLoading.set(false);
      }
    };

    // Load customers
    this.dashboardService.getAgentCustomers().subscribe(
      (customersList) => {
        const validatedCustomers = this.validateAgentData(customersList, 'customers');
        this.customers.set(validatedCustomers);
        this.assignedCustomers.set(validatedCustomers.length);
        checkLoadingComplete();
      },
      (error) => {
        console.error('Error loading customers:', error);
        this.customers.set([]);
        this.assignedCustomers.set(0);
        checkLoadingComplete();
      }
    );

    // Load policies
    this.dashboardService.getAgentPolicies().subscribe(
      (policies) => {
        const validatedPolicies = this.validateAgentData(policies, 'policies');
        this.policies.set(validatedPolicies);
        this.activePolicies.set(validatedPolicies.filter((p: any) => p.status === 'Active').length);
        this.renewalsNeeded.set(validatedPolicies.filter((p: any) => p.status === 'Expiring Soon' || p.status === 'Expired').length);
        checkLoadingComplete();
      },
      (error) => {
        console.error('Error loading policies:', error);
        this.policies.set([]);
        this.activePolicies.set(0);
        this.renewalsNeeded.set(0);
        checkLoadingComplete();
      }
    );

    // Load claims
    this.dashboardService.getAgentClaims().subscribe(
      (claims) => {
        const validatedClaims = this.validateAgentData(claims, 'claims');
        this.allClaims.set(validatedClaims);
        const pendingClaimsCount = validatedClaims.filter((c: any) => c.claimStatus === 'Pending' || c.claimStatus === 'Under Review').length;
        this.pendingClaims.set(pendingClaimsCount);
        checkLoadingComplete();
      },
      (error) => {
        console.error('Error loading claims:', error);
        this.allClaims.set([]);
        this.pendingClaims.set(0);
        checkLoadingComplete();
      }
    );
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
