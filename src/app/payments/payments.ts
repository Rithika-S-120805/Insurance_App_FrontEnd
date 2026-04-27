import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PaymentsService, Payment } from './payments.service';
import { ClaimsService, Claim } from '../claims-management/claims.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  templateUrl: './payments.html',
  styleUrl: './payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule]
})
export class PaymentsComponent implements OnInit {
  private paymentsService = inject(PaymentsService);
  private claimsService = inject(ClaimsService);
  private fb = inject(FormBuilder);

  payments = signal<Payment[]>([]);
  claims = signal<Claim[]>([]);
  selectedPayment = signal<Payment | null>(null);
  showForm = signal(false);
  isEditMode = signal(false);
  searchTerm = signal('');
  selectedStatus = signal('all');
  successMessage = signal('');
  showSuccessMessage = signal(false);
  showDeleteConfirm = signal(false);
  paymentToDelete = signal<any>(null);

  paymentForm!: FormGroup;

  statuses = ['Completed', 'Pending', 'Failed'];
  paymentMethods = ['Credit Card', 'Debit Card', 'Bank Transfer', 'Cash', 'Check'];

  filteredPayments = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const status = this.selectedStatus();

    return this.payments().filter(payment => {
      const matchesSearch =
        (payment.paymentId?.toString().toLowerCase().includes(search) || false) ||
        (payment.payment_reference?.toLowerCase().includes(search) || false) ||
        (payment.transactionId?.toLowerCase().includes(search) || false) ||
        (payment.claim?.claimNumber?.toLowerCase().includes(search) || false);
      const matchesStatus = status === 'all' || 
        (payment.payment_status || payment.status) === status;
      return matchesSearch && matchesStatus;
    });
  });

  ngOnInit(): void {
    this.initializeForm();
    this.loadClaims().then(() => {
      this.loadPayments();
    });
  }

  private initializeForm(): void {
    this.paymentForm = this.fb.group({
      claimId: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0)]],
      paymentDate: [new Date().toISOString().split('T')[0], Validators.required],
      paymentMethod: ['', Validators.required],
      payment_status: ['Completed', Validators.required],
      payment_reference: [''],
      notes: ['']
    });
  }

  private loadPayments(): void {
    this.paymentsService.getAll().subscribe({
      next: (payments) => {
        console.log('Raw payments from API:', payments);
        // Populate claim relationships using normalized claim IDs
        const paymentsWithClaims = payments.map(payment => ({
          ...payment,
          claim: payment.claim ?? this.claims().find(claim =>
            claim.claimId !== undefined && payment.claimId !== undefined &&
            Number(claim.claimId) === Number(payment.claimId)
          )
        }));
        console.log('Payments with claims:', paymentsWithClaims);
        this.payments.set(paymentsWithClaims);
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.showSuccessMessage.set(true);
        this.successMessage.set('Failed to load payments. Please try again.');
      }
    });
  }

  private loadClaims(): Promise<void> {
    return new Promise((resolve) => {
      this.claimsService.getAll().subscribe({
        next: (claims) => {
          console.log('Loaded claims for payments:', claims);
          this.claims.set(claims);
          resolve();
        },
        error: (error) => {
          console.error('Error loading claims:', error);
          resolve(); // Resolve anyway to continue loading payments
        }
      });
    });
  }

  openAddForm(): void {
    this.isEditMode.set(false);
    this.selectedPayment.set(null);
    this.paymentForm.reset({
      claimId: '',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: '',
      payment_status: 'Completed',
      payment_reference: '',
      notes: ''
    });
    this.showForm.set(true);
  }

  openEditForm(payment: Payment): void {
    this.isEditMode.set(true);
    this.selectedPayment.set(payment);
    this.paymentForm.patchValue({
      claimId: payment.claimId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      payment_status: payment.payment_status || payment.status,
      payment_reference: payment.payment_reference || payment.transactionId || '',
      notes: payment.notes || ''
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedPayment.set(null);
    this.isEditMode.set(false);
  }

  savePayment(): void {
    if (this.paymentForm.invalid) {
      this.showSuccessMessage.set(true);
      this.successMessage.set('Please fill in all required fields correctly.');
      return;
    }

    const formValue = this.paymentForm.value;
    const paymentData: Payment = {
      ...formValue,
      claimId: +formValue.claimId,
      amount: +formValue.amount
    };

    if (this.isEditMode()) {
      // Update existing payment
      const paymentId = this.selectedPayment()?.paymentId?.toString();
      if (paymentId) {
        this.paymentsService.update(paymentId, paymentData).subscribe({
          next: () => {
            this.showSuccessMessage.set(true);
            this.successMessage.set('Payment updated successfully!');
            this.closeForm();
            this.loadPayments(); // Refresh the list
          },
          error: (error) => {
            console.error('Error updating payment:', error);
            this.showSuccessMessage.set(true);
            this.successMessage.set('Failed to update payment. Please try again.');
          }
        });
      }
    } else {
      // Create new payment
      this.paymentsService.create(paymentData).subscribe({
        next: () => {
          this.showSuccessMessage.set(true);
          this.successMessage.set('Payment created successfully!');
          this.closeForm();
          this.loadPayments(); // Refresh the list
        },
        error: (error) => {
          console.error('Error creating payment:', error);
          this.showSuccessMessage.set(true);
          this.successMessage.set('Failed to create payment. Please try again.');
        }
      });
    }
  }

  deletePayment(payment: Payment): void {
    this.paymentToDelete.set(payment);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    const payment = this.paymentToDelete();
    if (payment?.paymentId) {
      this.paymentsService.delete(payment.paymentId.toString()).subscribe({
        next: () => {
          this.showSuccessMessage.set(true);
          this.successMessage.set('Payment deleted successfully!');
          this.showDeleteConfirm.set(false);
          this.paymentToDelete.set(null);
          this.loadPayments(); // Refresh the list
        },
        error: (error) => {
          console.error('Error deleting payment:', error);
          this.showSuccessMessage.set(true);
          this.successMessage.set('Failed to delete payment. Please try again.');
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.paymentToDelete.set(null);
  }

  getClaimInfo(claimId: number): Claim | undefined {
    return this.claims().find(c => c.claimId === claimId);
  }
}