import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ClaimsService, Claim } from './claims.service';
import { PolicyService, Policy } from '../policy-management/policy.service';
import { UserService } from '../services/user.service';
import { UserRole } from '../models/user.model';

@Component({
  selector: 'app-claims-management',
  standalone: true,
  templateUrl: './claims-management.html',
  styleUrl: './claims-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule]
})
export class ClaimsManagementComponent implements OnInit {
  private claimsService = inject(ClaimsService);
  private policyService = inject(PolicyService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  claims = signal<Claim[]>([]);
  policies = signal<Policy[]>([]);
  selectedClaim = signal<Claim | null>(null);
  showForm = signal(false);
  isEditMode = signal(false);
  searchTerm = signal('');
  selectedStatus = signal('all');
  successMessage = signal('');
  showSuccessMessage = signal(false);
  showDeleteConfirm = signal(false);
  claimToDelete = signal<any>(null);

  claimForm!: FormGroup;

  currentUser = signal(this.userService.getCurrentUser());

  statuses = ['Pending Review', 'Approved', 'Denied'];

  filteredClaims = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const status = this.selectedStatus();

    return this.claims().filter(claim => {
      const matchesSearch = 
        (claim.claimId?.toString().toLowerCase().includes(search) || false) ||
        (claim.description?.toLowerCase().includes(search) || false);
      const matchesStatus = status === 'all' || claim.claimStatus === status;
      return matchesSearch && matchesStatus;
    });
  });

  pendingClaims = computed(() => this.claims().filter((c: any) => c.claimStatus === 'Pending Review'));

  recentPayments = computed(() => this.claims().filter((c: any) => c.claimStatus === 'Approved').slice(0, 5));

  constructor() {
    this.claimForm = this.fb.group({
      claimId: [''],
      policyId: ['', [Validators.required, Validators.min(1)]],
      claimAmount: ['', [Validators.required, Validators.min(0)]],
      dateFiled: ['', Validators.required],
      claimStatus: ['Pending Review', Validators.required],
      user_id: ['', [Validators.min(1)]], // Optional, for display purposes only
      description: ['', [Validators.required, Validators.minLength(10)]],
      documents: ['']
    });

    // Remove auto-population logic since user_id is now editable
  }

  ngOnInit(): void {
    this.loadPolicies().subscribe(() => {
      this.loadClaims();
    });
  }

  loadPolicies(): Observable<Policy[]> {
    const currentUser = this.currentUser();
    if (!currentUser) return new Observable();

    if (currentUser.role === UserRole.ADMIN) {
      return this.policyService.getAll().pipe(
        tap(policies => {
          this.policies.set(policies);
        })
      );
    } else if (currentUser.role === UserRole.AGENT) {
      return this.policyService.getByAgentId(currentUser.userId!).pipe(
        tap(policies => {
          this.policies.set(policies);
        })
      );
    } else if (currentUser.role === UserRole.CUSTOMER) {
      return this.policyService.getByUserId(currentUser.userId!).pipe(
        tap(policies => {
          this.policies.set(policies);
        })
      );
    }
    return new Observable();
  }

  loadClaims(): void {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    let claimsObs;
    if (currentUser.role === UserRole.ADMIN) {
      claimsObs = this.claimsService.getAll();
    } else if (currentUser.role === UserRole.AGENT) {
      claimsObs = this.claimsService.getByAgentId(currentUser.userId!);
    } else if (currentUser.role === UserRole.CUSTOMER) {
      claimsObs = this.claimsService.getByUserId(currentUser.userId!);
    } else {
      return;
    }

    claimsObs.subscribe(claims => {
      // Map claims with proper field mapping
      const mappedClaims = claims.map(claim => ({
        ...claim,
        policyId: claim.policy_id, // Map API field to component field
        claimStatus: this.mapClaimStatus(claim.claimStatus), // Map API status to component status
        user_id: claim.policy?.user?.user_id // Extract user_id from policy.user
      }));
      
      this.claims.set(mappedClaims);
    });
  }

  private mapClaimStatus(apiStatus: string): string {
    switch (apiStatus) {
      case 'APPROVED': return 'Approved';
      case 'PENDING': return 'Pending Review';
      case 'REJECTED': return 'Denied';
      case 'UNDER_REVIEW': return 'Pending Review';
      default: return apiStatus;
    }
  }

  private mapStatusToApi(componentStatus: string): string {
    switch (componentStatus) {
      case 'Approved': return 'APPROVED';
      case 'Pending Review': return 'PENDING';
      case 'Denied': return 'REJECTED';
      default: return componentStatus;
    }
  }

  private getUserIdFromPolicy(policyId: number | undefined): number | undefined {
    if (!policyId) return undefined;
    const policy = this.policies().find(p => p.policyId === policyId);
    return policy?.user_id;
  }

  openAddForm(): void {
    this.isEditMode.set(false);
    this.selectedClaim.set(null);
    this.claimForm.reset({ 
      claimStatus: 'Pending Review'
    });
    this.showForm.set(true);
  }

  openEditForm(claim: any): void {
    this.isEditMode.set(true);
    this.selectedClaim.set(claim);
    this.claimForm.patchValue({
      claimId: claim.claimId,
      policyId: claim.policyId,
      claimAmount: claim.claimAmount,
      dateFiled: claim.dateFiled,
      claimStatus: claim.claimStatus,
      user_id: claim.user_id,
      description: claim.description,
      documents: claim.documents
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedClaim.set(null);
    this.claimForm.reset();
  }

  saveClaim(): void {
    if (this.claimForm.invalid) {
      this.claimForm.markAllAsTouched();
      return;
    }

    const formValue = this.claimForm.value;
    const userId = Number(formValue.user_id) || 0;
    
    if (this.isEditMode() && this.selectedClaim()?.claimId) {
      // Edit mode: update existing claim
      const updatedClaim = {
        claimId: this.selectedClaim()?.claimId,
        claimAmount: formValue.claimAmount,
        claimStatus: this.mapStatusToApi(formValue.claimStatus),
        dateFiled: formValue.dateFiled,
        policy_id: Number(formValue.policyId),
        description: formValue.description,
        documents: formValue.documents || ''
      };
      console.log('Updating claim:', JSON.stringify(updatedClaim, null, 2));
      
      this.claimsService.update(updatedClaim.claimId!.toString(), updatedClaim as any).subscribe(
        (updatedClaim) => {
          console.log('Claim updated successfully:', updatedClaim);
          this.loadClaims();
          this.closeForm();
          this.showMessage('Claim updated successfully');
        },
        (error) => {
          console.error('Update error:', error);
          console.error('Error status:', error?.status);
          console.error('Error message:', error?.message);
          console.error('Error error object:', error?.error);
          console.error('Full error response:', JSON.stringify(error));
          
          // Better error message handling
          let errorMsg = 'Unknown error occurred while updating claim';
          
          if (error?.status === 0) {
            errorMsg = 'Cannot connect to server. Please check your connection.';
          } else if (error?.status >= 400 && error?.status < 500) {
            // Client error
            if (error?.error?.message) {
              errorMsg = error.error.message;
            } else if (typeof error?.error === 'string') {
              errorMsg = error.error;
            } else if (error?.statusText) {
              errorMsg = `Client error: ${error.statusText}`;
            }
          } else if (error?.status >= 500) {
            // Server error
            errorMsg = 'Server error occurred. Please try again later.';
          } else if (error?.statusText && error?.statusText !== 'OK') {
            errorMsg = error.statusText;
          }
          
          this.showMessage(`Failed to update claim: ${errorMsg}`);
        }
      );
    } else {
      // Create mode: new claim
      const newClaim = {
        claimAmount: formValue.claimAmount,
        claimStatus: this.mapStatusToApi(formValue.claimStatus),
        dateFiled: formValue.dateFiled,
        policy_id: Number(formValue.policyId),
        description: formValue.description,
        documents: formValue.documents || '',
        ...(this.currentUser()?.role === UserRole.AGENT && { agent_id: this.currentUser()?.userId })
      };
      console.log('Creating claim:', JSON.stringify(newClaim, null, 2));
      
      this.claimsService.create(newClaim as any).subscribe(
        (createdClaim) => {
          console.log('Claim created successfully:', createdClaim);
          this.loadClaims();
          this.closeForm();
          this.showMessage('Claim created successfully');
        },
        (error) => {
          console.error('Create error:', error);
          console.error('Error status:', error?.status);
          console.error('Error message:', error?.message);
          console.error('Error error object:', error?.error);
          console.error('Full error response:', JSON.stringify(error));
          
          // Better error message handling
          let errorMsg = 'Failed to create claim';
          
          if (error?.status === 0) {
            errorMsg = 'Cannot connect to server. Please check your connection.';
          } else if (error?.status === 500) {
            errorMsg = 'Server error: Claim creation is currently unavailable. Please contact support or try again later.';
          } else if (error?.status >= 400 && error?.status < 500) {
            // Client error
            if (error?.error?.message) {
              errorMsg = error.error.message;
            } else if (typeof error?.error === 'string') {
              errorMsg = error.error;
            } else if (error?.statusText && error?.statusText !== 'OK') {
              errorMsg = `Client error: ${error.statusText}`;
            }
          } else if (error?.statusText && error?.statusText !== 'OK') {
            errorMsg = error.statusText;
          }
          
          this.showMessage(errorMsg);
        }
      );
    }
  }

  private showMessage(message: string): void {
    this.successMessage.set(message);
    this.showSuccessMessage.set(true);
    setTimeout(() => {
      this.showSuccessMessage.set(false);
    }, 3000);
  }

  deleteClaim(id: any): void {
    console.log('Delete button clicked with ID:', id, 'Type:', typeof id);
    this.claimToDelete.set(id);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    const id = this.claimToDelete();
    console.log('Confirming delete with ID:', id, 'Type:', typeof id);
    
    // Check for null/undefined instead of falsy to handle ID of 0
    if (id !== null && id !== undefined && id !== '') {
      const idString = id.toString();
      console.log('Sending delete request to API for ID:', idString);
      
      this.claimsService.delete(idString).subscribe(
        () => {
          console.log('Delete successful for ID:', idString);
          this.showDeleteConfirm.set(false);
          this.claimToDelete.set(null);
          this.loadClaims();
          this.showMessage('Claim deleted successfully');
        },
        (error) => {
          console.error('Delete API error:', error);
          console.error('Error status:', error?.status);
          console.error('Error message:', error?.error);
          const errorMsg = error?.error?.message || error?.statusText || 'Unknown error';
          this.showMessage(`Failed to delete claim: ${errorMsg}`);
        }
      );
    } else {
      console.warn('Invalid ID for deletion:', id);
      this.showMessage('Invalid claim ID');
    }
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.claimToDelete.set(null);
  }

  toggleStatus(claim: any): void {
    if (!claim.claimId) return;
    
    // Cycle through statuses: Pending Review -> Approved -> Denied -> Pending Review
    let newStatus = 'Pending Review';
    if (claim.claimStatus === 'Pending Review') {
      newStatus = 'Approved';
    } else if (claim.claimStatus === 'Approved') {
      newStatus = 'Denied';
    } else if (claim.claimStatus === 'Denied') {
      newStatus = 'Pending Review';
    }
    
    const updatedClaim = {
      claimId: claim.claimId,
      claimAmount: claim.claimAmount,
      claimStatus: newStatus,
      dateFiled: claim.dateFiled,
      description: claim.description,
      documents: claim.documents,
      claimant: claim.claimant,
      policy: claim.policy
    };
    
    this.claimsService.update(claim.claimId.toString(), updatedClaim as any).subscribe(() => {
      this.loadClaims();
    });
  }

  get policyId() { return this.claimForm.get('policyId'); }
  get claimAmount() { return this.claimForm.get('claimAmount'); }
  get dateFiled() { return this.claimForm.get('dateFiled'); }
  get claimStatus() { return this.claimForm.get('claimStatus'); }
  get user_id() { return this.claimForm.get('user_id'); }
  get description() { return this.claimForm.get('description'); }
  get documents() { return this.claimForm.get('documents'); }
}
