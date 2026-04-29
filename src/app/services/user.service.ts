import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, tap } from 'rxjs';
import { delay, catchError } from 'rxjs/operators';
import { User, UserRole } from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = 'http://localhost:8080/api';

  // Mock mode for development
  private mockMode = false; // Use real backend API

  /**
   * Normalize user data from backend response
   */
  private normalizeUser(raw: any): User {
    return {
      userId: raw.userId ?? raw.id ?? raw.user_id,
      user_id: raw.user_id ?? raw.userId ?? raw.id,
      username: raw.username ?? raw.user_name ?? 'N/A',
      email: raw.email ?? 'N/A',
      fullName: raw.fullName ?? raw.full_name ?? raw.name ?? 'N/A',
      role: (raw.role ?? raw.user_role ?? 'CUSTOMER') as any,
      agent_id: raw.agent_id ?? raw.agentId,
      agentId: raw.agentId ?? raw.agent_id
    };
  }

  
  /**
   * Get all users (admin only)
   */
  getAll(): Observable<User[]> {
    if (this.mockMode) {
      return this.mockGetAllUsers();
    }
    console.log('[UserService] Fetching all users');
    
    // Get authorization token and add to headers
    let token = localStorage.getItem('authToken');
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    const headers: {[key: string]: string} = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[UserService] ✅ Authorization header added:', token.substring(0, 30) + '...');
    } else {
      console.warn('[UserService] ⚠️ No token found in localStorage');
    }
    
    return this.http.get<any[]>(`${this.apiUrl}/users`, { headers }).pipe(
      tap(rawUsers => {
        console.log('[UserService] Raw response from API:', rawUsers);
      }),
      map(rawUsers => {
        const normalizedUsers = rawUsers.map(raw => this.normalizeUser(raw));
        console.log('[UserService] Users fetched successfully:', normalizedUsers.length);
        console.log('[UserService] Normalized users:', normalizedUsers);
        return normalizedUsers;
      }),
      catchError((error) => {
        console.error('[UserService] Error fetching users:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          body: error.error,
          url: error.url
        });
        return of([]);
      })
    );
  }

  /**
   * Mock get all users
   */
  private mockGetAllUsers(): Observable<User[]> {
    const mockUsers: User[] = [
      {
        userId: 1,
        email: 'admin@example.com',
        fullName: 'Admin User',
        username: 'admin',
        role: UserRole.ADMIN
      },
      {
        userId: 2,
        email: 'agent@example.com',
        fullName: 'Agent User',
        username: 'agent',
        agent_id: 2,
        role: UserRole.AGENT
      },
      {
        userId: 3,
        email: 'customer1@example.com',
        fullName: 'Customer User 1',
        username: 'customer1',
        agent_id: 2,
        role: UserRole.CUSTOMER
      },
      {
        userId: 4,
        email: 'customer2@example.com',
        fullName: 'Customer User 2',
        username: 'customer2',
        agent_id: 2,
        role: UserRole.CUSTOMER
      },
      {
        userId: 5,
        email: 'customer3@example.com',
        fullName: 'Customer User 3',
        username: 'customer3',
        agent_id: 10,
        role: UserRole.CUSTOMER
      }
    ];
    return of(mockUsers).pipe(delay(200));
  }

  /**
   * Create new user (admin only)
   */
  create(user: Partial<User>): Observable<User> {
    if (this.mockMode) {
      return this.mockCreateUser(user);
    }
    return this.http.post<User>(`${this.apiUrl}/users`, user);
  }

  /**
   * Mock create user
   */
  private mockCreateUser(user: Partial<User>): Observable<User> {
    const newUser: User = {
      userId: Date.now(),
      email: user.email || '',
      fullName: user.fullName || '',
      username: user.username || '',
      role: user.role || UserRole.CUSTOMER
    };
    return of(newUser).pipe(delay(300));
  }

  /**
   * Get user by ID (admin only)
   */
  getById(id: number): Observable<User> {
    if (this.mockMode) {
      return this.mockGetUserById(id);
    }
    return this.http.get<User>(`${this.apiUrl}/users/${id}`);
  }

  /**
   * Mock get user by ID
   */
  private mockGetUserById(id: number): Observable<User> {
    const mockUsers = [
      {
        userId: 1,
        email: 'admin@example.com',
        fullName: 'Admin User',
        username: 'admin',
        role: UserRole.ADMIN
      },
      {
        userId: 2,
        email: 'agent@example.com',
        fullName: 'Agent User',
        username: 'agent',
        agent_id: 2,
        role: UserRole.AGENT
      },
      {
        userId: 3,
        email: 'customer@example.com',
        fullName: 'Customer User',
        username: 'customer',
        agent_id: 2,
        role: UserRole.CUSTOMER
      }
    ];
    const user = mockUsers.find(u => u.userId === id) || mockUsers[0];
    return of(user).pipe(delay(200));
  }

  /**
   * Update user (admin only)
   */
  update(id: number, user: Partial<User>): Observable<User> {
    if (this.mockMode) {
      return this.mockUpdateUser(id, user);
    }
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, user);
  }

  /**
   * Mock update user
   */
  private mockUpdateUser(id: number, user: Partial<User>): Observable<User> {
    const updatedUser: User = {
      userId: id,
      email: user.email || `user${id}@example.com`,
      fullName: user.fullName || `User ${id}`,
      username: user.username || `user${id}`,
      role: user.role || UserRole.CUSTOMER
    };
    return of(updatedUser).pipe(delay(300));
  }

  /**
   * Delete user (admin only)
   */
  delete(id: number): Observable<any> {
    if (this.mockMode) {
      return this.mockDeleteUser(id);
    }
    return this.http.delete(`${this.apiUrl}/users/${id}`);
  }

  /**
   * Mock delete user
   */
  private mockDeleteUser(id: number): Observable<any> {
    return of({ success: true }).pipe(delay(300));
  }

  /**
   * Get current user's role
   */
  getCurrentUserRole(): UserRole | null {
    return this.authService.getUserRole();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.authService.getCurrentUser();
  }
}
