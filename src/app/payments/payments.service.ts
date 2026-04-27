import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

export interface Payment {
  paymentId?: number;
  claimId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  status: string;
  payment_status?: string; // API field name
  transactionId?: string;
  payment_reference?: string; // API field name
  notes?: string;
  claim?: any; // Populated claim relationship
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

  getAll(): Observable<Payment[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(rawPayments => rawPayments.map(rawPayment => this.normalizePayment(rawPayment))),
      tap(payments => this.paymentsSignal.set(payments))
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

    // Create a clean payload with API field names
    const payload = {
      claimId: payment.claimId,
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

    return this.http.post<Payment>(this.apiUrl, payload).pipe(
      tap(newPayment => {
        const normalized = this.normalizePayment(newPayment);
        console.log('Payment created successfully:', normalized);
        this.paymentsSignal.update(p => [...p, normalized]);
      })
    );
  }

  update(id: string, payment: Payment): Observable<Payment> {
    console.log('Updating payment:', payment);

    // Create a clean payload with API field names
    const payload = {
      claimId: payment.claimId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      payment_status: payment.payment_status || payment.status,
      paymentStatus: payment.payment_status || payment.status,
      payment_reference: payment.payment_reference || payment.transactionId || '',
      paymentReference: payment.payment_reference || payment.transactionId || '',
      notes: payment.notes || ''
    };

    return this.http.put<any>(`${this.apiUrl}/${id}`, payload).pipe(
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
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        console.log('Payment deleted successfully');
        this.paymentsSignal.update(payments =>
          payments.filter(p => p.paymentId !== +id)
        );
      })
    );
  }
}