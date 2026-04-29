import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, tap, of } from 'rxjs';

export interface Claimant {
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
  user_id?: number;
}

export interface PolicyInfo {
  policyId: number;
  policyNumber: string;
  coverageType: string;
  premiumAmount: number;
  startDate: string;
  endDate: string;
  status: string;
  policyHolder?: Claimant;
  user?: User;
  user_id?: number;
}

export interface Claim {
  claimId?: number;
  claimAmount: number;
  claimStatus: string;
  status?: string; // mapped field for component
  claimant?: Claimant;
  dateFiled: string;
  claimDate?: string; // mapped field for component
  claimNumber?: string; // mapped field for component
  description: string;
  documents?: string;
  policy?: PolicyInfo;
  policy_id?: number; // API field name
  policyId?: number; // mapped field for component
  customerId?: number | string;
  user_id?: number;
  agent_id?: number;
  isDeleted?: boolean; // soft delete flag
}

@Injectable({
  providedIn: 'root'
})
export class ClaimsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/claims';
  
  // Use a signal for global claim state if needed
  private claimsSignal = signal<Claim[]>([]);
  readonly claims = this.claimsSignal.asReadonly();

  getAll(): Observable<Claim[]> {
    console.log('[ClaimsService] Fetching all claims from:', this.apiUrl);

    // Get authorization token and add to headers
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[ClaimsService] Authorization header added');
    } else {
      console.warn('[ClaimsService] No token found in localStorage');
    }

    return this.http.get<Claim[]>(this.apiUrl, { headers }).pipe(
      tap(claims => {
        console.log('[ClaimsService] Claims fetched successfully:', claims.length);
        console.log('[ClaimsService] Raw response:', claims);
        if (claims.length === 0) {
          console.warn('[ClaimsService] ⚠️ WARNING: Empty response from API. Database may have no claims or backend endpoint may be incorrect.');
        }
        // Filter out soft-deleted claims
        const activeClaims = claims.filter(c => !c.isDeleted);
        this.claimsSignal.set(activeClaims);
      }),
      catchError((error: any) => {
        console.error('[ClaimsService] ❌ Error fetching all claims:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
          url: error.url
        });
        if (error.status === 0) {
          console.error('[ClaimsService] Connection error - backend may not be running');
        }
        return of<Claim[]>([]);
      })
    );
  }

  getById(id: string): Observable<Claim> {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.http.get<Claim>(`${this.apiUrl}/${id}`, { headers });
  }

  create(claim: Claim): Observable<Claim> {
    console.log('Creating claim:', claim);

    const payload = {
      claimAmount: claim.claimAmount,
      claimStatus: claim.claimStatus,
      dateFiled: claim.dateFiled,
      policy_id: claim.policy_id,
      description: claim.description,
      documents: claim.documents || ''
    };

    console.log('Clean payload for API:', JSON.stringify(payload));

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[ClaimsService] ✅ Authorization header added to POST');
    }

    return this.http.post<Claim>(this.apiUrl, payload, { headers }).pipe(
      tap(newClaim => {
        console.log('Claim created successfully:', newClaim);
        this.claimsSignal.update(p => [...p, newClaim]);
      }),
      catchError((error) => {
        console.error('[ClaimsService] ❌ Error creating claim:', error);
        throw error;
      })
    );
  }

  update(id: string, claim: Claim): Observable<Claim> {
    console.log('Updating claim:', claim);

    const payload = {
      claimId: claim.claimId,
      claimAmount: claim.claimAmount,
      claimStatus: claim.claimStatus,
      dateFiled: claim.dateFiled,
      policy_id: claim.policy_id,
      description: claim.description,
      documents: claim.documents || ''
    };

    console.log('Clean payload for API:', JSON.stringify(payload));

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[ClaimsService] ✅ Authorization header added to PUT');
    }

    return this.http.put<Claim>(`${this.apiUrl}/${id}`, payload, { headers }).pipe(
      tap(updatedClaim => {
        console.log('Claim updated successfully:', updatedClaim);
        this.claimsSignal.update(p =>
          p.map(c => (c.claimId?.toString() === id ? updatedClaim : c))
        );
      }),
      catchError((error) => {
        console.error('[ClaimsService] ❌ Error updating claim:', error);
        throw error;
      })
    );
  }

  delete(id: string): Observable<any> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Soft deleting claim from URL:', url);

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[ClaimsService] ✅ Authorization header added to PATCH');
    } else {
      console.warn('[ClaimsService] ⚠️ No token found for PATCH request');
    }

    // Send PATCH to mark as deleted instead of hard DELETE
    const softDeletePayload = { isDeleted: true };

    return this.http.patch<any>(url, softDeletePayload, { headers }).pipe(
      tap(() => {
        console.log('Soft delete successful, updating signal for ID:', id);
        this.claimsSignal.update(p =>
          p.filter(c => c.claimId?.toString() !== id)
        );
      }),
      catchError((error) => {
        console.error('[ClaimsService] ❌ Error deleting claim:', {
          status: error.status,
          url: error.url
        });
        throw error;
      })
    );
  }

  getByUserId(userId: number): Observable<Claim[]> {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.http.get<Claim[]>(`${this.apiUrl}?userId=${userId}`, { headers }).pipe(
      tap(claims => {
        // Filter out soft-deleted claims
        const activeClaims = claims.filter(c => !c.isDeleted);
        this.claimsSignal.update(p => [...p.filter(c => c.user_id !== userId), ...activeClaims]);
      })
    );
  }

  getByAgentId(agentId: number): Observable<Claim[]> {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.http.get<Claim[]>(`${this.apiUrl}?agentId=${agentId}`, { headers }).pipe(
      tap(claims => {
        // Filter out soft-deleted claims
        const activeClaims = claims.filter(c => !c.isDeleted);
        this.claimsSignal.update(p => [...p.filter(c => c.agent_id !== agentId), ...activeClaims]);
      })
    );
  }
}
