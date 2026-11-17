import { getDb } from '../db/database';
import { Customer } from '../db/schema';

export interface CreateCustomerInput {
  name: string;
  mobile: string;
}

export class CustomersService {
  static getAll(search?: string): Customer[] {
    const db = getDb();
    let query = `
      SELECT
        c.*,
        COUNT(s.id) AS total_bills,
        COALESCE(SUM(s.grand_total), 0) AS total_spent
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
    `;
    const params: any[] = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ' WHERE c.name LIKE ? OR c.mobile LIKE ?';
      params.push(term, term);
    }

    query += ' GROUP BY c.id ORDER BY c.id DESC';

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      mobile: r.mobile,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      totalBills: r.total_bills,
      totalSpent: r.total_spent
    }));
  }

  static findByMobile(mobile: string): Customer | null {
    const db = getDb();
    const cleanMobile = mobile.trim();
    const row = db.prepare('SELECT * FROM customers WHERE mobile = ?').get(cleanMobile) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      mobile: row.mobile,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static findOrCreate(mobile: string, name: string): Customer {
    const db = getDb();
    const cleanMobile = mobile.trim();
    const cleanName = name.trim() || 'Valued Customer';
    const now = new Date().toISOString();

    const existing = CustomersService.findByMobile(cleanMobile);
    if (existing) {
      if (cleanName && cleanName !== 'Valued Customer' && existing.name !== cleanName) {
        db.prepare('UPDATE customers SET name = ?, updated_at = ? WHERE id = ?').run(cleanName, now, existing.id);
        existing.name = cleanName;
      }
      return existing;
    }

    const result = db.prepare(`
      INSERT INTO customers (name, mobile, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(cleanName, cleanMobile, now, now);

    return {
      id: Number(result.lastInsertRowid),
      name: cleanName,
      mobile: cleanMobile,
      createdAt: now,
      updatedAt: now
    };
  }

  static create(input: CreateCustomerInput): Customer {
    const db = getDb();
    const cleanMobile = input.mobile.trim();
    const cleanName = input.name.trim();

    if (!cleanMobile) throw new Error('Mobile number is required.');
    if (!cleanName) throw new Error('Customer name is required.');

    const existing = CustomersService.findByMobile(cleanMobile);
    if (existing) {
      throw new Error(`Customer with mobile ${cleanMobile} already exists.`);
    }

    return CustomersService.findOrCreate(cleanMobile, cleanName);
  }

  static update(id: number, input: CreateCustomerInput): Customer {
    const db = getDb();
    const cleanMobile = input.mobile.trim();
    const cleanName = input.name.trim();
    const now = new Date().toISOString();

    const existingWithMobile = db.prepare('SELECT id FROM customers WHERE mobile = ? AND id != ?').get(cleanMobile, id);
    if (existingWithMobile) {
      throw new Error(`Another customer already has mobile number ${cleanMobile}.`);
    }

    db.prepare('UPDATE customers SET name = ?, mobile = ?, updated_at = ? WHERE id = ?').run(
      cleanName,
      cleanMobile,
      now,
      id
    );

    return {
      id,
      name: cleanName,
      mobile: cleanMobile,
      createdAt: '',
      updatedAt: now
    };
  }

  static delete(id: number): { success: boolean; message: string } {
    const db = getDb();
    // Confirmed Delete action to Customer Directory: Deleting a customer leaves the sales history intact
    // (Customer id in sales becomes null or stays intact via ON DELETE SET NULL)
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return { success: true, message: 'Customer record deleted. Associated sales history is preserved.' };
  }
}
