import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, setDoc, deleteDoc, getDocs, collection } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../models/product.model';
import { CartItem } from '../models/cart-item.model';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SQLiteConnection, SQLiteDBConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import localforage from 'localforage';
import { onAuthStateChanged } from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class CartRepository {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private dbName = '';
  private cartItems$ = new BehaviorSubject<CartItem[]>([]);

  constructor() {
    authState(this.auth).subscribe(async user => {
      if (user) {
        await this.loadLocalCart(user.uid);
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
          name TEXT,
          price REAL,
          image TEXT,
          quantity INTEGER,
          updatedAt INTEGER,
          deleted INTEGER
        )`
      );
      await this.db.execute(
        `CREATE TABLE IF NOT EXISTS pending_sync (
          productId TEXT PRIMARY KEY
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
            name TEXT,
            price REAL,
            image TEXT,
            quantity INTEGER,
            updatedAt INTEGER,
            deleted INTEGER
          )`
        );
        await this.db.execute(
          `CREATE TABLE IF NOT EXISTS pending_sync (
            productId TEXT PRIMARY KEY
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
      ).filter((i: CartItem | null): i is CartItem => !!i && !i.deleted);
      this.cartItems$.next(items);
    } else {
      const db = await this.openDb(uid);
      const res = await db.query('SELECT * FROM items WHERE deleted != 1 OR deleted IS NULL');
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
        'INSERT OR REPLACE INTO items (productId, name, price, image, quantity, updatedAt, deleted) VALUES (?,?,?,?,?,?,?)',
        [item.productId, item.name, item.price, item.image, item.quantity, item.updatedAt, item.deleted ? 1 : 0]
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

  private async addPending(uid: string, productId: string) {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getMetaStore(uid);
      const pending: string[] = (await store.getItem('pendingSync')) ?? [];
      if (!pending.includes(productId)) {
        pending.push(productId);
        await store.setItem('pendingSync', pending);
      }
    } else {
      const db = await this.openDb(uid);
      await db.run('INSERT OR IGNORE INTO pending_sync (productId) VALUES (?)', [productId]);
    }
  }

  private async getPending(uid: string): Promise<string[]> {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getMetaStore(uid);
      return (await store.getItem<string[]>('pendingSync')) ?? [];
    } else {
      const db = await this.openDb(uid);
      const res = await db.query('SELECT productId FROM pending_sync');
      return (res.values || []).map((r: any) => r.productId as string);
    }
  }

  private async clearPending(uid: string, productId: string) {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getMetaStore(uid);
      const pending: string[] = (await store.getItem('pendingSync')) ?? [];
      const idx = pending.indexOf(productId);
      if (idx >= 0) {
        pending.splice(idx, 1);
        await store.setItem('pendingSync', pending);
      }
    } else {
      const db = await this.openDb(uid);
      await db.run('DELETE FROM pending_sync WHERE productId = ?', [productId]);
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
    const now = Date.now();
    if (existing) {
      existing.quantity++;
      existing.updatedAt = now;
      existing.deleted = false;
      await this.saveItemLocal(uid, existing);
    } else {
      const item: CartItem = {
        productId: product.id!,
        name: product.nombre,
        price: product.precio,
        image: product.imagen,
        quantity: 1,
        updatedAt: now,
      };
      items.push(item);
      await this.saveItemLocal(uid, item);
    }
    await this.addPending(uid, product.id!);
    this.cartItems$.next(items);
    if (await this.isOnline()) {
      await this.sync();
    }
  }

  async removeItem(productId: string) {
    const uid = await this.getUid();
    const items = [...this.cartItems$.value];
    const item = items.find(i => i.productId === productId);
    if (!item) return;
    item.deleted = true;
    item.updatedAt = Date.now();
    await this.saveItemLocal(uid, item);
    await this.addPending(uid, productId);
    this.cartItems$.next(items.filter(i => !i.deleted));
    if (await this.isOnline()) {
      await this.sync();
    }
  }

  async clearCart() {
    const uid = await this.getUid();
    const now = Date.now();
    const items = [...this.cartItems$.value];
    for (const item of items) {
      item.deleted = true;
      item.updatedAt = now;
      await this.saveItemLocal(uid, item);
      await this.addPending(uid, item.productId);
    }
    this.cartItems$.next([]);
    if (await this.isOnline()) {
      await this.sync();
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

      await this.waitForAuth();

      const uid = await this.getUid();
      const pending = await this.getPending(uid);

      for (const id of pending) {
        const store = await this.getStore(uid);
        const item = await store.getItem<CartItem>(id);
        if (item) {
          if (item.deleted) {
            await deleteDoc(doc(this.firestore, 'carts', uid, 'items', id));
            await this.removeItemLocal(uid, id);
          } else {
            await setDoc(doc(this.firestore, 'carts', uid, 'items', id), item);
          }
        }
        await this.clearPending(uid, id);
      }

      const itemsRef = collection(this.firestore, 'carts', uid, 'items');
      const snapshot = await getDocs(itemsRef);
      const remoteMap = new Map<string, CartItem>();
      snapshot.forEach(d => remoteMap.set(d.id, d.data() as CartItem));

      const localStoreItems = await this.getStore(uid).then(store => store.keys().then(keys => Promise.all(keys.map(k => store.getItem<CartItem>(k)))));
      const localMap = new Map<string, CartItem>();
      for (const it of localStoreItems.filter((i: CartItem | null): i is CartItem => !!i)) {
        localMap.set(it.productId, it);
      }

      for (const [id, remoteItem] of remoteMap.entries()) {
        const localItem = localMap.get(id);
        if (!localItem || remoteItem.updatedAt > localItem.updatedAt) {
          await this.saveItemLocal(uid, remoteItem);
          localMap.set(id, remoteItem);
        }
      }

      for (const [id, localItem] of localMap.entries()) {
        if (!remoteMap.has(id) && !localItem.deleted) {
          await this.saveItemLocal(uid, { ...localItem, deleted: true, updatedAt: Date.now() });
          await this.addPending(uid, id);
        }
      }

      const finalItems = Array.from(localMap.values()).filter(i => !i.deleted);
      this.cartItems$.next(finalItems);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }

}

