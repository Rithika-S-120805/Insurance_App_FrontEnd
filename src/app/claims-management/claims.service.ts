import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

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
    return this.http.get<Claim[]>(this.apiUrl).pipe(
      tap(claims => this.claimsSignal.set(claims))
    );
  }

  getById(id: string): Observable<Claim> {
    return this.http.get<Claim>(`${this.apiUrl}/${id}`);
  }

  create(claim: Claim): Observable<Claim> {
    console.log('Creating claim:', claim);
    
    // Create a clean payload with only the necessary fields for the API
    const payload = {
      claimAmount: claim.claimAmount,
      claimStatus: claim.claimStatus,
      dateFiled: claim.dateFiled,
      policy_id: claim.policy_id,
      description: claim.description,
      documents: claim.documents || '' // Ensure documents is not null
    };
    
    console.log('Clean payload for API:', JSON.stringify(payload));
    
    return this.http.post<Claim>(this.apiUrl, payload).pipe(
      tap(newClaim => {
        console.log('Claim created successfully:', newClaim);
        this.claimsSignal.update(p => [...p, newClaim]);
      })
    );
  }

  update(id: string, claim: Claim): Observable<Claim> {
    console.log('Updating claim:', claim);
    
    // Create a clean payload with only the necessary fields for the API
    const payload = {
      claimId: claim.claimId,
      claimAmount: claim.claimAmount,
      claimStatus: claim.claimStatus,
      dateFiled: claim.dateFiled,
      policy_id: claim.policy_id,
      description: claim.description,
      documents: claim.documents || '' // Ensure documents is not null
    };
    
    console.log('Clean payload for API:', JSON.stringify(payload));
    
    return this.http.put<Claim>(`${this.apiUrl}/${id}`, payload).pipe(
      tap(updatedClaim => {
        console.log('Claim updated successfully:', updatedClaim);
        this.claimsSignal.update(p =>
          p.map(c => (c.claimId?.toString() === id ? updatedClaim : c))
        );
      })
    );
  }

  delete(id: string): Observable<any> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Deleting claim from URL:', url);
    return this.http.delete<any>(url, { responseType: 'text' as 'json' }).pipe(
      tap(() => {
        console.log('Delete successful, updating signal for ID:', id);
        this.claimsSignal.update(p =>
          p.filter(c => c.claimId?.toString() !== id)
        );
      })
    );
  }

  getByUserId(userId: number): Observable<Claim[]> {
    return this.http.get<Claim[]>(`${this.apiUrl}?userId=${userId}`);
  }

  getByAgentId(agentId: number): Observable<Claim[]> {
    return this.http.get<Claim[]>(`${this.apiUrl}?agentId=${agentId}`);
  }
}
