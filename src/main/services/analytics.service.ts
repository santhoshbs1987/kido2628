import { getDb } from '../db/database';
import { RegisterShift } from '../db/schema';

export interface DashboardMetrics {
  todaySales: number;
  todayProfit: number;
  todayBills: number;
  monthSales: number;
  monthProfit: number;
  monthBills: number;
  filteredSales: number;
  filteredProfit: number;
  filteredBills: number;
  filteredReturns: number;
  filteredReturnAmount: number;
  activeShift: RegisterShift | null;
  lowStockCount: number;
}

export class AnalyticsService {
  static getMetrics(fromDate?: string, toDate?: string): DashboardMetrics {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    // Helper to calculate sales, COGS, returns for a date range
    const calcPeriod = (startDate: string, endDate: string) => {
      const salesRow = db.prepare(`
        SELECT
          COUNT(*) as bills,
          COALESCE(SUM(grand_total), 0) as total_sales,
          COALESCE(SUM(total_cogs), 0) as total_cogs
        FROM sales
        WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
      `).get(startDate, endDate) as any;

      const returnRow = db.prepare(`
        SELECT
          COUNT(*) as return_count,
          COALESCE(SUM(total_refund), 0) as total_refunds
        FROM returns
        WHERE is_voided = 0 AND date(created_at) >= date(?) AND date(created_at) <= date(?)
      `).get(startDate, endDate) as any;

      const grossSales = salesRow.total_sales;
      const cogs = salesRow.total_cogs;
      const refunds = returnRow.total_refunds;

      const netSales = grossSales - refunds;
      // Net Profit = (Sales - COGS) - Returns Refunded
      const netProfit = (grossSales - cogs) - refunds;

      return {
        bills: salesRow.bills,
        netSales: Math.max(0, netSales),
        netProfit,
        returns: returnRow.return_count,
        refunds
      };
    };

    const todayStats = calcPeriod(today, today);
    const monthStats = calcPeriod(monthStart, today);

    const fStart = fromDate || today;
    const fEnd = toDate || today;
    const filteredStats = calcPeriod(fStart, fEnd);

    // Active shift
    const activeShift = AnalyticsService.getActiveShift();

    // Low stock count
    const thresholdRow = db.prepare('SELECT low_stock_threshold FROM settings WHERE id = 1').get() as any;
    const threshold = thresholdRow?.low_stock_threshold ?? 3;
    const lowStockRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM product_variants
      WHERE current_stock <= ?
    `).get(threshold) as any;

    return {
      todaySales: todayStats.netSales,
      todayProfit: todayStats.netProfit,
      todayBills: todayStats.bills,
      monthSales: monthStats.netSales,
      monthProfit: monthStats.netProfit,
      monthBills: monthStats.bills,
      filteredSales: filteredStats.netSales,
      filteredProfit: filteredStats.netProfit,
      filteredBills: filteredStats.bills,
      filteredReturns: filteredStats.returns,
      filteredReturnAmount: filteredStats.refunds,
      activeShift,
      lowStockCount: lowStockRow.count
    };
  }

  static getActiveShift(): RegisterShift | null {
    const db = getDb();
    const row = db.prepare("SELECT * FROM register_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get() as any;
    if (!row) return null;
    return {
      id: row.id,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      openingFloat: row.opening_float,
      expectedCash: row.expected_cash,
      countedCash: row.counted_cash,
      cashDifference: row.cash_difference,
      totalCashSales: row.total_cash_sales,
      totalUpiSales: row.total_upi_sales,
      totalCardSales: row.total_card_sales,
      totalReturnsRefunded: row.total_returns_refunded,
      grossSales: row.gross_sales,
      netSales: row.net_sales,
      status: row.status,
      notes: row.notes
    };
  }

  static openShift(openingFloat: number, notes?: string): RegisterShift {
    const db = getDb();
    const now = new Date().toISOString();

    const existingOpen = AnalyticsService.getActiveShift();
    if (existingOpen) {
      throw new Error(`Register shift #${existingOpen.id} is already open since ${new Date(existingOpen.openedAt).toLocaleTimeString()}. Please close it before opening a new shift.`);
    }

    const floatVal = Math.max(0, Number(openingFloat) || 0);

    const result = db.prepare(`
      INSERT INTO register_shifts (
        opened_at, opening_float, expected_cash, total_cash_sales, total_upi_sales,
        total_card_sales, total_returns_refunded, gross_sales, net_sales, status, notes
      ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 'OPEN', ?)
    `).run(now, floatVal, floatVal, notes || null);

    return AnalyticsService.getActiveShift()!;
  }

  static closeShift(countedCash: number, notes?: string): RegisterShift {
    const db = getDb();
    const now = new Date().toISOString();

    const openShift = AnalyticsService.getActiveShift();
    if (!openShift) {
      throw new Error('No open shift found to close. Please open a shift first.');
    }

    const cash = Math.max(0, Number(countedCash) || 0);
    const diff = cash - openShift.expectedCash;

    db.prepare(`
      UPDATE register_shifts
      SET
        closed_at = ?,
        counted_cash = ?,
        cash_difference = ?,
        status = 'CLOSED',
        notes = CASE
          WHEN notes IS NOT NULL THEN notes || ' | ' || ?
          ELSE ?
        END
      WHERE id = ?
    `).run(now, cash, diff, notes || 'Closed', notes || 'Closed', openShift.id);

    const closed = db.prepare('SELECT * FROM register_shifts WHERE id = ?').get(openShift.id) as any;
    return {
      id: closed.id,
      openedAt: closed.opened_at,
      closedAt: closed.closed_at,
      openingFloat: closed.opening_float,
      expectedCash: closed.expected_cash,
      countedCash: closed.counted_cash,
      cashDifference: closed.cash_difference,
      totalCashSales: closed.total_cash_sales,
      totalUpiSales: closed.total_upi_sales,
      totalCardSales: closed.total_card_sales,
      totalReturnsRefunded: closed.total_returns_refunded,
      grossSales: closed.gross_sales,
      netSales: closed.net_sales,
      status: closed.status,
      notes: closed.notes
    };
  }

  static getShiftHistory(): RegisterShift[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM register_shifts ORDER BY id DESC LIMIT 50').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      openingFloat: r.opening_float,
      expectedCash: r.expected_cash,
      countedCash: r.counted_cash,
      cashDifference: r.cash_difference,
      totalCashSales: r.total_cash_sales,
      totalUpiSales: r.total_upi_sales,
      totalCardSales: r.total_card_sales,
      totalReturnsRefunded: r.total_returns_refunded,
      grossSales: r.gross_sales,
      netSales: r.net_sales,
      status: r.status,
      notes: r.notes
    }));
  }
}
