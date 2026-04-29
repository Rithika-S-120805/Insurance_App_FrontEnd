import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, tap, of, map } from 'rxjs';

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
  status?: string;
  claimant?: Claimant;
  dateFiled: string;
  claimDate?: string;
  claimNumber?: string;
  description: string;
  documents?: string;

  policy?: PolicyInfo;
  policy_id?: number;
  policyId?: number;

  customerId?: number | string;
  user_id?: number;
  agent_id?: number;

  isDeleted?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ClaimsService {

  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/claims';

  private claimsSignal = signal<Claim[]>([]);
  readonly claims = this.claimsSignal.asReadonly();

  private buildHeaders(): { [key: string]: string } {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: { [key: string]: string } = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private normalizeClaim(raw: any): Claim {
    return {
      claimId: raw.claimId ?? raw.claim_id,
      claimAmount: Number(raw.claimAmount ?? raw.claim_amount ?? 0),
      claimStatus: raw.claimStatus ?? raw.claim_status ?? 'Pending',
      status: raw.claimStatus ?? raw.claim_status,
      dateFiled: raw.dateFiled ?? raw.date_filed ?? '',
      claimDate: raw.dateFiled ?? raw.date_filed,
      claimNumber: raw.claimNumber ?? raw.claim_number,
      description: raw.description ?? '',
      documents: raw.documents ?? '',

      policy_id: Number(
        raw.policy_id ??
        raw.policyId ??
        raw.policy?.policyId
      ),

      policyId: Number(
        raw.policyId ??
        raw.policy_id ??
        raw.policy?.policyId
      ),

      user_id: Number(
        raw.user_id ??
        raw.userId ??
        raw.user?.userId ??
        raw.policy?.user?.userId
      ),

      agent_id: Number(
        raw.agent_id ??
        raw.agentId ??
        raw.agent?.userId
      ),

      customerId: raw.user_id ?? raw.userId,

      policy: raw.policy,
      isDeleted: raw.isDeleted ?? false
    };
  }

  getAll(): Observable<Claim[]> {
    const headers = this.buildHeaders();

    return this.http.get<any[]>(this.apiUrl, { headers }).pipe(
      map(claims => claims.map(c => this.normalizeClaim(c))),
      tap(claims => {
        const activeClaims = claims.filter(c => !c.isDeleted);
        this.claimsSignal.set(activeClaims);
      }),
      catchError(error => {
        console.error('[ClaimsService] Error loading claims:', error);
        return of([]);
      })
    );
  }

  getById(id: string): Observable<Claim> {
    const headers = this.buildHeaders();

    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers }).pipe(
      map(claim => this.normalizeClaim(claim))
    );
  }

  create(claim: Claim): Observable<Claim> {
    const headers = this.buildHeaders();

    const payload = {
      claimAmount: claim.claimAmount,
      claimStatus: claim.claimStatus,
      dateFiled: claim.dateFiled,
      policy_id: claim.policy_id,
      description: claim.description,
      documents: claim.documents || ''
    };

    return this.http.post<any>(this.apiUrl, payload, { headers }).pipe(
      map(claim => this.normalizeClaim(claim)),
      tap(newClaim => {
        this.claimsSignal.update(c => [...c, newClaim]);
      })
    );
  }

  update(id: string, claim: Claim): Observable<Claim> {
    const headers = this.buildHeaders();

    const payload = {
      claimAmount: claim.claimAmount,
      claimStatus: claim.claimStatus,
      dateFiled: claim.dateFiled,
      policy_id: claim.policy_id,
      description: claim.description,
      documents: claim.documents || ''
    };

    return this.http.put<any>(`${this.apiUrl}/${id}`, payload, { headers }).pipe(
      map(claim => this.normalizeClaim(claim)),
      tap(updatedClaim => {
        this.claimsSignal.update(list =>
          list.map(c =>
            c.claimId === updatedClaim.claimId ? updatedClaim : c
          )
        );
      })
    );
  }

  delete(id: string): Observable<any> {
    const headers = this.buildHeaders();

    return this.http.patch<any>(
      `${this.apiUrl}/${id}`,
      { isDeleted: true },
      { headers }
    ).pipe(
      tap(() => {
        this.claimsSignal.update(list =>
          list.filter(c => c.claimId?.toString() !== id)
        );
      })
    );
  }

  getByUserId(userId: number): Observable<Claim[]> {
    const headers = this.buildHeaders();

    return this.http.get<any[]>(`${this.apiUrl}?userId=${userId}`, { headers }).pipe(
      map(claims => claims.map(c => this.normalizeClaim(c)))
    );
  }

  getByAgentId(agentId: number): Observable<Claim[]> {
    const headers = this.buildHeaders();

    return this.http.get<any[]>(`${this.apiUrl}?agentId=${agentId}`, { headers }).pipe(
      map(claims => claims.map(c => this.normalizeClaim(c)))
    );
  }
}