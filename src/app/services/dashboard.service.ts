import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, combineLatest } from 'rxjs';
import { delay, catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'http://localhost:8080/api/dashboard';

  // Real backend API - no mock mode for production

  /**
   * Get admin dashboard data with user breakdown by role
   */
  getAdminDashboard(): Observable<any> {
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    console.log('[DASHBOARD] Fetching admin dashboard from backend');
    
    // Fetch main dashboard data
    const dashboardData$ = this.http.get<any>(`${this.apiUrl}/admin`, { headers });
    
    // Fetch user breakdown by role
    const userStats$ = this.getUsersByRole(headers);
    
    // Combine both observables
    return combineLatest([dashboardData$, userStats$]).pipe(
      map(([dashboardData, stats]) => ({
        ...dashboardData,
        stats: stats
      })),
      catchError((error) => {
        console.error('[DASHBOARD] Error fetching admin dashboard:', error);
        return of({
          totalUsers: 0,
          totalPolicies: 0,
          totalClaims: 0,
          totalAmountPaid: 0,
          stats: {
            ADMIN: 0,
            AGENT: 0,
            CUSTOMER: 0
          }
        });
      })
    );
  }

  /**
   * Get user counts by role from backend
   */
  private getUsersByRole(headers: HttpHeaders): Observable<{[key: string]: number}> {
    const usersApiUrl = 'http://localhost:8080/api/users';
    
    return this.http.get<any[]>(usersApiUrl, { headers }).pipe(
      map((users) => {
        // Count users by role
        const roleCount: {[key: string]: number} = {
          ADMIN: 0,
          AGENT: 0,
          CUSTOMER: 0
        };
        
        users.forEach((user) => {
          if (user.role && roleCount.hasOwnProperty(user.role)) {
            roleCount[user.role]++;
          }
        });
        
        console.log('[DASHBOARD] Users by role:', roleCount);
        return roleCount;
      }),
      catchError((error) => {
        console.error('[DASHBOARD] Error fetching users by role:', error);
        return of({
          ADMIN: 0,
          AGENT: 0,
          CUSTOMER: 0
        });
      })
    );
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
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.get<any>(`${this.apiUrl}/agent`, { headers });
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
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.get<any>(`${this.apiUrl}/customer`, { headers });
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
      tokenPreview: token ? token.substring(0, 30) + '...' : 'NO TOKEN',
      tokenLength: token ? token.length : 0,
      storageAuthToken: localStorage.getItem('authToken') ? 'EXISTS' : 'NOT FOUND',
      storageToken: localStorage.getItem('token') ? 'EXISTS' : 'NOT FOUND'
    });
    
    if (!agentId) {
      console.error('[Dashboard] No agentId found, returning empty list');
      return of([]);
    }

    if (!token) {
      console.error('[Dashboard] ❌ NO TOKEN FOUND - cannot make authenticated request');
      console.log('[Dashboard] localStorage contents:', {
        authToken: localStorage.getItem('authToken') ? 'EXISTS' : 'MISSING',
        token: localStorage.getItem('token') ? 'EXISTS' : 'MISSING',
        currentUser: localStorage.getItem('currentUser') ? 'EXISTS' : 'MISSING',
        userRole: localStorage.getItem('userRole') ? 'EXISTS' : 'MISSING'
      });
      return of([]);
    }

    const url = `${this.apiUrl}/agent/customers`;
    console.log('[Dashboard] Making request to:', url, 'with agentId:', agentId);

    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
      console.log('[Dashboard] ✅ Authorization header set with token:', token.substring(0, 30) + '...');
    }

    return this.http.get<any>(url, {
      params: { agentId: agentId.toString() },
      headers: headers
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
    const token = this.authService.getToken();

    console.log('[Dashboard] Loading agent policies. AgentId:', agentId);
    
    if (!agentId) {
      console.error('[Dashboard] No agentId found, returning empty list');
      return of([]);
    }

    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<any>(`${this.apiUrl}/agent/policies`, {
      params: { agentId: agentId.toString() },
      headers: headers
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
    const token = this.authService.getToken();

    console.log('[Dashboard] Loading agent claims. AgentId:', agentId);
    
    if (!agentId) {
      console.error('[Dashboard] No agentId found, returning empty list');
      return of([]);
    }

    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.get<any>(`${this.apiUrl}/agent/claims`, {
      params: { agentId: agentId.toString() },
      headers: headers
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
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.get<any>(`${this.apiUrl}/customer/policies`, { headers }).pipe(
      map(response => response.policies || response),
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

    // Mock policies with user association - dynamically use current user ID
    const allPolicies = [
      { policyId: 101, userId: userId, policyType: 'HEALTH', status: 'Active', premiumAmount: 5000 },
      { policyId: 102, userId: userId, policyType: 'AUTO', status: 'Active', premiumAmount: 3000 },
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
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.get<any>(`${this.apiUrl}/customer/claims`, { headers }).pipe(
      map(response => response.claims || response),
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

    // Mock claims with user association - dynamically use current user ID
    const allClaims = [
      { claimId: 1, userId: userId, claimStatus: 'Pending Review', claimAmount: 2000, policyId: 101 },
      { claimId: 2, userId: userId, claimStatus: 'Approved', claimAmount: 1500, policyId: 102 },
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
    const token = this.authService.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.get<any>(`${this.apiUrl}/customer/payments`, { headers }).pipe(
      map(response => response.payments || response),
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

    // Mock payments with user association - dynamically use current user ID
    const allPayments = [
      { paymentId: 1, userId: userId, amount: 5000, date: '2024-01-15', name: 'Health Insurance Premium', size: '2.1 MB', uploaded: '2 days ago' },
      { paymentId: 2, userId: userId, amount: 3000, date: '2024-01-20', name: 'Auto Insurance Premium', size: '1.8 MB', uploaded: '1 week ago' },
      { paymentId: 3, userId: 4, amount: 10000, date: '2024-01-10', name: 'Life Insurance Premium', size: '3.2 MB', uploaded: '3 days ago' },
      { paymentId: 4, userId: 5, amount: 2500, date: '2024-01-25', name: 'Home Insurance Premium', size: '1.5 MB', uploaded: '5 days ago' }
    ];

    const filteredPayments = allPayments.filter(p => p.userId === userId);
    console.log('[Dashboard] Filtered customer payments:', filteredPayments);

    return of(filteredPayments).pipe(delay(200));
  }
}
