// src/app/services/storage/sqlite-cart-storage.ts
import { LocalCartStorage } from './local-cart-storage.interface';
import { CartItem } from '../../models/cart-item.model';
import { SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

export class SQLiteCartStorage implements LocalCartStorage {
    private db: SQLiteDBConnection | null = null;
    private dbName: string;

    constructor(private uid: string, private sqlite: SQLiteConnection) {
        this.dbName = `cart_${uid}`;
    }

    private async getDb(): Promise<SQLiteDBConnection> {
        try {
            if (!this.sqlite) {
                throw new Error('SQLiteConnection no inicializado');
            }

            const isConn = (await this.sqlite.isConnection(this.dbName, false)).result;

            if (isConn) {
                this.db = await this.sqlite.retrieveConnection(this.dbName, false);
            } else {
                this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
            }

            await this.db.open();
            await this.ensureTables(this.db);

            return this.db;
        } catch (error) {
            console.error('[SQLiteCartStorage] Error al abrir DB, intentando limpiar:', error);

            try {
                await this.sqlite.closeConnection(this.dbName, false);
            } catch (e) {
                console.warn('[SQLiteCartStorage] No se pudo cerrar la conexión corrupta:', e);
            }

            try {
                this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
                await this.db.open();
                await this.ensureTables(this.db);
                console.log('Coneccion exitosa');
                return this.db;
            } catch (finalError) {
                console.error('[SQLiteCartStorage] Error final al abrir DB después de limpiar:', finalError);
                throw finalError;
            }
        }
    }

    private async ensureTables(db: SQLiteDBConnection): Promise<void> {
        await db.execute(`
      CREATE TABLE IF NOT EXISTS items (
        productId TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        image TEXT,
        quantity INTEGER,
        updatedAt INTEGER,
        deleted INTEGER
      )
    `);

        await db.execute(`
      CREATE TABLE IF NOT EXISTS pending_sync (
        productId TEXT PRIMARY KEY
      )
    `);
    }
    async getAllItems?(includeDeleted: boolean): Promise<CartItem[]> {
        const db = await this.getDb();
        const query = includeDeleted
            ? 'SELECT * FROM items'
            : 'SELECT * FROM items WHERE deleted != 1 OR deleted IS NULL';
        const res = await db.query(query);
        return (res.values as CartItem[]).map(i => ({ ...i, deleted: !!i.deleted })) || [];
    }
    
    async getItems(): Promise<CartItem[]> {
        return this.getAllItems?.(false) ?? []; 
    }

    async saveItem(item: CartItem): Promise<void> {
        const db = await this.getDb();
        await db.run(
            'INSERT OR REPLACE INTO items (productId, name, price, image, quantity, updatedAt, deleted) VALUES (?,?,?,?,?,?,?)',
            [item.productId, item.name, item.price, item.image, item.quantity, item.updatedAt, item.deleted ? 1 : 0]
        );
    }

    async removeItem(productId: string): Promise<void> {
        const db = await this.getDb();
        await db.run('DELETE FROM items WHERE productId = ?', [productId]);
    }

    async clear(): Promise<void> {
        const db = await this.getDb();
        await db.execute('DELETE FROM items');
    }

    async addPending(productId: string): Promise<void> {
        const db = await this.getDb();
        await db.run('INSERT OR IGNORE INTO pending_sync (productId) VALUES (?)', [productId]);
    }

    async getPending(): Promise<string[]> {
        const db = await this.getDb();
        const res = await db.query('SELECT productId FROM pending_sync');
        return (res.values || []).map((r: any) => r.productId);
    }

    async clearPending(productId: string): Promise<void> {
        const db = await this.getDb();
        await db.run('DELETE FROM pending_sync WHERE productId = ?', [productId]);
    }
}
