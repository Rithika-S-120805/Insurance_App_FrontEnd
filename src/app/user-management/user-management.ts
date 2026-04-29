import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { User, UserRole } from '../models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  templateUrl: './user-management.html',
  styleUrl: './user-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule]
})
export class UserManagementComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  users = signal<User[]>([]);
  selectedUser = signal<User | null>(null);
  showForm = signal(false);
  isEditMode = signal(false);
  searchTerm = signal('');
  selectedRole = signal('all');
  successMessage = signal('');
  showSuccessMessage = signal(false);
  showDeleteConfirm = signal(false);
  userToDelete = signal<User | null>(null);

  userForm!: FormGroup;

  currentUser = signal(this.userService.getCurrentUser());
  isAgent = computed(() => this.currentUser()?.role === UserRole.AGENT);
  isAdmin = computed(() => this.currentUser()?.role === UserRole.ADMIN);
  headerTitle = computed(() => this.isAgent() ? 'Customer Management' : 'User Management');
  addButtonLabel = computed(() => this.isAgent() ? 'Add Customer' : 'Add New User');
  formTitle = computed(() => this.isAgent() ? 'Add New Customer' : 'Add New User');
  editFormTitle = computed(() => this.isAgent() ? 'Edit Customer' : 'Edit User');

  roles = computed(() => {
    const user = this.currentUser();
    if (user?.role === UserRole.ADMIN) {
      return Object.values(UserRole);
    } else if (user?.role === UserRole.AGENT) {
      return [UserRole.CUSTOMER]; // Agents can only manage customers
    }
    return [];
  });

  filteredUsers = computed(() => {
    const currentUser = this.currentUser();
    let filtered = this.users();

    // If customer, only show themselves
    if (currentUser?.role === UserRole.CUSTOMER) {
      return filtered.filter(user => user.userId === currentUser.userId);
    }

    // For agents and admins, apply search and role filters
    const search = this.searchTerm().toLowerCase();
    const role = this.selectedRole();

    return filtered.filter(user => {
      const matchesSearch = 
        (user.username?.toLowerCase().includes(search) || false) ||
        (user.email?.toLowerCase().includes(search) || false) ||
        (user.fullName?.toLowerCase().includes(search) || false);
      const matchesRole = role === 'all' || user.role === role;
      return matchesSearch && matchesRole;
    });
  });

  // Show filters only for admins and agents, not for customers
  showFilters = computed(() => this.currentUser()?.role !== UserRole.CUSTOMER);

  constructor() {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      password: ['', [Validators.minLength(6)]],
      role: ['CUSTOMER', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    this.userService.getAll().subscribe(users => {
      if (currentUser.role === UserRole.AGENT) {
        // Backend already scopes /api/users to the logged-in agent's customers.
        // Keep the response as-is so we don't filter out scoped results that don't carry agent_id.
        this.users.set(users.filter(user => user.role === UserRole.CUSTOMER));
      } else if (currentUser.role === UserRole.CUSTOMER) {
        // Customers can only see themselves
        this.users.set(users.filter(user => user.userId === currentUser.userId));
      } else {
        // Admins see all users
        this.users.set(users);
      }

      console.log('Loaded users:', this.users());
    });
  }

  private matchesAgent(value: number | string | undefined, agentId: number | string | null | undefined): boolean {
    if (value === undefined || value === null || agentId === undefined || agentId === null) {
      return false;
    }

    return String(value) === String(agentId);
  }

  openAddForm(): void {
    this.isEditMode.set(false);
    this.selectedUser.set(null);
    // Reset form and clear all validators
    this.userForm.reset({ role: UserRole.CUSTOMER });
    // Set password as required for new users
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    // Clear touched state so validation errors don't show
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsUntouched();
    });
    this.showForm.set(true);
  }

  openEditForm(user: User): void {
    this.isEditMode.set(true);
    this.selectedUser.set(user);
    // Reset form first
    this.userForm.reset();
    // Make password optional for edits
    this.userForm.get('password')?.setValidators([Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.patchValue({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      password: '',
      role: this.isAgent() ? UserRole.CUSTOMER : user.role
    });
    // Clear touched state so validation errors don't show
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsUntouched();
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedUser.set(null);
    this.userForm.reset();
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.showMessage('Please fill all required fields');
      return;
    }

    const formValue = this.userForm.value;

    if (this.isEditMode() && this.selectedUser()) {
      const userId = this.selectedUser()?.userId || this.selectedUser()?.user_id;
      if (!userId) {
        this.showMessage('User ID not found');
        return;
      }
      const updatedUser = {
        userId: userId,
        password: formValue.password ? formValue.password : undefined, // Only include password if it's provided
        email: formValue.email,
        fullName: formValue.fullName,
        role: this.isAgent() ? UserRole.CUSTOMER : formValue.role
      };
      
      this.userService.update(userId, updatedUser).subscribe(
        () => {
          this.loadUsers();
          this.closeForm();
          this.showMessage('User updated successfully');
        },
        (error) => {
          console.error('Update error:', error);
          this.showMessage('Failed to update user');
        }
      );
    } else {
      const password = formValue.password || '';
      if (!password || password.length < 6) {
        this.showMessage('Password must be at least 6 characters and not empty');
        return;
      }
      const newUser = {
        username: formValue.username,
        email: formValue.email,
        fullName: formValue.fullName,
        password: password.trim(),
        role: this.isAgent() ? UserRole.CUSTOMER : formValue.role,
        ...(this.currentUser()?.role === UserRole.AGENT && { agent_id: this.currentUser()?.userId })
      };
      
      this.userService.create(newUser).subscribe(
        () => {
          this.loadUsers();
          this.closeForm();
          this.showMessage('User created successfully');
        },
        (error) => {
          console.error('Create error:', error);
          let errorMsg = 'Unknown error';
          if (error?.error?.message) {
            errorMsg = error.error.message;
          } else if (typeof error?.error === 'string') {
            errorMsg = error.error;
          } else if (error?.statusText) {
            errorMsg = error.statusText;
          }
          this.showMessage(`Failed to create user: ${errorMsg}`);
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

  deleteUser(user: User): void {
    if (!this.isAdmin()) {
      return;
    }
    this.userToDelete.set(user);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    if (!this.isAdmin()) {
      return;
    }
    const user = this.userToDelete();
    const userId = user?.userId || user?.user_id;
    if (userId) {
      this.userService.delete(userId).subscribe(
        () => {
          this.showDeleteConfirm.set(false);
          this.userToDelete.set(null);
          this.loadUsers();
          this.showMessage('User deleted successfully');
        },
        (error) => {
          console.error('Delete error:', error);
          this.showDeleteConfirm.set(false);
          this.showMessage('Failed to delete user');
        }
      );
    }
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.userToDelete.set(null);
  }

  canDeleteUsers(): boolean {
    return this.isAdmin();
  }

  getRoleColor(role: UserRole): string {
    const roleColors: {[key: string]: string} = {
      ADMIN: 'badge-admin',
      AGENT: 'badge-agent',
      CUSTOMER: 'badge-customer'
    };
    return roleColors[role] || 'badge-default';
  }
}
