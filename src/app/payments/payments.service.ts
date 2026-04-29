import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, catchError, of } from 'rxjs';

export interface Payment {
  paymentId?: number;
  claimId: number;
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

  // Use a signal for global payment state if needed
  private paymentsSignal = signal<Payment[]>([]);
  readonly payments = this.paymentsSignal.asReadonly();

  private normalizePayment(raw: any): Payment {
  return {
    paymentId: raw.paymentId ?? raw.id ?? raw.payment_id,
    claimId: Number(raw.claimId ?? raw.claim_id ?? raw.claim?.claimId),
    userId: Number(raw.userId ?? raw.user_id ?? raw.claim?.userId),
    paymentType: raw.paymentType ?? raw.payment_type,
    amount: Number(raw.amount ?? raw.paymentAmount ?? raw.amountPaid ?? 0),
    paymentDate: raw.paymentDate ?? raw.payment_date ?? raw.date ?? '',
    paymentMethod: raw.paymentMethod ?? raw.payment_method ?? raw.method ?? '',
    status: raw.status ?? raw.payment_status ?? raw.paymentStatus ?? 'Pending',
    payment_status: raw.payment_status ?? raw.paymentStatus,
    transactionId: raw.transactionId ?? raw.transaction_id,
    payment_reference: raw.payment_reference ?? raw.paymentReference,
    notes: raw.notes ?? raw.note ?? '',
    claim: raw.claim
  };
}

  private buildAuthHeaders(): { [key: string]: string } {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const headers: { [key: string]: string } = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  getAll(): Observable<Payment[]> {
  console.log('[PaymentsService] Fetching all payments from:', this.apiUrl);

  // Get authorization token and add to headers
  const headers = this.buildAuthHeaders();
  if (headers['Authorization']) {
    console.log('[PaymentsService] Authorization header added');
  } else {
    console.warn('[PaymentsService] No token found in localStorage');
  }

  return this.http.get<any[]>(this.apiUrl, { headers }).pipe(
    map(rawPayments => rawPayments.map(rawPayment => this.normalizePayment(rawPayment))),
    tap(payments => {
      console.log('[PaymentsService] Payments fetched successfully:', payments.length);
      console.log('[PaymentsService] Raw response:', payments);

      if (payments.length === 0) {
        console.warn('[PaymentsService] ⚠️ WARNING: Empty response from API.');
      }

      this.paymentsSignal.set(payments);
    }),
    catchError((error: any) => {
      console.error('[PaymentsService] ❌ Error fetching all payments:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        body: error.error,
        url: error.url
      });

      if (error.status === 0) {
        console.error('[PaymentsService] Connection error - backend may not be running');
      }

      return of([]);
    })
  );
}

  getById(id: string): Observable<Payment> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(rawPayment => this.normalizePayment(rawPayment)),
      tap(payment => this.paymentsSignal.update(payments =>
        payments.map(p =>
          p.paymentId === payment.paymentId ? payment : p
        )
      ))
    );
  }

  create(payment: Payment): Observable<Payment> {
  console.log('Creating payment:', payment);

  const userId = Number(localStorage.getItem('userId'));

  const payload = {
    claimId: payment.claimId,
    claim_id: payment.claimId,
    userId: userId,
    user_id: userId,
    paymentType: payment.paymentType,
    amount: payment.amount,
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    payment_status: payment.payment_status || payment.status,
    paymentStatus: payment.payment_status || payment.status,
    payment_reference: payment.payment_reference || payment.transactionId || '',
    paymentReference: payment.payment_reference || payment.transactionId || '',
    notes: payment.notes || ''
  };

  console.log('Clean payload for API:', JSON.stringify(payload));

  const headers = this.buildAuthHeaders();

  return this.http.post<Payment>(this.apiUrl, payload, { headers }).pipe(
    map(raw => this.normalizePayment(raw)),
    tap(newPayment => {
      console.log('Payment created successfully:', newPayment);
      this.paymentsSignal.update(p => [...p, newPayment]);
    })
  );
}


  update(id: string, payment: Payment): Observable<Payment> {
    console.log('Updating payment:', payment);

    const userId = Number(localStorage.getItem('userId'));

    // Create a clean payload with API field names
    const payload = {
  claimId: payment.claimId,
  claim_id: payment.claimId,
  userId: userId,
  user_id: userId,
  paymentType: payment.paymentType,
  amount: payment.amount,
  paymentDate: payment.paymentDate,
  paymentMethod: payment.paymentMethod,
  payment_status: payment.payment_status || payment.status,
  paymentStatus: payment.payment_status || payment.status,
  payment_reference: payment.payment_reference || payment.transactionId || '',
  paymentReference: payment.payment_reference || payment.transactionId || '',
  notes: payment.notes || ''
};

    const headers = this.buildAuthHeaders();
    if (headers['Authorization']) {
      console.log('[PaymentsService] ✅ Authorization header added to PUT');
    }

    return this.http.put<any>(`${this.apiUrl}/${id}`, payload, { headers }).pipe(
      map(rawPayment => this.normalizePayment(rawPayment)),
      tap(updatedPayment => {
        console.log('Payment updated successfully:', updatedPayment);
        this.paymentsSignal.update(payments =>
          payments.map(p => p.paymentId === updatedPayment.paymentId ? updatedPayment : p)
        );
      })
    );
  }

  delete(id: string): Observable<void> {
    const headers = this.buildAuthHeaders();
    if (headers['Authorization']) {
      console.log('[PaymentsService] ✅ Authorization header added to DELETE');
    }

    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers }).pipe(
      tap(() => {
        console.log('Payment deleted successfully');
        this.paymentsSignal.update(payments =>
          payments.filter(p => p.paymentId !== +id)
        );
      })
    );
  }
}