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
    // Get JWT token from auth service
    const token = this.authService.getToken();
    const user = this.authService.getCurrentUser();

    console.log(`[INTERCEPTOR] Intercepting request to: ${request.url}`);
    console.log('[INTERCEPTOR] Token available:', !!token);
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
      request = request.clone({
        setHeaders: {
          Authorization: authHeader
        }
      });
      console.log(`[INTERCEPTOR] ✅ Added Authorization header for: ${request.url}`);
      console.log('[INTERCEPTOR] Authorization:', authHeader.substring(0, 50) + '...');
      console.log('[INTERCEPTOR] Request headers:', request.headers);
    } else {
      console.log(`[INTERCEPTOR] ⚠️ Skipped Authorization - Token: ${!!token}, URL: ${request.url}`);
    }

    // Pass request through and log errors
    console.log(`[INTERCEPTOR] 🚀 Sending request to: ${request.url} with headers:`, request.headers.keys());
    return next.handle(request).pipe(
      tap((event) => {
        // Success
      }),
      catchError((error: HttpErrorResponse) => {
        // Convert HttpHeaders to plain object for logging
        const headersObj: { [key: string]: string } = {};
        error.headers.keys().forEach(key => {
          headersObj[key] = error.headers.get(key) || '';
        });

        console.error(`[INTERCEPTOR] ❌ Error for ${request.url}:`, {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          headers: headersObj,
          body: error.error
        });
        return throwError(() => error);
      })
    );
  }
}

