import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, catchError, of } from 'rxjs';

export interface Payment {
  paymentId?: number;
  claimId?: number;
  policyId?: number;
  userId?: number;
  paymentType?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  status: string;
  payment_status?: string;
  transactionId?: string;
  payment_reference?: string;
  notes?: string;
  claim?: any;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentsService {

  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/payments';

  private paymentsSignal = signal<Payment[]>([]);
  readonly payments = this.paymentsSignal.asReadonly();

  private normalizePayment(raw: any): Payment {
    return {
      paymentId: raw.paymentId ?? raw.payment_id ?? raw.id,
      claimId: Number(raw.claimId ?? raw.claim_id ?? raw.claim?.claimId ?? 0),
      policyId: Number(raw.policyId ?? raw.policy_id ?? raw.policy?.policyId ?? 0),
      userId: Number(raw.userId ?? raw.user_id ?? raw.user?.userId ?? 0),
      paymentType: raw.paymentType ?? raw.payment_type ?? '',
      amount: Number(raw.amount ?? 0),
      paymentDate: raw.paymentDate ?? raw.payment_date ?? '',
      paymentMethod: raw.paymentMethod ?? raw.payment_method ?? '',
      status: raw.paymentStatus ?? raw.payment_status ?? raw.status ?? 'Pending',
      payment_status: raw.paymentStatus ?? raw.payment_status,
      transactionId: raw.transactionId ?? raw.transaction_id,
      payment_reference: raw.paymentReference ?? raw.payment_reference,
      notes: raw.remarks ?? raw.notes ?? '',
      claim: raw.claim
    };
  }

  private buildAuthHeaders(): { [key: string]: string } {
    const token =
      localStorage.getItem('authToken') ||
      localStorage.getItem('token');

    const headers: { [key: string]: string } = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  getAll(): Observable<Payment[]> {

    const headers = this.buildAuthHeaders();

    return this.http.get<any[]>(this.apiUrl, { headers }).pipe(
      map(response => response.map((item: any) => this.normalizePayment(item))),
      tap(payments => {
        console.log('[PaymentsService] Loaded payments:', payments);
        this.paymentsSignal.set(payments);
      }),
      catchError(error => {
        console.error('[PaymentsService] Error loading payments:', error);
        return of([]);
      })
    );
  }

  getById(id: string): Observable<Payment> {

    const headers = this.buildAuthHeaders();

    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers }).pipe(
      map(raw => this.normalizePayment(raw))
    );
  }

  create(payment: Payment): Observable<Payment> {

  const userId = Number(localStorage.getItem('userId'));

  const payload = {
    claim_id: payment.claimId || null,
    user_id: userId,

    paymentType: payment.paymentType,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    paymentStatus: payment.payment_status || payment.status,
    paymentDate: payment.paymentDate,

    remarks: payment.notes || '',
    referenceNumber: payment.transactionId || null,

    paymentReference:
      payment.payment_reference ||
      'PAY-' + Date.now(),

    transactionDate: payment.paymentDate
  };

  console.log('Sending payload:', payload);

  const headers = this.buildAuthHeaders();

  return this.http.post<any>(this.apiUrl, payload, { headers }).pipe(
    map(raw => this.normalizePayment(raw))
  );
}

  update(id: string, payment: Payment): Observable<Payment> {

    const headers = this.buildAuthHeaders();

    const loggedUserId = Number(localStorage.getItem('userId'));

    const payload = {
      claim_id: payment.claimId || null,
      policy_id: payment.policyId || null,
      user_id: payment.userId || loggedUserId,

      paymentType: payment.paymentType,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,

      paymentStatus:
        payment.payment_status ||
        payment.status,

      paymentReference:
        payment.payment_reference ||
        payment.transactionId ||
        '',

      remarks: payment.notes || ''
    };

    console.log('[PaymentsService] UPDATE PAYLOAD:', payload);

    return this.http.put<any>(`${this.apiUrl}/${id}`, payload, { headers }).pipe(
      map(raw => this.normalizePayment(raw)),
      tap(updatedPayment => {

        this.paymentsSignal.update(payments =>
          payments.map(p =>
            p.paymentId === updatedPayment.paymentId
              ? updatedPayment
              : p
          )
        );
      })
    );
  }

  delete(id: string): Observable<void> {

    const headers = this.buildAuthHeaders();

    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers }).pipe(
      tap(() => {

        this.paymentsSignal.update(payments =>
          payments.filter(p => p.paymentId !== Number(id))
        );
      })
    );
  }
}