// src/app/repositories/cart.repository.ts

import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, setDoc, deleteDoc, getDocs, collection, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../models/product.model';
import { CartItem } from '../models/cart-item.model';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SQLiteConnection } from '@capacitor-community/sqlite';
import { CapacitorSQLite } from '@capacitor-community/sqlite';

import { LocalCartStorage } from '../services/storeage';
import { WebCartStorage } from '../services/storeage';
import { SQLiteCartStorage } from '../services/storeage';
import { onAuthStateChanged } from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class CartRepository {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private localStorage: LocalCartStorage | null = null;

  private sqlite: SQLiteConnection | null = null;
  private cartItems$ = new BehaviorSubject<CartItem[]>([]);
  private unsubscribeFirestoreListener?: () => void;

  constructor() {
    authState(this.auth).subscribe(async user => {
      if (user) {
        const platform = Capacitor.getPlatform();

        if (platform === 'web') {
          this.localStorage = new WebCartStorage(user.uid);
        } else {
          this.sqlite = new SQLiteConnection(CapacitorSQLite);
          this.localStorage = new SQLiteCartStorage(user.uid, this.sqlite);
        }

        const items = await this.localStorage.getItems();
        this.cartItems$.next(items);

        await this.startRealtimeSync(user.uid);

        this.sync();
      } else {
        this.cartItems$.next([]);
        this.localStorage = null;
        await this.closeDb();
      }
    });
  }

  getCartItems(): Observable<CartItem[]> {
    return this.cartItems$.asObservable();
  }

  private async getUid(): Promise<string> {
    const user = await this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return user.uid;
  }

  private async isOnline(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }

  private async closeDb() {
    try {
      const platform = Capacitor.getPlatform();
      if (platform !== 'web' && this.sqlite && this.localStorage instanceof SQLiteCartStorage) {
        await this.sqlite.closeConnection(`cart_${await this.getUid()}`, false);
      }
    } catch (e) {
      console.warn('Error closing SQLite connection:', e);
    }
  }

  async waitForAuth(timeoutMs = 5000): Promise<void> {
    const start = Date.now();

    return new Promise<void>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(this.auth, user => {
        if (user) {
          unsubscribe();
          resolve();
        } else if (Date.now() - start >= timeoutMs) {
          unsubscribe();
          reject(new Error('Auth state timeout'));
        }
      });

      setTimeout(() => {
        unsubscribe();
        reject(new Error('Auth state timeout'));
      }, timeoutMs);
    });
  }

  async addToCart(product: Product) {
    if (!product.id) throw new Error('Product ID is missing');

    const uid = await this.getUid();
    const now = Date.now();
    const currentItems = await this.localStorage!.getItems();

    const existing = currentItems.find(i => i.productId === product.id);

    if (existing) {
      existing.quantity++;
      existing.updatedAt = now;
      existing.deleted = false;
      await this.localStorage!.saveItem(existing);
    } else {
      const item: CartItem = {
        productId: product.id,
        name: product.nombre,
        price: product.precio,
        image: product.imagen,
        quantity: 1,
        updatedAt: now,
      };
      await this.localStorage!.saveItem(item);
    }

    await this.localStorage!.addPending(product.id);

    const updatedItems = await this.localStorage!.getItems();
    this.cartItems$.next(updatedItems);

    if (await this.isOnline()) {
      await this.sync();
    }
  }

  async removeItem(productId: string) {
    const uid = await this.getUid();
    const now = Date.now();

    const items = await this.localStorage!.getItems();
    const item = items.find(i => i.productId === productId);
    if (!item) return;

    item.deleted = true;
    item.updatedAt = now;

    await this.localStorage!.saveItem(item);
    await this.localStorage!.addPending(productId);

    const updatedItems = await this.localStorage!.getItems();
    this.cartItems$.next(updatedItems.filter(i => !i.deleted));

    if (await this.isOnline()) {
      await this.sync();
    }
  }

  async clearCart() {
    const uid = await this.getUid();
    const now = Date.now();

    const items = await this.localStorage!.getItems();

    for (const item of items) {
      item.deleted = true;
      item.updatedAt = now;
      await this.localStorage!.saveItem(item);
      await this.localStorage!.addPending(item.productId);
    }

    this.cartItems$.next([]);

    if (await this.isOnline()) {
      await this.sync();
    }
  }

  private async startRealtimeSync(uid: string) {
    const itemsRef = collection(this.firestore, 'carts', uid, 'items');

    this.unsubscribeFirestoreListener?.();

    this.unsubscribeFirestoreListener = onSnapshot(itemsRef, async snapshot => {
      if (!this.localStorage) return;

      const pending = await this.localStorage.getPending();
      if (pending.length > 0) {
        console.log('[CartRepository] Hay cambios pendientes, ignorando snapshot remoto temporalmente.');
        return;
      }

      const remoteItems: CartItem[] = [];
      snapshot.forEach(doc => {
        const item = doc.data() as CartItem;
        if (!item.deleted) {
          remoteItems.push(item);
        }
      });

      for (const item of remoteItems) {
        await this.localStorage.saveItem(item);
      }

      this.cartItems$.next(remoteItems);
    });
  }


  async sync() {
    try {
      if (!(await this.isOnline())) return;
      await this.waitForAuth();
      const uid = await this.getUid();

      const pending = await this.localStorage!.getPending();

      // 🔧 Usamos getAllItems con includeDeleted = true
      const allItems = await (this.localStorage as LocalCartStorage).getAllItems?.(true) ?? [];

      for (const id of pending) {
        const item = allItems.find((i: CartItem) => i.productId === id);

        if (item) {
          if (item.deleted) {
            await deleteDoc(doc(this.firestore, 'carts', uid, 'items', id));
            await this.localStorage!.removeItem(id);
          } else {
            await setDoc(doc(this.firestore, 'carts', uid, 'items', id), item);
          }
        }

        await this.localStorage!.clearPending(id);
      }

      // 🔄 Luego continuamos la sincronización cruzada normal
      const itemsRef = collection(this.firestore, 'carts', uid, 'items');
      const snapshot = await getDocs(itemsRef);

      const remoteMap = new Map<string, CartItem>();
      snapshot.forEach(d => remoteMap.set(d.id, d.data() as CartItem));

      const localItems = await this.localStorage!.getItems();
      const localMap = new Map<string, CartItem>();
      for (const item of localItems) {
        localMap.set(item.productId, item);
      }

      for (const [id, remoteItem] of remoteMap.entries()) {
        const localItem = localMap.get(id);
        if (!localItem || remoteItem.updatedAt > localItem.updatedAt) {
          await this.localStorage!.saveItem(remoteItem);
          localMap.set(id, remoteItem);
        }
      }

      for (const [id, localItem] of localMap.entries()) {
        const remoteItem = remoteMap.get(id);
        if (!remoteItem && !localItem.deleted) {
          await setDoc(doc(this.firestore, 'carts', uid, 'items', id), localItem);
        } else if (remoteItem && localItem.updatedAt > remoteItem.updatedAt && !localItem.deleted) {
          await setDoc(doc(this.firestore, 'carts', uid, 'items', id), localItem);
        }
      }

      const finalItems = Array.from(localMap.values()).filter(i => !i.deleted);
      this.cartItems$.next(finalItems);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }

}
