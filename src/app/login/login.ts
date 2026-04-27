import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  isRegisterMode = signal(false);

  roles = [
    { label: 'Customer', value: UserRole.CUSTOMER },
    { label: 'Agent', value: UserRole.AGENT }
  ];

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    fullName: [''],
    username: [''],
    role: [UserRole.CUSTOMER]
  });

  toggleRegister(): void {
    this.isRegisterMode.update(value => !value);
    this.errorMessage.set(null);
    this.loginForm.patchValue({ fullName: '', username: '', role: UserRole.CUSTOMER });
    this.loginForm.markAsUntouched();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.errorMessage.set('Please fill in all fields correctly');
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password: rawPassword, fullName, username, role } = this.loginForm.value;
    const password = rawPassword || '';

    if (this.isRegisterMode() && (!fullName || !username)) {
      this.errorMessage.set('Please provide your full name and username to sign up');
      return;
    }

    if (this.isRegisterMode() && (!password || password.length < 6)) {
      this.errorMessage.set('Password must be at least 6 characters');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    if (this.isRegisterMode()) {
      // Register
      this.authService
        .register(email || '', password, fullName || '', username || '', role || UserRole.CUSTOMER)
        .subscribe({
          next: (response) => {
            console.log('Registration successful:', response);
            this.loginForm.reset({ role: UserRole.CUSTOMER });
            this.isRegisterMode.set(false);
            this.isLoading.set(false);
            this.redirectToDashboard(response.role);
          },
          error: (error) => {
            console.error('Registration error:', error);
            this.isLoading.set(false);
            if (error.status === 503) {
              this.errorMessage.set(error.message || 'Backend server is unavailable. Please ensure it is running on http://localhost:8080');
            } else if (error.status === 409) {
              this.errorMessage.set('A user with that email already exists.');
            } else if (error.status === 400) {
              this.errorMessage.set(error.message || 'Invalid user data. Please check your input.');
            } else if (error.status === 0 || !error.status) {
              this.errorMessage.set('Cannot reach backend server. Ensure it is running on http://localhost:8080');
            } else {
              this.errorMessage.set('An error occurred during signup. Please try again.');
            }
          }
        });
    } else {
      // Login
      console.log('[LOGIN] Attempting login with:', { email });
      this.authService.login(email || '', password).subscribe({
        next: (response) => {
          console.log('Login successful:', response);
          this.loginForm.reset({ role: UserRole.CUSTOMER });
          this.isLoading.set(false);
          this.redirectToDashboard(response.role);
        },
        error: (error) => {
          console.error('Login error:', error);
          this.isLoading.set(false);
          if (error.status === 503) {
            this.errorMessage.set(error.message || 'Backend server is unavailable. Please ensure it is running on http://localhost:8080');
          } else if (error.status === 401 || error.status === 400) {
            this.errorMessage.set('Invalid email or password');
          } else if (error.status === 0 || !error.status) {
            this.errorMessage.set('Cannot reach backend server. Ensure it is running on http://localhost:8080');
          } else {
            this.errorMessage.set('An error occurred during login. Please try again.');
          }
        }
      });
    }
  }

  /**
   * Redirect to appropriate dashboard based on role
   */
  private redirectToDashboard(role: string): void {
    if (role === 'ADMIN') {
      this.router.navigate(['/admin-dashboard']);
    } else if (role === 'AGENT') {
      this.router.navigate(['/agent-dashboard']);
    } else if (role === 'CUSTOMER') {
      this.router.navigate(['/customer-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  /**
   * Demo login methods for testing
   */
  loginAsAdmin(): void {
    this.demoLogin('admin@example.com', 'password', 'ADMIN');
  }

  loginAsAgent(): void {
    this.demoLogin('jane@example.com', 'password', 'AGENT');
  }

  loginAsCustomer(): void {
    this.demoLogin('john@example.com', 'password', 'CUSTOMER');
  }

  private demoLogin(email: string, password: string, expectedRole: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(email, password).subscribe({
      next: (response) => {
        console.log(`Demo login as ${expectedRole} successful:`, response);
        this.isLoading.set(false);
        this.redirectToDashboard(response.role);
      },
      error: (error) => {
        console.error(`Demo login as ${expectedRole} error:`, error);
        this.isLoading.set(false);
        this.errorMessage.set(`Demo login failed. Please ensure demo accounts exist in the backend.`);
      }
    });
  }
}
