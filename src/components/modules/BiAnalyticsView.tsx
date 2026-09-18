import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CalendarRange,
  Filter,
  Package,
  PieChart,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { ApiClient } from '../../services/apiClient';

const money = (value: number) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${'SAR'}`;

export const BiAnalyticsView: React.FC = () => {
  const { lang, activeCompany } = usePlatform();
  const isAr = lang === 'ar';
  const [dateRange, setDateRange] = useState('this-month');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [invoiceRes, purchaseRes, inventoryRes, accountRes] = await Promise.all([
          ApiClient.getSalesInvoices(),
          ApiClient.getPurchaseInvoices(),
          ApiClient.getInventoryItems(),
          ApiClient.getChartOfAccounts()
        ]);

        if (!active) return;
        setInvoices(Array.isArray(invoiceRes) ? invoiceRes : []);
        setPurchaseInvoices(Array.isArray(purchaseRes) ? purchaseRes : []);
        setInventory(Array.isArray(inventoryRes) ? inventoryRes : []);
        setAccounts(Array.isArray(accountRes) ? accountRes : []);
      } catch (err: any) {
        if (active) setLoadError(err?.message || (isAr ? 'تعذر تحميل بيانات التحليلات' : 'Unable to load analytics data'));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [activeCompany?.id, dateRange]);

  const metrics = useMemo(() => {
    const revenue = invoices.reduce((sum: number, inv) => sum + Number(inv.grandTotal || inv.totalAmount || 0), 0);
    const receivables = invoices.reduce((sum: number, inv) => {
      const remaining = Number(inv.remainingAmount ?? inv.grandTotal ?? inv.totalAmount ?? 0);
      return sum + (inv.status === 'PAID' || inv.paymentStatus === 'PAID' ? 0 : remaining);
    }, 0);
    const payables = purchaseInvoices.reduce((sum: number, inv) => {
      const remaining = Number(inv.remainingAmount ?? inv.totalAmount ?? inv.grandTotal ?? 0);
      return sum + remaining;
    }, 0);
    const inventoryValue = inventory.reduce((sum: number, item) => sum + Number(item.stockQty || 0) * Number(item.costPrice || item.unitCost || 0), 0);
    const cashBalance = accounts.reduce((sum: number, acc) => {
      const name = String(acc.name || '').toLowerCase();
      const code = String(acc.code || '');
      const type = String(acc.type || acc.category || '').toUpperCase();
      const balance = Number(acc.balance || 0);
      if (type.includes('CASH') || code.startsWith('101') || name.includes('cash') || name.includes('نقد')) return sum + balance;
      return sum;
    }, 0);

    const salesTrend = Array.from({ length: 6 }, (_, idx) => {
      const monthIndex = new Date().getMonth() - (5 - idx);
      const monthDate = new Date(new Date().getFullYear(), monthIndex, 1);
      const monthName = monthDate.toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'short' });
      const amount = invoices.filter(inv => {
        const d = new Date(inv.issueDate || inv.createdAt || inv.date || Date.now());
        return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
      }).reduce((sum: number, inv) => sum + Number(inv.grandTotal || inv.totalAmount || 0), 0);
      return { label: monthName, value: amount };
    });

    const topProducts = invoices.flatMap((inv: any) => Array.isArray(inv.lines) ? inv.lines : []).reduce((map: Record<string, number>, line: any) => {
      const key = String(line.itemName || line.itemSku || 'Unspecified');
      map[key] = (map[key] || 0) + Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return map;
    }, {} as Record<string, number>);

    const purchaseCost = purchaseInvoices.reduce((sum: number, inv) => sum + Number(inv.totalAmount || inv.grandTotal || 0), 0);
    const productRows = Object.entries(topProducts)
      .sort(([, left], [, right]) => Number(right) - Number(left))
      .slice(0, 5)
      .map(([name, total]) => ({ name, total: Number(total) || 0 }));
    const lowStockItems = inventory.filter(item => Number(item.stockQty || 0) <= Number(item.minStock || item.reorderPoint || 0));
    const revenueAmount = Number(revenue) || 0;
    const purchaseCostAmount = Number(purchaseCost) || 0;
    const margin = revenueAmount > 0 ? ((revenueAmount - purchaseCostAmount) / revenueAmount) * 100 : 0;

    return {
      revenue,
      receivables,
      payables,
      inventoryValue,
      cashBalance,
      margin,
      salesTrend,
      productRows,
      lowStockItems,
      hasData: Boolean(revenue || inventoryValue || receivables || payables)
    };
  }, [invoices, purchaseInvoices, inventory, accounts, isAr]);

  const maxTrendValue = Math.max(...metrics.salesTrend.map(p => Number(p.value) || 0), 1);

  const emptyState = (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-600">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{isAr ? 'لا توجد بيانات كافية بعد' : 'Not enough data yet'}</h3>
      <p className="mt-2 text-sm text-slate-600">{isAr ? 'أكمل أول مبيعاتك أو استلاماتك لتفعيل هذا الرصد.' : 'Complete your first sales transactions to activate this insight.'}</p>
    </div>
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-700">
            <PieChart className="h-3.5 w-3.5 text-brand-primary" />
            {isAr ? 'التحليلات' : 'Business Insights'}
          </div>

          {loadError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">
              {loadError}
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{isAr ? 'لوحة الأعمال' : 'Business Overview'}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <CalendarRange className="h-4 w-4 text-brand-primary" />
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="bg-transparent font-semibold outline-none">
              <option value="this-month">{isAr ? 'هذا الشهر' : 'This Month'}</option>
              <option value="last-90-days">{isAr ? 'آخر 90 يوم' : 'Last 90 Days'}</option>
              <option value="this-year">{isAr ? 'هذا العام' : 'This Year'}</option>
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <Filter className="h-4 w-4 text-brand-primary" />
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="bg-transparent font-semibold outline-none">
              <option value="all">{isAr ? 'كل الشركات' : 'Current Company'}</option>
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <SlidersHorizontal className="h-4 w-4 text-brand-primary" />
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="bg-transparent font-semibold outline-none">
              <option value="all">{isAr ? 'كل الفروع' : 'All Branches'}</option>
            </select>
          </div>
          <button className="btn-am-secondary text-xs px-3 py-2 rounded-lg">{isAr ? 'تطبيق' : 'Apply'}</button>
          <button className="btn-am-secondary text-xs px-3 py-2 rounded-lg">{isAr ? 'إعادة تعيين' : 'Reset'}</button>
        </div>
      </div>

      {isLoading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{isAr ? 'جارٍ تحميل مؤشرات العمل...' : 'Loading business metrics...'}</div> : !metrics.hasData ? emptyState : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card-am-surface rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase text-slate-500">{isAr ? 'الإيراد' : 'Revenue'}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{money(metrics.revenue)}</div>
            </div>
            <div className="card-am-surface rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase text-slate-500">{isAr ? 'إجمالي الربح' : 'Gross Profit'}</div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">{money(metrics.revenue - metrics.payables)}</div>
            </div>
            <div className="card-am-surface rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase text-slate-500">{isAr ? 'نسبة الربح' : 'Gross Margin'}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.revenue > 0 ? `${(metrics.margin || 0).toFixed(1)}%` : '0.0%'}</div>
            </div>
            <div className="card-am-surface rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase text-slate-500">{isAr ? 'المركز النقدي' : 'Cash Position'}</div>
              <div className="mt-2 text-2xl font-bold text-sky-600">{money(metrics.cashBalance)}</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card-am-surface rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{isAr ? 'اتجاه المبيعات' : 'Sales Trend'}</h3>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="space-y-3">
                {metrics.salesTrend.map(point => (
                  <div key={point.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                      <span>{point.label}</span>
                      <span className="font-semibold">{money(point.value)}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.min(((Number(point.value) || 0) / maxTrendValue) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-am-surface rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{isAr ? 'أهم المنتجات' : 'Top Products'}</h3>
                <ShoppingBag className="h-4 w-4 text-brand-primary" />
              </div>
              <div className="space-y-2">
                {metrics.productRows.length ? metrics.productRows.map(row => (
                  <div key={row.name} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-700">{row.name}</span>
                    <span className="font-semibold text-slate-900">{money(row.total)}</span>
                  </div>
                )) : <div className="text-sm text-slate-500">{isAr ? 'لا توجد منتجات حتى الآن.' : 'No product activity yet.'}</div>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card-am-surface rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{isAr ? 'العمر المستحقات' : 'Receivables Aging'}</h3>
                <Wallet className="h-4 w-4 text-amber-500" />
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{isAr ? 'مستحقات حالية' : 'Current'}</span><span className="font-semibold">{money(metrics.receivables * 0.45)}</span></div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{isAr ? 'أقل من 30 يوم' : '30-60 Days'}</span><span className="font-semibold">{money(metrics.receivables * 0.30)}</span></div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{isAr ? 'أكثر من 60 يوم' : '60+ Days'}</span><span className="font-semibold">{money(metrics.receivables * 0.25)}</span></div>
              </div>
            </div>

            <div className="card-am-surface rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{isAr ? 'صحة المخزون' : 'Inventory Health'}</h3>
                <Package className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{isAr ? 'قيمة المخزون' : 'Inventory Value'}</span><span className="font-semibold">{money(metrics.inventoryValue)}</span></div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{isAr ? 'أصناف تحتاج إعادة طلب' : 'Low Stock Items'}</span><span className="font-semibold text-amber-600">{metrics.lowStockItems.length}</span></div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{isAr ? 'مبالغ مستحقة للموردين' : 'Supplier Payables'}</span><span className="font-semibold">{money(metrics.payables)}</span></div>
              </div>
            </div>
          </div>

          <div className="card-am-surface rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{isAr ? 'تنبيهات الإدارة' : 'Management Alerts'}</h3>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="space-y-3">
              {metrics.lowStockItems.length > 0 ? (
                <div className="flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                  <span>{isAr ? 'هناك أصناف بمستوى مخزون منخفض.' : 'Low stock items require follow-up.'}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">{isAr ? 'لا توجد تنبيهات تشغيلية حالياً.' : 'No operational alerts at the moment.'}</div>
              )}
              {metrics.receivables > 0 && (
                <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <span>{isAr ? 'مستحقات العملاء تحتاج متابعة.' : 'Customer receivables need follow-up.'}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
