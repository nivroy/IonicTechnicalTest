import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';
import { CartService } from './cart.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private cartService = inject(CartService);

  // undefined = aún no cargado, null = no logueado, User = logueado
  private userSubject = new BehaviorSubject<User | null | undefined>(undefined);

  
  constructor() {
    setPersistence(this.auth, browserLocalPersistence)
      .then(() => {
        onAuthStateChanged(this.auth, (user) => {
          this.userSubject.next(user);
        });
      })
      .catch((error) => {
        console.error('Error al establecer la persistencia:', error);
      });
  }

  /** Observable que emite true/false si el usuario está autenticado */
  isAuthenticated(): Observable<boolean> {
    return this.userSubject.asObservable().pipe(map(user => !!user));
  }

  
  waitForAuthReady(): Observable<User | null> {
    return this.userSubject.asObservable().pipe(
      filter((user): user is User | null => user !== undefined)
    );
  }

  /** Devuelve el usuario actual (o null si no hay sesión) */
  getCurrentUser(): User | null {
    return this.userSubject.value ?? null;
  }

  /** Devuelve el UID si hay usuario logueado */
  getUid(): string | null {
    return this.userSubject.value?.uid ?? null;
  }

  /** Login con email y contraseña */
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /** Logout del usuario */
  async logout() {
    try {
      await this.cartService.clearCart();
    } catch (e) {
      console.warn('Error clearing cart on logout:', e);
    }
    return signOut(this.auth);
  }

  /** Registro con email y contraseña */
  register(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

}
