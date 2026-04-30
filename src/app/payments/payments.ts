import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { PaymentsService, Payment } from './payments.service';
import { ClaimsService, Claim } from '../claims-management/claims.service';
import { UserService } from '../services/user.service';
import { UserRole } from '../models/user.model';

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
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  payments = signal<Payment[]>([]);
  claims = signal<Claim[]>([]);

  selectedPayment = signal<Payment | null>(null);

  showForm = signal(false);
  isEditMode = signal(false);

  paymentsSearchText = signal('');
  paymentsStatusFilter = signal('');
  paymentsMethodFilter = signal('');
  paymentsMinAmount = signal<number | null>(null);
  paymentsMaxAmount = signal<number | null>(null);

  successMessage = signal('');
  showSuccessMessage = signal(false);

  showDeleteConfirm = signal(false);
  paymentToDelete = signal<Payment | null>(null);

  paymentForm!: FormGroup;

  currentUser = signal(this.userService.getCurrentUser());

  canAddPayments = computed(() => {
    const role = this.currentUser()?.role;
    // Allow admins and customers to add payments from the payments UI
    return role === UserRole.ADMIN || role === UserRole.CUSTOMER;
  });

  canManagePayments = computed(() => {
    const role = this.currentUser()?.role;
    // Only admins can manage (edit/delete) payments
    return role === UserRole.ADMIN;
  });

  isCustomer = computed(() =>
    this.currentUser()?.role === UserRole.CUSTOMER
  );

  statuses = ['Completed', 'Pending', 'Failed'];

  paymentMethods = [
    'Credit Card',
    'Debit Card',
    'Bank Transfer',
    'Cash',
    'Check'
  ];

  filteredPayments = computed(() => {

    let filtered = [...this.payments()];

    if (this.paymentsSearchText()) {
      const search = this.paymentsSearchText().toLowerCase();

      filtered = filtered.filter(payment =>
        String(payment.paymentId ?? '').toLowerCase().includes(search) ||
        (payment.paymentMethod ?? '').toLowerCase().includes(search) ||
        (payment.payment_reference ?? '').toLowerCase().includes(search)
      );
    }

    if (this.paymentsStatusFilter()) {
      filtered = filtered.filter(payment =>
        (payment.status ?? '').toLowerCase() ===
        this.paymentsStatusFilter().toLowerCase()
      );
    }

    if (this.paymentsMethodFilter()) {
      filtered = filtered.filter(payment =>
        (payment.paymentMethod ?? '').toLowerCase() ===
        this.paymentsMethodFilter().toLowerCase()
      );
    }

    if (this.paymentsMinAmount() !== null) {
      filtered = filtered.filter(payment =>
        payment.amount >= this.paymentsMinAmount()!
      );
    }

    if (this.paymentsMaxAmount() !== null) {
      filtered = filtered.filter(payment =>
        payment.amount <= this.paymentsMaxAmount()!
      );
    }

    return filtered;
  });

  uniquePaymentMethods = computed(() => {
    const methods = new Set(
      this.payments()
        .map(payment => payment.paymentMethod)
        .filter(Boolean)
    );

    return Array.from(methods).sort();
  });

  ngOnInit(): void {
    this.initializeForm();
    this.loadClaims();
    this.loadPayments();
  }

  private initializeForm(): void {

    this.paymentForm = this.fb.group({
      claimId: ['', Validators.required],
      paymentType: ['Premium', Validators.required],
      amount: ['', [Validators.required, Validators.min(1)]],
      paymentDate: [
        new Date().toISOString().split('T')[0],
        Validators.required
      ],
      paymentMethod: ['', Validators.required],
      payment_status: ['Completed', Validators.required],
      payment_reference: [''],
      notes: ['']
    });
  }

  private loadPayments(): void {

    this.paymentsService.getAll().subscribe({
      next: (payments) => {

        console.log('[PaymentsComponent] Loaded payments:', payments);

        const mappedPayments = payments.map(payment => ({
          ...payment,
          claim:
            payment.claim ??
            this.claims().find(claim =>
              Number(claim.claimId) === Number(payment.claimId)
            )
        }));

        this.payments.set(mappedPayments);
      },
      error: (error) => {
        console.error('Error loading payments:', error);
      }
    });
  }

  private loadClaims(): void {

    this.claimsService.getAll().subscribe({
      next: (claims) => {
        console.log('[PaymentsComponent] Claims loaded:', claims);
        this.claims.set(claims);
      },
      error: (error) => {
        console.error('Error loading claims:', error);
      }
    });
  }

  openAddForm(): void {

    if (!this.canAddPayments()) return;

    this.isEditMode.set(false);
    this.selectedPayment.set(null);

    this.paymentForm.reset({
      claimId: '',
      paymentType: 'Premium',
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

    if (!this.canManagePayments()) return;

    this.isEditMode.set(true);
    this.selectedPayment.set(payment);

    this.paymentForm.patchValue({
      claimId: payment.claimId,
      paymentType: payment.paymentType,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      payment_status: payment.payment_status ?? payment.status,
      payment_reference: payment.payment_reference,
      notes: payment.notes
    });

    this.showForm.set(true);
  }

  closeForm(): void {

    this.showForm.set(false);
    this.selectedPayment.set(null);
    this.isEditMode.set(false);
  }

  savePayment(): void {

    if (!(this.isEditMode() ? this.canManagePayments() : this.canAddPayments())) return;

    if (this.paymentForm.invalid) {

      this.paymentForm.markAllAsTouched();

      this.showSuccessMessage.set(true);
      this.successMessage.set('Please fill all required fields.');

      return;
    }

    const form = this.paymentForm.value;

    const selectedClaim = this.claims().find(
      c => Number(c.claimId) === Number(form.claimId)
    );

    const paymentData: Payment = {
      claimId: Number(form.claimId),
      policyId: selectedClaim?.policyId ?? undefined,
      paymentType: form.paymentType,
      amount: Number(form.amount),
      paymentDate: form.paymentDate,
      paymentMethod: form.paymentMethod,
      status: form.payment_status,
      payment_status: form.payment_status,
      payment_reference: form.payment_reference,
      notes: form.notes
    };

    console.log('[PaymentsComponent] Final payment payload:', paymentData);

    if (this.isEditMode()) {

      const paymentId = this.selectedPayment()?.paymentId;

      if (!paymentId) return;

      this.paymentsService.update(paymentId.toString(), paymentData).subscribe({
        next: () => {

          this.showSuccessMessage.set(true);
          this.successMessage.set('Payment updated successfully.');

          this.closeForm();
          this.loadPayments();
        },
        error: (error) => {
          console.error('Update failed:', error);

          this.showSuccessMessage.set(true);
          this.successMessage.set('Failed to update payment.');
        }
      });

    } else {

      this.paymentsService.create(paymentData).subscribe({
        next: () => {

          this.showSuccessMessage.set(true);
          this.successMessage.set('Payment created successfully.');

          this.closeForm();
          this.loadPayments();
        },
        error: (error) => {
          console.error('Create failed:', error);

          this.showSuccessMessage.set(true);
          this.successMessage.set('Failed to create payment.');
        }
      });
    }
  }

  deletePayment(payment: Payment): void {

    if (!this.canManagePayments()) return;

    this.paymentToDelete.set(payment);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {

    const payment = this.paymentToDelete();

    if (!payment?.paymentId) return;

    this.paymentsService.delete(payment.paymentId.toString()).subscribe({
      next: () => {

        this.showDeleteConfirm.set(false);
        this.paymentToDelete.set(null);

        this.showSuccessMessage.set(true);
        this.successMessage.set('Payment deleted successfully.');

        this.loadPayments();
      },
      error: (error) => {
        console.error('Delete failed:', error);
      }
    });
  }

  cancelDelete(): void {

    this.showDeleteConfirm.set(false);
    this.paymentToDelete.set(null);
  }

  clearPaymentsFilters(): void {

    this.paymentsSearchText.set('');
    this.paymentsStatusFilter.set('');
    this.paymentsMethodFilter.set('');
    this.paymentsMinAmount.set(null);
    this.paymentsMaxAmount.set(null);
  }

  parseNumber(value: string | null): number | null {

    if (!value) return null;

    const num = Number(value);

    return isNaN(num) ? null : num;
  }

  getClaimInfo(claimId: number): Claim | undefined {

    return this.claims().find(
      claim => Number(claim.claimId) === Number(claimId)
    );
  }
}