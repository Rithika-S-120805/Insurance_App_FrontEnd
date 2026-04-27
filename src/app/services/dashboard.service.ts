import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'http://localhost:8080/api/dashboard';

  // Mock mode for development
  private mockMode = false; // Use real backend API

  /**
   * Get admin dashboard data
   */
  getAdminDashboard(): Observable<any> {
    if (this.mockMode) {
      return this.mockAdminDashboard();
    }
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    console.log('[DASHBOARD] Manually adding Authorization header:', headers);
    return this.http.get<any>(`${this.apiUrl}/admin`, { headers });
  }

  /**
   * Mock admin dashboard data
   */
  private mockAdminDashboard(): Observable<any> {
    const mockData = {
      totalUsers: 25,
      totalPolicies: 45,
      totalClaims: 12,
      totalAmountPaid: 125000,
      recentClaims: [
        {
          claimId: 1,
          policyId: 101,
          claimAmount: 5000,
          claimStatus: 'Pending Review',
          user: { fullName: 'John Doe' }
        },
        {
          claimId: 2,
          policyId: 102,
          claimAmount: 7500,
          claimStatus: 'Approved',
          user: { fullName: 'Jane Smith' }
        }
      ]
    };
    return of(mockData).pipe(delay(300));
  }

  /**
   * Get agent dashboard data
   */
  getAgentDashboard(): Observable<any> {
    if (this.mockMode) {
      return this.mockAgentDashboard();
    }
    return this.http.get<any>(`${this.apiUrl}/agent`);
  }

  /**
   * Mock agent dashboard data
   */
  private mockAgentDashboard(): Observable<any> {
    const mockData = {
      customers: [
        { userId: 3, fullName: 'Alice Johnson', email: 'alice@example.com' },
        { userId: 4, fullName: 'Bob Wilson', email: 'bob@example.com' }
      ],
      policies: [
        { policyId: 101, policyType: 'HEALTH', status: 'Active', premiumAmount: 5000 },
        { policyId: 102, policyType: 'AUTO', status: 'Active', premiumAmount: 3000 }
      ],
      claims: [
        { claimId: 1, claimStatus: 'Pending', claimAmount: 2000 },
        { claimId: 2, claimStatus: 'Under Review', claimAmount: 1500 }
      ]
    };
    return of(mockData).pipe(delay(300));
  }

  /**
   * Get customer dashboard data
   */
  getCustomerDashboard(): Observable<any> {
    if (this.mockMode) {
      return this.mockCustomerDashboard();
    }
    return this.http.get<any>(`${this.apiUrl}/customer`);
  }

  /**
   * Mock customer dashboard data
   */
  private mockCustomerDashboard(): Observable<any> {
    const mockData = {
      policies: [
        { policyId: 101, policyType: 'HEALTH', status: 'Active', premiumAmount: 5000 },
        { policyId: 102, policyType: 'AUTO', status: 'Active', premiumAmount: 3000 }
      ],
      claims: [
        { claimId: 1, claimStatus: 'Pending Review', claimAmount: 2000 },
        { claimId: 2, claimStatus: 'Approved', claimAmount: 1500 }
      ],
      payments: [
        { paymentId: 1, amount: 5000, date: '2024-01-15', name: 'Health Insurance Premium' },
        { paymentId: 2, amount: 3000, date: '2024-01-20', name: 'Auto Insurance Premium' }
      ]
    };
    return of(mockData).pipe(delay(300));
  }

  /**
   * Get agent's customers - filtered by current agent's ID
   */
  getAgentCustomers(): Observable<any> {
    const agentId = this.authService.getAgentId();
    const token = this.authService.getToken();

    console.log('[Dashboard] Loading agent customers.', {
      agentId,
      tokenExists: !!token,
      tokenPreview: token ? token.substring(0, 30) + '...' : 'NO TOKEN'
    });

    if (this.mockMode) {
      return this.mockAgentCustomers(agentId || undefined);
    }
    
    if (!agentId) {
      console.error('[Dashboard] No agentId found, returning empty list');
      return of([]);
    }

    if (!token) {
      console.error('[Dashboard] No token found, cannot make authenticated request');
      return of([]);
    }

    const url = `${this.apiUrl}/agent/customers`;
    console.log('[Dashboard] Making request to:', url, 'with agentId:', agentId);

    return this.http.get<any>(url, {
      params: { agentId: agentId.toString() }
    }).pipe(
      catchError((error) => {
        console.error('[Dashboard] Error fetching agent customers:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
          url: error.url
        });
        return of([]);
      })
    );
  }

  /**
   * Mock agent customers - filtered by agent_id
   */
  private mockAgentCustomers(agentId?: number): Observable<any> {
    // All available mock customers with their assigned agent
    const allCustomers = [
      { userId: 3, agent_id: 2, fullName: 'Alice Johnson', email: 'alice@example.com', policies: 2 },
      { userId: 4, agent_id: 2, fullName: 'Bob Wilson', email: 'bob@example.com', policies: 1 },
      { userId: 5, agent_id: 2, fullName: 'Charlie Brown', email: 'charlie@example.com', policies: 3 },
      { userId: 6, agent_id: 10, fullName: 'David Lee', email: 'david@example.com', policies: 2 },
      { userId: 7, agent_id: 10, fullName: 'Eve Davis', email: 'eve@example.com', policies: 1 }
    ];

    // Filter customers for this specific agent
    const filteredCustomers = agentId 
      ? allCustomers.filter(c => c.agent_id === agentId)
      : allCustomers.filter(c => c.agent_id === 2); // Default to agent 2 for demo

    return of(filteredCustomers).pipe(delay(200));
  }

  /**
   * Get agent's policies - filtered by current agent's ID
   */
  getAgentPolicies(): Observable<any> {
    const agentId = this.authService.getAgentId();

    console.log('[Dashboard] Loading agent policies. AgentId:', agentId);

    if (this.mockMode) {
      return this.mockAgentPolicies(agentId || undefined);
    }
    
    if (!agentId) {
      console.error('[Dashboard] No agentId found, returning empty list');
      return of([]);
    }

    return this.http.get<any>(`${this.apiUrl}/agent/policies`, {
      params: { agentId: agentId.toString() }
    }).pipe(
      catchError((error) => {
        console.error('[Dashboard] Error fetching agent policies:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
          url: error.url
        });
        return of([]);
      })
    );
  }

  /**
   * Mock agent policies - filtered by agent_id
   */
  private mockAgentPolicies(agentId?: number): Observable<any> {
    // All available mock policies with their assigned agent
    const allPolicies = [
      { policyId: 101, agent_id: 2, policyType: 'HEALTH', status: 'Active', premiumAmount: 5000, user: { fullName: 'Alice Johnson' } },
      { policyId: 102, agent_id: 2, policyType: 'AUTO', status: 'Active', premiumAmount: 3000, user: { fullName: 'Bob Wilson' } },
      { policyId: 103, agent_id: 2, policyType: 'HOME', status: 'Expiring Soon', premiumAmount: 4000, user: { fullName: 'Charlie Brown' } },
      { policyId: 104, agent_id: 10, policyType: 'HEALTH', status: 'Active', premiumAmount: 5500, user: { fullName: 'David Lee' } },
      { policyId: 105, agent_id: 10, policyType: 'AUTO', status: 'Active', premiumAmount: 3500, user: { fullName: 'Eve Davis' } }
    ];

    // Filter policies for this specific agent
    const filteredPolicies = agentId 
      ? allPolicies.filter(p => p.agent_id === agentId)
      : allPolicies.filter(p => p.agent_id === 2); // Default to agent 2 for demo

    return of(filteredPolicies).pipe(delay(200));
  }

  /**
   * Get agent's claims - filtered by current agent's ID
   */
  getAgentClaims(): Observable<any> {
    const agentId = this.authService.getAgentId();

    console.log('[Dashboard] Loading agent claims. AgentId:', agentId);

    if (this.mockMode) {
      return this.mockAgentClaims(agentId || undefined);
    }
    
    if (!agentId) {
      console.error('[Dashboard] No agentId found, returning empty list');
      return of([]);
    }

    return this.http.get<any>(`${this.apiUrl}/agent/claims`, {
      params: { agentId: agentId.toString() }
    }).pipe(
      catchError((error) => {
        console.error('[Dashboard] Error fetching agent claims:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
          url: error.url
        });
        return of([]);
      })
    );
  }

  /**
   * Mock agent claims - filtered by agent_id
   */
  private mockAgentClaims(agentId?: number): Observable<any> {
    // All available mock claims with their assigned agent
    const allClaims = [
      { claimId: 1, agent_id: 2, claimStatus: 'Pending', claimAmount: 2000, policyId: 101, user: { fullName: 'Alice Johnson' } },
      { claimId: 2, agent_id: 2, claimStatus: 'Under Review', claimAmount: 1500, policyId: 102, user: { fullName: 'Bob Wilson' } },
      { claimId: 3, agent_id: 2, claimStatus: 'Approved', claimAmount: 3000, policyId: 103, user: { fullName: 'Charlie Brown' } },
      { claimId: 4, agent_id: 10, claimStatus: 'Pending', claimAmount: 2500, policyId: 104, user: { fullName: 'David Lee' } },
      { claimId: 5, agent_id: 10, claimStatus: 'Under Review', claimAmount: 1800, policyId: 105, user: { fullName: 'Eve Davis' } }
    ];

    // Filter claims for this specific agent
    const filteredClaims = agentId 
      ? allClaims.filter(c => c.agent_id === agentId)
      : allClaims.filter(c => c.agent_id === 2); // Default to agent 2 for demo

    return of(filteredClaims).pipe(delay(200));
  }

  /**
   * Get customer's policies
   */
  getCustomerPolicies(): Observable<any> {
    if (this.mockMode) {
      return this.mockCustomerPolicies();
    }
    return this.http.get<any>(`${this.apiUrl}/customer/policies`).pipe(
      catchError(error => {
        console.error('[Dashboard] Error fetching customer policies:', error);
        return of([]);
      })
    );
  }

  /**
   * Mock customer policies - filter by current user ID
   */
  private mockCustomerPolicies(): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.warn('[Dashboard] No current user for customer policies');
      return of([]);
    }

    const userId = currentUser.userId || currentUser.user_id;
    console.log('[Dashboard] Filtering customer policies for userId:', userId);

    // Mock policies with user association
    const allPolicies = [
      { policyId: 101, userId: 3, policyType: 'HEALTH', status: 'Active', premiumAmount: 5000 },
      { policyId: 102, userId: 3, policyType: 'AUTO', status: 'Active', premiumAmount: 3000 },
      { policyId: 103, userId: 4, policyType: 'LIFE', status: 'Active', premiumAmount: 10000 },
      { policyId: 104, userId: 5, policyType: 'HOME', status: 'Active', premiumAmount: 2500 }
    ];

    const filteredPolicies = allPolicies.filter(p => p.userId === userId);
    console.log('[Dashboard] Filtered customer policies:', filteredPolicies);

    return of(filteredPolicies).pipe(delay(200));
  }

  /**
   * Get customer's claims
   */
  getCustomerClaims(): Observable<any> {
    if (this.mockMode) {
      return this.mockCustomerClaims();
    }
    return this.http.get<any>(`${this.apiUrl}/customer/claims`).pipe(
      catchError(error => {
        console.error('[Dashboard] Error fetching customer claims:', error);
        return of([]);
      })
    );
  }

  /**
   * Mock customer claims - filter by current user ID
   */
  private mockCustomerClaims(): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.warn('[Dashboard] No current user for customer claims');
      return of([]);
    }

    const userId = currentUser.userId || currentUser.user_id;
    console.log('[Dashboard] Filtering customer claims for userId:', userId);

    // Mock claims with user association
    const allClaims = [
      { claimId: 1, userId: 3, claimStatus: 'Pending Review', claimAmount: 2000, policyId: 101 },
      { claimId: 2, userId: 3, claimStatus: 'Approved', claimAmount: 1500, policyId: 102 },
      { claimId: 3, userId: 4, claimStatus: 'Under Review', claimAmount: 3000, policyId: 103 },
      { claimId: 4, userId: 5, claimStatus: 'Pending', claimAmount: 2500, policyId: 104 }
    ];

    const filteredClaims = allClaims.filter(c => c.userId === userId);
    console.log('[Dashboard] Filtered customer claims:', filteredClaims);

    return of(filteredClaims).pipe(delay(200));
  }

  /**
   * Get customer's payments
   */
  getCustomerPayments(): Observable<any> {
    if (this.mockMode) {
      return this.mockCustomerPayments();
    }
    return this.http.get<any>(`${this.apiUrl}/customer/payments`).pipe(
      catchError(error => {
        console.error('[Dashboard] Error fetching customer payments:', error);
        return of([]);
      })
    );
  }

  /**
   * Mock customer payments - filter by current user ID
   */
  private mockCustomerPayments(): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.warn('[Dashboard] No current user for customer payments');
      return of([]);
    }

    const userId = currentUser.userId || currentUser.user_id;
    console.log('[Dashboard] Filtering customer payments for userId:', userId);

    // Mock payments with user association
    const allPayments = [
      { paymentId: 1, userId: 3, amount: 5000, date: '2024-01-15', name: 'Health Insurance Premium', size: '2.1 MB', uploaded: '2 days ago' },
      { paymentId: 2, userId: 3, amount: 3000, date: '2024-01-20', name: 'Auto Insurance Premium', size: '1.8 MB', uploaded: '1 week ago' },
      { paymentId: 3, userId: 4, amount: 10000, date: '2024-01-10', name: 'Life Insurance Premium', size: '3.2 MB', uploaded: '3 days ago' },
      { paymentId: 4, userId: 5, amount: 2500, date: '2024-01-25', name: 'Home Insurance Premium', size: '1.5 MB', uploaded: '5 days ago' }
    ];

    const filteredPayments = allPayments.filter(p => p.userId === userId);
    console.log('[Dashboard] Filtered customer payments:', filteredPayments);

    return of(filteredPayments).pipe(delay(200));
  }
}
