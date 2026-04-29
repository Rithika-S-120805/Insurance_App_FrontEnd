import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);

  constructor() {
    console.log('[INTERCEPTOR] AuthInterceptor instantiated');
  }

  // Helper function to decode JWT token
  private decodeJWT(token: string): any {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('[INTERCEPTOR] Error decoding JWT:', error);
      return null;
    }
  }

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Get JWT token from localStorage directly (most reliable method)
    let token = localStorage.getItem('authToken');
    
    // Fallback to 'token' key if 'authToken' not found
    if (!token) {
      token = localStorage.getItem('token');
    }

    const user = this.authService.getCurrentUser();

    console.log(`[INTERCEPTOR] ========== REQUEST INTERCEPTED ==========`);
    console.log(`[INTERCEPTOR] URL: ${request.url}`);
    console.log('[INTERCEPTOR] Token in localStorage:', {
      'authToken': localStorage.getItem('authToken') ? 'EXISTS' : 'NOT FOUND',
      'token': localStorage.getItem('token') ? 'EXISTS' : 'NOT FOUND',
      'finalToken': token ? `${token.substring(0, 30)}...` : 'NONE'
    });
    console.log('[INTERCEPTOR] Current user:', user);

    // Decode and log JWT payload if token exists
    if (token) {
      const decodedToken = this.decodeJWT(token);
      console.log('[INTERCEPTOR] Decoded JWT payload:', decodedToken);
      console.log('[INTERCEPTOR] Token length:', token.length);
      console.log('[INTERCEPTOR] Token starts with:', token.substring(0, 20) + '...');
    }

    // If token exists and request is not for login/register, attach it
    if (token && !request.url.includes('/auth/login') && !request.url.includes('/auth/register')) {
      const authHeader = `Bearer ${token}`;
      const modifiedRequest = request.clone({
        setHeaders: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[INTERCEPTOR] ✅ HEADER ADDED`);
      console.log('[INTERCEPTOR] Authorization header:', authHeader.substring(0, 50) + '...');
      console.log('[INTERCEPTOR] All request headers:', Array.from(modifiedRequest.headers.keys()));
      
      // Verify header was actually set
      const authFromRequest = modifiedRequest.headers.get('Authorization');
      console.log('[INTERCEPTOR] Verification - Authorization header in request:', authFromRequest ? authFromRequest.substring(0, 50) + '...' : 'NOT FOUND');
      console.log(`[INTERCEPTOR] ========== END REQUEST ==========\n`);
      
      return next.handle(modifiedRequest).pipe(
        tap((event) => {
          if (event.type === 4) { // HttpResponse
            console.log(`[INTERCEPTOR] ✅ Response received for ${request.url}: Status ${event.status}`);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`[INTERCEPTOR] ❌ ERROR for ${request.url}: Status ${error.status}`);
          const headersObj: { [key: string]: string } = {};
          error.headers.keys().forEach(key => {
            headersObj[key] = error.headers.get(key) || '';
          });
          console.error('[INTERCEPTOR] Error response headers:', headersObj);
          return throwError(() => error);
        })
      );
    } else {
      console.log(`[INTERCEPTOR] ⚠️ SKIPPED - Token: ${!!token}, Is Auth Route: ${request.url.includes('/auth/login') || request.url.includes('/auth/register')}`);
      console.log(`[INTERCEPTOR] ========== END REQUEST ==========\n`);
      return next.handle(request).pipe(
        tap((event) => {
          if (event.type === 4) { // HttpResponse
            console.log(`[INTERCEPTOR] ✅ Response received for ${request.url}: Status ${event.status}`);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error(`[INTERCEPTOR] ❌ ERROR for ${request.url}: Status ${error.status}`);
          return throwError(() => error);
        })
      );
    }
  }
}

