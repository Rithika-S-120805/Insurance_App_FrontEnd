import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, catchError, map } from 'rxjs';

export interface PolicyHolder {
  id: number;
  name: string;
  email: string;
  status: string;
}

export interface User {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

export interface Policy {
  policyId: number;
  policyNumber: string;
  policyType: string;
  coverageType?: string;
  premiumAmount: number;
  startDate: string;
  endDate: string;
  status: string;
  sumInsured?: number;
  termInMonths?: number;
  createdDate?: string;
  updatedDate?: string;
  user?: User;
  policyHolder?: PolicyHolder;
  customerId?: number | string;
  user_id?: number;
  agent_id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PolicyService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/policies';
  private usersApiUrl = 'http://localhost:8080/api/users';
  private userCache = new Map<number, User>();
  
  // Use a signal for global policy state if needed
  private policiesSignal = signal<Policy[]>([]);
  readonly policies = this.policiesSignal.asReadonly();

  /**
   * Normalize policy data from backend response
   * Maps backend fields to Policy interface, calculating missing dates and using defaults
   */
  private normalizePolicy(raw: any): Policy {
    // Calculate end date from term in months if available
    let startDate = raw.startDate || raw.start_date || raw.createdDate || new Date().toISOString().split('T')[0];
    let endDate = raw.endDate || raw.end_date;
    
    if (!endDate) {
      const startDateObj = new Date(startDate);
      const termMonths = raw.termInMonths || raw.term_in_months || 12;
      const endDateObj = new Date(startDateObj);
      endDateObj.setMonth(endDateObj.getMonth() + termMonths);
      endDate = endDateObj.toISOString().split('T')[0];
    }

    return {
      policyId: raw.policyId ?? raw.id ?? raw.policy_id ?? 0,
      policyNumber: raw.policyNumber ?? raw.policy_number ?? `POL-${raw.policyId || ''}`,
      policyType: raw.policyType ?? raw.policy_type ?? 'Standard',
      coverageType: raw.coverageType ?? raw.coverage_type ?? '',
      premiumAmount: Number(raw.premiumAmount ?? raw.premium_amount ?? raw.sumInsured ?? raw.sum_insured ?? 0),
      startDate: startDate,
      endDate: endDate,
      status: raw.status ?? raw.policy_status ?? 'Active',
      sumInsured: Number(raw.sumInsured ?? raw.sum_insured ?? 0),
      termInMonths: Number(raw.termInMonths ?? raw.term_in_months ?? 12),
      createdDate: raw.createdDate ?? raw.created_date,
      updatedDate: raw.updatedDate ?? raw.updated_date,
      user: raw.user,
      policyHolder: raw.policyHolder ?? raw.policy_holder,
      customerId: raw.customerId ?? raw.customer_id,
      user_id: raw.user_id ?? raw.userId,
      agent_id: raw.agent_id ?? raw.agentId
    };
  }

  getAll(): Observable<Policy[]> {
    console.log('[PolicyService] Fetching all policies from:', this.apiUrl);
    
    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[PolicyService] ✅ Authorization header added:', token.substring(0, 30) + '...');
    } else {
      console.warn('[PolicyService] ⚠️ No token found in localStorage');
    }
    
    return this.http.get<any[]>(this.apiUrl, { headers }).pipe(
      tap(rawPolicies => {
        console.log('[PolicyService] Raw response from API:', rawPolicies);
      }),
      map(rawPolicies => {
        // Normalize policies from backend response
        const normalizedPolicies = rawPolicies.map(raw => this.normalizePolicy(raw));
        
        console.log('[PolicyService] Policies fetched successfully:', normalizedPolicies.length);
        console.log('[PolicyService] Normalized policies:', normalizedPolicies);
        
        if (normalizedPolicies.length === 0) {
          console.warn('[PolicyService] ⚠️ WARNING: Empty response from API. Database may have no policies or backend endpoint may be incorrect.');
        }
        
        this.policiesSignal.set(normalizedPolicies);
        return normalizedPolicies;
      }),
      catchError((error) => {
        console.error('[PolicyService] ❌ Error fetching all policies:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
          url: error.url,
          timestamp: new Date().toISOString()
        });
        
        // Check for specific error types
        if (error.status === 401) {
          console.error('[PolicyService] Authentication failed - token may be expired or invalid');
        } else if (error.status === 403) {
          console.error('[PolicyService] Authorization failed - user may not have permission');
        } else if (error.status === 0) {
          console.error('[PolicyService] Connection error - backend server may not be running');
        }
        
        return of([]);
      })
    );
  }

  getById(id: string): Observable<Policy> {
    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers }).pipe(
      map(raw => this.normalizePolicy(raw))
    );
  }

  create(policy: Policy): Observable<Policy> {
    console.log('Creating policy:', policy);
    console.log('Request payload:', JSON.stringify(policy));
    console.log('user_id in payload:', policy.user_id);

    // Create a clean payload with only the necessary fields
    const payload = {
      policyNumber: policy.policyNumber,
      policyType: policy.policyType,
      coverageType: policy.coverageType,
      premiumAmount: policy.premiumAmount,
      startDate: policy.startDate,
      endDate: policy.endDate,
      status: policy.status,
      sumInsured: policy.sumInsured,
      termInMonths: policy.termInMonths,
      user_id: policy.user_id
    };

    console.log('CLEAN PAYLOAD TO SEND:', JSON.stringify(payload));
    console.log('Payload fields:', Object.keys(payload));
    console.log('user_id in clean payload:', payload.user_id);

    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }

    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[PolicyService] ✅ Authorization header added to POST:', token.substring(0, 30) + '...');
    } else {
      console.warn('[PolicyService] ⚠️ No token found for POST request');
    }

    return this.http.post<Policy>(this.apiUrl, payload, { headers }).pipe(
      tap(newPolicy => {
        console.log('Policy created successfully:', newPolicy);
        console.log('Created policy user_id:', newPolicy.user_id);
        console.log('Created policy user object:', newPolicy.user);
        this.policiesSignal.update(p => [...p, newPolicy]);
      }),
      catchError((error) => {
        console.error('[PolicyService] ❌ Error creating policy:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url
        });
        throw error;
      })
    );
  }

  update(id: string, policy: Policy): Observable<Policy> {
    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }

    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[PolicyService] ✅ Authorization header added to PUT:', token.substring(0, 30) + '...');
    } else {
      console.warn('[PolicyService] ⚠️ No token found for PUT request');
    }

    return this.http.put<Policy>(`${this.apiUrl}/${id}`, policy, { headers }).pipe(
      tap(updated => {
        console.log('[PolicyService] Policy updated successfully');
        this.policiesSignal.update(ps => ps.map(p => p.policyId?.toString() === id ? updated : p));
      }),
      catchError((error) => {
        console.error('[PolicyService] ❌ Error updating policy:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url
        });
        throw error;
      })
    );
  }

  delete(id: string): Observable<any> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Deleting policy from URL:', url);

    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }

    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[PolicyService] ✅ Authorization header added to DELETE:', token.substring(0, 30) + '...');
    } else {
      console.warn('[PolicyService] ⚠️ No token found for DELETE request');
    }

    return this.http.delete<any>(url, { headers, responseType: 'text' as 'json' }).pipe(
      tap(() => {
        console.log('Delete successful, updating signal for ID:', id);
        this.policiesSignal.update(ps => ps.filter(p => p.policyId?.toString() !== id));
      }),
      catchError((error) => {
        console.error('[PolicyService] ❌ Error deleting policy:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url
        });
        throw error;
      })
    );
  }

  getUserById(userId: number): Observable<User> {
    if (this.userCache.has(userId)) {
      return of(this.userCache.get(userId)!);
    }

    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }

    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<User>(`${this.usersApiUrl}/${userId}`, { headers }).pipe(
      tap(user => this.userCache.set(userId, user)),
      catchError((error) => {
        console.error('[PolicyService] ❌ Error fetching user:', {
          status: error.status,
          userId: userId
        });
        throw error;
      })
    );
  }

  getByUserId(userId: number): Observable<Policy[]> {
    console.log('[PolicyService] Fetching policies for user:', userId);
    
    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.http.get<any[]>(`${this.apiUrl}?userId=${userId}`, { headers }).pipe(
      map(rawPolicies => rawPolicies.map(raw => this.normalizePolicy(raw))),
      tap(normalized => console.log('[PolicyService] User policies fetched:', normalized.length)),
      catchError((error) => {
        console.error('[PolicyService] Error fetching user policies:', {
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

  getByAgentId(agentId: number): Observable<Policy[]> {
    console.log('[PolicyService] Fetching policies for agent:', agentId);
    
    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.http.get<any[]>(`${this.apiUrl}?agentId=${agentId}`, { headers }).pipe(
      map(rawPolicies => rawPolicies.map(raw => this.normalizePolicy(raw))),
      tap(normalized => console.log('[PolicyService] Agent policies fetched:', normalized.length)),
      catchError((error) => {
        console.error('[PolicyService] Error fetching agent policies:', {
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
}
