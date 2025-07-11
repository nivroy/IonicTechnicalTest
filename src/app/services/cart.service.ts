import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, setDoc, deleteDoc, getDocs, collection } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from './products.service';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SQLiteConnection, SQLiteDBConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import localforage from 'localforage';
import { onAuthStateChanged } from 'firebase/auth';

export interface CartItem {
  productId: string;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private dbName = '';
  private cartItems$ = new BehaviorSubject<CartItem[]>([]);
  private pendingRemoteClear = false;

  constructor() {
    authState(this.auth).subscribe(async user => {
      if (user) {
        await this.loadLocalCart(user.uid);
        await this.loadPendingFlag(user.uid);
        this.sync();
      } else {
        this.cartItems$.next([]);
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

  private async getStore(uid: string) {
    return localforage.createInstance({ name: 'cart', storeName: `cart_${uid}` });
  }

  private async getMetaStore(uid: string) {
    return localforage.createInstance({ name: 'cart_meta', storeName: `cart_meta_${uid}` });
  }

  private async loadPendingFlag(uid: string) {
    const store = await this.getMetaStore(uid);
    this.pendingRemoteClear = (await store.getItem<boolean>('pendingClear')) ?? false;
  }

  private async setPendingFlag(uid: string, value: boolean) {
    const store = await this.getMetaStore(uid);
    if (value) {
      await store.setItem('pendingClear', true);
    } else {
      await store.removeItem('pendingClear');
    }
    this.pendingRemoteClear = value;
  }
  
  private async openDb(uid: string): Promise<SQLiteDBConnection> {
    if (!this.sqlite) {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }

    const dbName = `cart_${uid}`;

    if (this.db && this.dbName === dbName) {
      return this.db;
    }

    try {
      const isConn = (await this.sqlite.isConnection(dbName, false)).result;

      if (isConn) {
        // Recupera la conexión si ya existe
        this.db = await this.sqlite.retrieveConnection(dbName, false);
      } else {
        // Si no existe, crea una nueva
        this.db = await this.sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
      }

      this.dbName = dbName;

      await this.db.open();

      await this.db.execute(
        `CREATE TABLE IF NOT EXISTS items (
          productId TEXT PRIMARY KEY,
          nombre TEXT,
          precio REAL,
          imagen TEXT,
          cantidad INTEGER
        )`
      );

      return this.db;
    } catch (error) {
      console.error('Error opening DB, intentando limpiar:', error);

      // Intentamos cerrar si algo salió mal
      try {
        await this.sqlite.closeConnection(dbName, false);
      } catch (e) {
        console.warn('No se pudo cerrar la conexión corrupta:', e);
      }

      // Reintenta creando una nueva conexión
      try {
        this.db = await this.sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
        this.dbName = dbName;

        await this.db.open();

        await this.db.execute(
          `CREATE TABLE IF NOT EXISTS items (
            productId TEXT PRIMARY KEY,
            nombre TEXT,
            precio REAL,
            imagen TEXT,
            cantidad INTEGER
          )`
        );

        return this.db;
      } catch (finalError) {
        console.error('Error final al abrir DB después de limpiar:', finalError);
        throw finalError;
      }
    }
  }


  private async loadLocalCart(uid: string) {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getStore(uid);
      const keys = await store.keys();
      const items = (
        await Promise.all(
          keys.map((k: string) => store.getItem<CartItem>(k))
        )
      ).filter((i: CartItem | null): i is CartItem => !!i);
      this.cartItems$.next(items);
    } else {
      const db = await this.openDb(uid);
      const res = await db.query('SELECT * FROM items');
      this.cartItems$.next((res.values as CartItem[]) || []);
    }
  }

  private async saveItemLocal(uid: string, item: CartItem) {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getStore(uid);
      await store.setItem(item.productId, item);
    } else {
      const db = await this.openDb(uid);
      await db.run(
        'INSERT OR REPLACE INTO items (productId, nombre, precio, imagen, cantidad) VALUES (?,?,?,?,?)',
        [item.productId, item.nombre, item.precio, item.imagen, item.cantidad]
      );
    }
  }

  private async removeItemLocal(uid: string, productId: string) {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getStore(uid);
      await store.removeItem(productId);
    } else {
      const db = await this.openDb(uid);
      await db.run('DELETE FROM items WHERE productId = ?', [productId]);
    }
  }

  private async clearLocal(uid: string) {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getStore(uid);
      await store.clear();
    } else {
      const db = await this.openDb(uid);
      await db.execute('DELETE FROM items');
    }
  }

  private async closeDb() {
    if (this.db) {
      await this.sqlite?.closeConnection(this.dbName, false);
      this.db = null;
    }
  }

  private async isOnline(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }

  async addToCart(product: Product) {
    const uid = await this.getUid();
    const items = [...this.cartItems$.value];
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      existing.cantidad++;
      await this.saveItemLocal(uid, existing);
    } else {
      const item: CartItem = {
        productId: product.id!,
        nombre: product.nombre,
        precio: product.precio,
        imagen: product.imagen,
        cantidad: 1,
      };
      items.push(item);
      await this.saveItemLocal(uid, item);
    }
    this.cartItems$.next(items);
    if (await this.isOnline()) {
      await this.sync();
    }
  }

  async removeItem(productId: string) {
    const uid = await this.getUid();
    const items = this.cartItems$.value.filter(i => i.productId !== productId);
    this.cartItems$.next(items);
    await this.removeItemLocal(uid, productId);
    if (await this.isOnline()) {
      try {
        await deleteDoc(doc(this.firestore, 'carts', uid, 'items', productId));
      } catch (err) {
        console.error('Failed to remove item remotely:', err);
      }
    }
  }

  async clearCart() {
    const uid = await this.getUid();
    this.cartItems$.next([]);
    await this.clearLocal(uid);
    if (await this.isOnline()) {
      try {
        const itemsRef = collection(this.firestore, 'carts', uid, 'items');
        const snapshot = await getDocs(itemsRef);
        const promises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(promises);
        await this.setPendingFlag(uid, false);
      } catch (err) {
        console.error('Failed to clear remote cart:', err);
        await this.setPendingFlag(uid, true);
      }
    } else {
      await this.setPendingFlag(uid, true);
    }
  }
  async waitForAuth(timeoutMs = 5000): Promise<void> {
    const start = Date.now();

    return new Promise<void>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(this.auth, user => {
        console.log('Auth state changed:', user);
        if (user) {
          unsubscribe();
          resolve();
        } else if (Date.now() - start >= timeoutMs) {
          unsubscribe();
          reject(new Error('Auth state timeout'));
        }
      });

      // Fallback timeout
      setTimeout(() => {
        unsubscribe();
        reject(new Error('Auth state timeout'));
      }, timeoutMs);
    });
  }

  async sync() {
    try {
      if (!(await this.isOnline())) return;

      await this.waitForAuth(); // 👈 Esperar hasta que Firebase esté listo

      const uid = await this.getUid();
      if (!uid) return;

      if (this.pendingRemoteClear) {
        try {
          const itemsRef = collection(this.firestore, 'carts', uid, 'items');
          const snapshot = await getDocs(itemsRef);
          const promises = snapshot.docs.map(d => deleteDoc(d.ref));
          await Promise.all(promises);
          await this.setPendingFlag(uid, false);
        } catch (err) {
          console.error('Failed to clear pending remote cart:', err);
          return; // avoid uploading items if clear failed
        }
      }

      const localItems = this.cartItems$.value;
      const itemsRef = collection(this.firestore, 'carts', uid, 'items');
      const snapshot = await getDocs(itemsRef);
      const remoteIds = new Set(snapshot.docs.map(d => d.id));

      for (const item of localItems) {
        await setDoc(doc(this.firestore, 'carts', uid, 'items', item.productId), item);
        remoteIds.delete(item.productId);
      }

      for (const id of remoteIds) {
        await deleteDoc(doc(this.firestore, 'carts', uid, 'items', id));
      }
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }

}

