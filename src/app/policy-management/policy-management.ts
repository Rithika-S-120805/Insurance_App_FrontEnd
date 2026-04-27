import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PolicyService, Policy } from './policy.service';
import { UserService } from '../services/user.service';
import { UserRole, User } from '../models/user.model';

@Component({
  selector: 'app-policy-management',
  standalone: true,
  templateUrl: './policy-management.html',
  styleUrl: './policy-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule]
})
export class PolicyManagementComponent implements OnInit {
  private policyService = inject(PolicyService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  policies = signal<Policy[]>([]);
  users = signal<User[]>([]);
  selectedPolicy = signal<Policy | null>(null);
  showForm = signal(false);
  isEditMode = signal(false);
  searchTerm = signal('');
  selectedCategory = signal('all');
  successMessage = signal('');
  showSuccessMessage = signal(false);
  showDeleteConfirm = signal(false);
  policyToDelete = signal<any>(null);

  policyForm!: FormGroup;

  currentUser = signal(this.userService.getCurrentUser());

  categories = ['HEALTH', 'AUTO', 'HOME', 'LIFE', 'TRAVEL', 'FULL'];

  filteredPolicies = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const category = this.selectedCategory();

    return this.policies().filter(policy => {
      const matchesSearch = 
        (policy.policyNumber?.toLowerCase().includes(search) || false) ||
        (policy.policyType?.toLowerCase().includes(search) || false) ||
        (policy.user?.fullName?.toLowerCase().includes(search) || false);
      const matchesCategory = category === 'all' || policy.policyType === category;
      return matchesSearch && matchesCategory;
    });
  });

  constructor() {
    this.policyForm = this.fb.group({
      policyNumber: ['', [Validators.required, Validators.minLength(3)]],
      policyType: ['', Validators.required],
      coverageType: ['', Validators.required],
      premiumAmount: ['', [Validators.required, Validators.min(0)]],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      status: ['ACTIVE', Validators.required],
      sumInsured: ['', Validators.required],
      termInMonths: ['', Validators.required],
      user_id: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadPolicies();
  }

  loadUsers(): void {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    this.userService.getAll().subscribe(users => {
      let filteredUsers = users;

      if (currentUser.role === UserRole.AGENT) {
        filteredUsers = users.filter(user => user.role === UserRole.CUSTOMER && user.agent_id === currentUser.userId);
      } else if (currentUser.role === UserRole.CUSTOMER) {
        filteredUsers = users.filter(user => user.userId === currentUser.userId);
      }
      // Admin sees all

      this.users.set(filteredUsers);
    });
  }

  loadPolicies(): void {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    if (currentUser.role === UserRole.ADMIN) {
      this.policyService.getAll().subscribe(policies => {
        console.log('Loaded policies:', policies);
        this.policies.set(policies);
      });
    } else if (currentUser.role === UserRole.AGENT) {
      this.policyService.getByAgentId(currentUser.userId!).subscribe(policies => {
        console.log('Loaded agent policies:', policies);
        this.policies.set(policies);
      });
    } else if (currentUser.role === UserRole.CUSTOMER) {
      this.policyService.getByUserId(currentUser.userId!).subscribe(policies => {
        console.log('Loaded customer policies:', policies);
        this.policies.set(policies);
      });
    }
  }

  openAddForm(): void {
    this.isEditMode.set(false);
    this.selectedPolicy.set(null);
    this.policyForm.reset({ status: 'ACTIVE' });
    this.showForm.set(true);
  }

  openEditForm(policy: Policy): void {
    this.isEditMode.set(true);
    this.selectedPolicy.set(policy);
    this.policyForm.patchValue({
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
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedPolicy.set(null);
    this.policyForm.reset();
  }

  savePolicy(): void {
    if (this.policyForm.invalid) {
      this.policyForm.markAllAsTouched();
      this.showMessage('Please fill all required fields');
      console.error('Form invalid. Invalid controls:', Object.keys(this.policyForm.controls).filter(key => this.policyForm.get(key)?.invalid));
      return;
    }

    const formValue = this.policyForm.value;
    console.log('Full form value:', formValue);
    console.log('Form controls:', {
      policyNumber: formValue.policyNumber,
      policyType: formValue.policyType,
      coverageType: formValue.coverageType,
      premiumAmount: formValue.premiumAmount,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      status: formValue.status,
      sumInsured: formValue.sumInsured,
      termInMonths: formValue.termInMonths,
      user_id: formValue.user_id
    });
    console.log('user_id value:', formValue.user_id, 'Type:', typeof formValue.user_id, 'IsNull:', formValue.user_id === null, 'IsUndefined:', formValue.user_id === undefined);

    if (this.isEditMode() && this.selectedPolicy()?.policyId) {
      const updatedPolicy: Policy = {
        ...this.selectedPolicy()!,
        ...formValue
      };
      
      this.policyService.update(updatedPolicy.policyId!.toString(), updatedPolicy).subscribe(
        () => {
          this.loadPolicies();
          this.closeForm();
          this.showMessage('Policy updated successfully');
        },
        (error) => {
          console.error('Update error:', error);
          this.showMessage('Failed to update policy');
        }
      );
    } else {
      // For new policy, only send the form data (no user object)
      const newPolicy: Partial<Policy> = {
        policyNumber: formValue.policyNumber,
        policyType: formValue.policyType,
        coverageType: formValue.coverageType,
        premiumAmount: formValue.premiumAmount,
        startDate: formValue.startDate,
        endDate: formValue.endDate,
        status: formValue.status,
        sumInsured: formValue.sumInsured,
        termInMonths: formValue.termInMonths,
        user_id: Number(formValue.user_id),
        ...(this.currentUser()?.role === UserRole.AGENT && { agent_id: this.currentUser()?.userId })
      };
      console.log('=== CREATING NEW POLICY ===');
      console.log('Form value user_id:', formValue.user_id);
      console.log('Converted user_id:', Number(formValue.user_id));
      console.log('Sending new policy object:', newPolicy);
      console.log('REQUEST BODY AS JSON:', JSON.stringify(newPolicy));
      console.log('user_id field exists:', 'user_id' in newPolicy);
      console.log('user_id value in object:', newPolicy.user_id);
      console.log('================');
      
      this.policyService.create(newPolicy as Policy).subscribe(
        () => {
          this.loadPolicies();
          this.closeForm();
          this.showMessage('Policy created successfully');
        },
        (error) => {
          console.error('Create error:', error);
          console.error('Error status:', error?.status);
          console.error('Error message:', error?.message);
          console.error('Error error object:', error?.error);
          console.error('Full error response:', JSON.stringify(error));
          
          let errorMsg = 'Unknown error';
          if (error?.error?.message) {
            errorMsg = error.error.message;
          } else if (typeof error?.error === 'string') {
            errorMsg = error.error;
          } else if (error?.statusText) {
            errorMsg = error.statusText;
          }
          this.showMessage(`Failed to create policy: ${errorMsg}`);
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

  deletePolicy(id: any): void {
    console.log('Delete button clicked with ID:', id, 'Type:', typeof id);
    this.policyToDelete.set(id);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    const id = this.policyToDelete();
    console.log('Confirming delete with ID:', id, 'Type:', typeof id);
    
    // Check for null/undefined instead of falsy to handle ID of 0
    if (id !== null && id !== undefined && id !== '') {
      const idString = id.toString();
      console.log('Sending delete request to API for ID:', idString);
      
      this.policyService.delete(idString).subscribe(
        () => {
          console.log('Delete successful for ID:', idString);
          this.showDeleteConfirm.set(false);
          this.policyToDelete.set(null);
          this.loadPolicies();
          this.showMessage('Policy deleted successfully');
        },
        (error) => {
          console.error('Delete API error:', error);
          console.error('Error status:', error?.status);
          console.error('Error message:', error?.error);
          const errorMsg = error?.error?.message || error?.statusText || 'Unknown error';
          this.showMessage(`Failed to delete policy: ${errorMsg}`);
        }
      );
    } else {
      console.warn('Invalid ID for deletion:', id);
      this.showMessage('Invalid policy ID');
    }
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.policyToDelete.set(null);
  }

  toggleStatus(policy: Policy): void {
    if (!policy.policyId) return;
    
    // Cycle through statuses: ACTIVE -> PENDING -> EXPIRED -> ACTIVE
    let newStatus = 'ACTIVE';
    if (policy.status === 'ACTIVE') {
      newStatus = 'PENDING';
    } else if (policy.status === 'PENDING') {
      newStatus = 'EXPIRED';
    } else if (policy.status === 'EXPIRED') {
      newStatus = 'ACTIVE';
    }
    
    const updatedPolicy: Policy = { 
      ...policy, 
      status: newStatus
    };
    
    this.policyService.update(policy.policyId!.toString(), updatedPolicy).subscribe(() => {
      this.loadPolicies();
    });
  }

  get policyNumber() { return this.policyForm.get('policyNumber'); }
  get policyType() { return this.policyForm.get('policyType'); }
  get coverageType() { return this.policyForm.get('coverageType'); }
  get premiumAmount() { return this.policyForm.get('premiumAmount'); }
  get startDate() { return this.policyForm.get('startDate'); }
  get endDate() { return this.policyForm.get('endDate'); }
  get status() { return this.policyForm.get('status'); }
  get sumInsured() { return this.policyForm.get('sumInsured'); }
  get termInMonths() { return this.policyForm.get('termInMonths'); }
  get user_id() { return this.policyForm.get('user_id'); }
}
