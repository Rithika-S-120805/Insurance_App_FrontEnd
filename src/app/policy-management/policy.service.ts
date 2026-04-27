import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, catchError } from 'rxjs';

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

  getAll(): Observable<Policy[]> {
    console.log('[PolicyService] Fetching all policies');
    return this.http.get<Policy[]>(this.apiUrl).pipe(
      tap(policies => {
        console.log('[PolicyService] Policies fetched successfully:', policies.length);
        this.policiesSignal.set(policies);
      }),
      catchError((error) => {
        console.error('[PolicyService] Error fetching all policies:', {
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

  getById(id: string): Observable<Policy> {
    return this.http.get<Policy>(`${this.apiUrl}/${id}`);
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
    
    return this.http.post<Policy>(this.apiUrl, payload).pipe(
      tap(newPolicy => {
        console.log('Policy created successfully:', newPolicy);
        console.log('Created policy user_id:', newPolicy.user_id);
        console.log('Created policy user object:', newPolicy.user);
        this.policiesSignal.update(p => [...p, newPolicy]);
      })
    );
  }

  update(id: string, policy: Policy): Observable<Policy> {
    return this.http.put<Policy>(`${this.apiUrl}/${id}`, policy).pipe(
      tap(updated => this.policiesSignal.update(ps => ps.map(p => p.policyId?.toString() === id ? updated : p)))
    );
  }

  delete(id: string): Observable<any> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Deleting policy from URL:', url);
    return this.http.delete<any>(url, { responseType: 'text' as 'json' }).pipe(
      tap(() => {
        console.log('Delete successful, updating signal for ID:', id);
        this.policiesSignal.update(ps => ps.filter(p => p.policyId?.toString() !== id));
      })
    );
  }

  getUserById(userId: number): Observable<User> {
    if (this.userCache.has(userId)) {
      return of(this.userCache.get(userId)!);
    }
    return this.http.get<User>(`${this.usersApiUrl}/${userId}`).pipe(
      tap(user => this.userCache.set(userId, user))
    );
  }

  getByUserId(userId: number): Observable<Policy[]> {
    console.log('[PolicyService] Fetching policies for user:', userId);
    return this.http.get<Policy[]>(`${this.apiUrl}?userId=${userId}`).pipe(
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
    return this.http.get<Policy[]>(`${this.apiUrl}?agentId=${agentId}`).pipe(
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
