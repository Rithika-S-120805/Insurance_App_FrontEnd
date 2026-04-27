import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { tap, delay, catchError } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';

interface LoginResponse {
  message: string;
  success: boolean;
  token: string;
  user: User;
  role: string;
}

interface RegisterResponse extends LoginResponse {}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/auth';

  // Mock mode for development
  private mockMode = false; // Use real backend API

  private tokenSignal = signal<string | null>(this.getStoredToken());
  readonly token = this.tokenSignal.asReadonly();

  private currentUserSignal = signal<User | null>(this.getStoredUser());
  readonly currentUser = this.currentUserSignal.asReadonly();

  private currentRoleSignal = signal<UserRole | null>(this.getStoredRole());
  readonly currentRole = this.currentRoleSignal.asReadonly();

  // For backward compatibility with observables
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  readonly currentUser$ = this.currentUserSubject.asObservable();

  private currentRoleSubject = new BehaviorSubject<UserRole | null>(this.getStoredRole());
  readonly currentRole$ = this.currentRoleSubject.asObservable();

  constructor() {
    this.loadStoredData();
  }

  /**
   * Load token and user from localStorage on init
   */
  private loadStoredData(): void {
    const token = this.getStoredToken();
    const user = this.getStoredUser();
    const role = this.getStoredRole();

    if (token) this.tokenSignal.set(token);
    if (user) this.currentUserSignal.set(user);
    if (role) this.currentRoleSignal.set(role as UserRole);

    this.currentUserSubject.next(user);
    this.currentRoleSubject.next(role as UserRole | null);
  }

  /**
   * Get stored JWT token from localStorage
   */
  private getStoredToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  /**
   * Get stored user from localStorage
   */
  private getStoredUser(): User | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing stored user:', error);
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Get stored role from localStorage
   */
  private getStoredRole(): UserRole | null {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('userRole') as UserRole) || null;
    }
    return null;
  }

  /**
   * Login user with email and password
   */
  login(email: string, password: string): Observable<LoginResponse> {
    if (this.mockMode) {
      return this.mockLogin(email, password);
    }

    const payload = { email, password };
    console.log(`[AUTH] Sending login request to ${this.apiUrl}/login`, { email });
    console.log('[AUTH] Full payload:', payload);

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, payload).pipe(
      tap(response => {
        console.log('[AUTH] Login successful:', response);
        if (response.token && response.user) {
          this.setAuthData(response.token, response.user, response.role);
        }
      }),
      catchError(error => {
        console.error('[AUTH] Login request failed:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url,
          body: error.error
        });
        console.table(error.error); // Pretty print error response
        // Handle connection errors
        if (error.status === 0 || error.status === null) {
          const errorMsg = `Backend server is not accessible at ${this.apiUrl}. Make sure the backend is running on port 8080.`;
          console.error(errorMsg);
          return throwError(() => ({
            status: 503,
            message: errorMsg,
            originalError: error
          }));
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Mock login for development
   */
  private mockLogin(email: string, password: string): Observable<LoginResponse> {
    // Mock user database
    const mockUsers = [
      {
        email: 'admin@example.com',
        password: 'admin123',
        user: {
          userId: 1,
          email: 'admin@example.com',
          fullName: 'Admin User',
          username: 'admin',
          role: UserRole.ADMIN
        },
        role: 'ADMIN'
      },
      {
        email: 'agent@example.com',
        password: 'agent123',
        user: {
          userId: 2,
          agent_id: 2,
          email: 'agent@example.com',
          fullName: 'Agent User',
          username: 'agent',
          role: UserRole.AGENT
        },
        role: 'AGENT'
      },
      {
        email: 'customer@example.com',
        password: 'customer123',
        user: {
          userId: 3,
          agent_id: 2,
          email: 'customer@example.com',
          fullName: 'Customer User',
          username: 'customer',
          role: UserRole.CUSTOMER
        },
        role: 'CUSTOMER'
      }
    ];

    const user = mockUsers.find(u => u.email === email && u.password === password);

    if (user) {
      const response: LoginResponse = {
        message: 'Login successful',
        success: true,
        token: `mock-jwt-token-${user.role}`,
        user: user.user,
        role: user.role
      };

      return of(response).pipe(
        delay(500), // Simulate network delay
        tap(response => {
          this.setAuthData(response.token, response.user, response.role);
        })
      );
    } else {
      return of({
        message: 'Invalid credentials',
        success: false,
        token: '',
        user: {} as User,
        role: ''
      }).pipe(
        delay(500),
        tap(() => {
          throw new Error('Invalid email or password');
        })
      );
    }
  }

  /**
   * Register new user
   */
  register(
    email: string,
    password: string,
    fullName: string,
    username: string,
    role: UserRole = UserRole.CUSTOMER
  ): Observable<RegisterResponse> {
    if (this.mockMode) {
      return this.mockRegister(email, password, fullName, username, role);
    }

    return this.http
      .post<RegisterResponse>(`${this.apiUrl}/register`, {
        email,
        password,
        fullName,
        username,
        role
      })
      .pipe(
        tap(response => {
          if (response.token && response.user) {
            this.setAuthData(response.token, response.user, response.role);
          }
        }),
        catchError(error => {
          // Handle connection errors
          if (error.status === 0 || error.status === null) {
            const errorMsg = `Backend server is not accessible at ${this.apiUrl}. Make sure the backend is running on port 8080.`;
            console.error(errorMsg);
            return throwError(() => ({
              status: 503,
              message: errorMsg,
              originalError: error
            }));
          }
          return throwError(() => error);
        })
      );
  }

  /**
   * Mock register for development
   */
  private mockRegister(
    email: string,
    password: string,
    fullName: string,
    username: string,
    role: UserRole
  ): Observable<RegisterResponse> {
    // Check if user already exists
    const existingUser = this.getStoredUser();
    if (existingUser && existingUser.email === email) {
      return of({
        message: 'User already exists',
        success: false,
        token: '',
        user: {} as User,
        role: ''
      }).pipe(
        delay(500),
        tap(() => {
          throw new Error('User already exists');
        })
      );
    }

    const newUser: User = {
      userId: Date.now(), // Simple ID generation
      email,
      fullName,
      username,
      role
    };

    const response: RegisterResponse = {
      message: 'Registration successful',
      success: true,
      token: `mock-jwt-token-${role}`,
      user: newUser,
      role: role.toString()
    };

    return of(response).pipe(
      delay(500), // Simulate network delay
      tap(response => {
        this.setAuthData(response.token, response.user, response.role);
      })
    );
  }

  /**
   * Store auth data (token, user, role)
   */
  private setAuthData(token: string, user: User, role: string): void {
    console.log('[AUTH] Storing auth data:', {
      token: token.substring(0, 50) + '...',
      user,
      role
    });

    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userRole', role);

    this.tokenSignal.set(token);
    this.currentUserSignal.set(user);
    this.currentRoleSignal.set(role as UserRole);

    this.currentUserSubject.next(user);
    this.currentRoleSubject.next(role as UserRole);

    console.log('[AUTH] Auth data stored successfully');
  }

  /**
   * Logout user - clear token and user data
   */
  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');

    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    this.currentRoleSignal.set(null);

    this.currentUserSubject.next(null);
    this.currentRoleSubject.next(null);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.tokenSignal();
  }

  /**
   * Get current user role
   */
  getUserRole(): UserRole | null {
    return this.currentRoleSignal();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: UserRole): boolean {
    return this.currentRoleSignal() === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: UserRole[]): boolean {
    const userRole = this.currentRoleSignal();
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSignal();
  }

  /**
   * Get agent ID for current user (for filtering agent-specific data)
   */
  getAgentId(): number | null {
    const user = this.currentUserSignal();

    if (!user) {
      console.warn('[AUTH] getAgentId: No user found');
      return null;
    }

    console.log('[AUTH] getAgentId - User object:', user);

    // Priority: agentId > agent_id > userId (for agents)
    let agentId: number | null = null;

    if (user.agentId !== undefined && user.agentId !== null) {
      agentId = user.agentId;
      console.log('[AUTH] getAgentId: Using user.agentId:', agentId);
    } else if (user.agent_id !== undefined && user.agent_id !== null) {
      agentId = user.agent_id;
      console.log('[AUTH] getAgentId: Using user.agent_id:', agentId);
    } else if (user.role === UserRole.AGENT) {
      // For agents without explicit agentId, use their userId
      agentId = user.userId || user.user_id || null;
      console.log('[AUTH] getAgentId: Agent without explicit agentId, using userId:', agentId);
    }

    return agentId;
  }

  /**
   * Get JWT token
   */
  getToken(): string | null {
    // Always read from localStorage to ensure freshest value
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      console.log('[AUTH] getToken() - Retrieved from localStorage:', token ? 'Token exists (' + token.substring(0, 30) + '...)' : 'No token');
      return token;
    }
    return null;
  }
}
