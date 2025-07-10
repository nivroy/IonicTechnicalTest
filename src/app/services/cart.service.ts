import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, setDoc, deleteDoc, getDocs, collection } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from './products.service';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SQLiteConnection, SQLiteDBConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import localforage from 'localforage';

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

  private async openDb(uid: string): Promise<SQLiteDBConnection> {
    if (!this.sqlite) {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }
    if (this.db && this.dbName === uid) {
      return this.db;
    }
    if (this.db) {
      await this.sqlite.closeConnection(this.dbName, false);
    }
    this.dbName = `cart_${uid}`;
    this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
    await this.db.open();
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS items (productId TEXT PRIMARY KEY, nombre TEXT, precio REAL, imagen TEXT, cantidad INTEGER)`
    );
    return this.db;
  }

  private async loadLocalCart(uid: string) {
    if (Capacitor.getPlatform() === 'web') {
      const store = await this.getStore(uid);
      const keys = await store.keys();
      const items = (await Promise.all(keys.map(k => store.getItem<CartItem>(k)))).filter(
        (i): i is CartItem => !!i
      );
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
      await deleteDoc(doc(this.firestore, 'carts', uid, 'items', productId));
    }
  }

  async clearCart() {
    const uid = await this.getUid();
    this.cartItems$.next([]);
    await this.clearLocal(uid);
    if (await this.isOnline()) {
      const itemsRef = collection(this.firestore, 'carts', uid, 'items');
      const snapshot = await getDocs(itemsRef);
      const promises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(promises);
    }
  }

  async sync() {
    if (!(await this.isOnline())) return;
    const uid = await this.getUid();
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
  }
}

