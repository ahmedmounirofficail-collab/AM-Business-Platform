import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, FileText, Package, Landmark, ReceiptText, AlertCircle } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { ApiClient } from '../../services/apiClient';

type ReportTab = 'finance' | 'inventory' | 'assets' | 'treasury' | 'tax';

const ReportData: React.FC<{ value: unknown; isAr: boolean }> = ({ value, isAr }) => {
  if (value === null || value === undefined) {
    return <span className="text-slate-500">—</span>;
  }
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-slate-500">{isAr ? 'لا توجد بيانات' : 'No data'}</span>;
    return (
      <div className="overflow-x-auto">
        <table className="am-table w-full text-xs">
          <tbody>
            {value.map((item, index) => (
              <tr key={index}>
                <td className="font-medium text-slate-500">{index + 1}</td>
                <td><ReportData value={item} isAr={isAr} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (typeof value === 'object') {
    return (
      <dl className="grid md:grid-cols-2 gap-x-6 divide-y divide-slate-100 dark:divide-slate-800">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key} className="py-2">
            <dt className="text-[11px] text-slate-500">{key}</dt>
            <dd className="mt-0.5 break-words text-slate-800 dark:text-slate-200"><ReportData value={item} isAr={isAr} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value)}</span>;
};

export const ReportsCenterView: React.FC = () => {
  const { lang, activeCompany } = usePlatform();
  const isAr = lang === 'ar';
  const [tab, setTab] = useState<ReportTab>('finance');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const companyId = activeCompany?.id || 'comp-001';
      if (tab === 'finance') {
        const [trialBalance, incomeStatement, balanceSheet] = await Promise.all([
          ApiClient.getTrialBalance(),
          ApiClient.getIncomeStatement(),
          ApiClient.getBalanceSheet()
        ]);
        setData({ trialBalance, incomeStatement, balanceSheet });
      } else if (tab === 'inventory') {
        setData(await ApiClient.getInventoryCertificationReport());
      } else if (tab === 'assets') {
        const [register, rollForward] = await Promise.all([
          ApiClient.getAssetRegisterReport(companyId),
          ApiClient.getAssetRollForwardReport({ companyId })
        ]);
        setData({ register, rollForward });
      } else if (tab === 'treasury') {
        setData(await ApiClient.getTreasuryDashboard());
      } else {
        setData(null);
      }
    } catch (err: any) {
      setError(err?.message || (isAr ? 'تعذر تحميل التقرير' : 'Unable to load report'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab, activeCompany?.id]);

  const tabs: { id: ReportTab; label: string; labelAr: string; icon: React.ElementType }[] = [
    { id: 'finance', label: 'Financial', labelAr: 'المالية', icon: FileText },
    { id: 'inventory', label: 'Inventory', labelAr: 'المخزون', icon: Package },
    { id: 'assets', label: 'Assets', labelAr: 'الأصول', icon: BarChart3 },
    { id: 'treasury', label: 'Treasury', labelAr: 'الخزينة', icon: Landmark },
    { id: 'tax', label: 'Tax & Compliance', labelAr: 'الضرائب والامتثال', icon: ReceiptText }
  ];

  const number = (value: unknown) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const reportTitle = isAr ? tabs.find(item => item.id === tab)?.labelAr : tabs.find(item => item.id === tab)?.label;

  return (
    <div className="reports-workspace report-shell p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy text-brand-gold"><BarChart3 className="w-5 h-5" /></span>
            {isAr ? 'مركز التقارير' : 'Report Center'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{isAr ? 'تقارير مبنية على البيانات المحفوظة مع مصدر واضح لكل نتيجة.' : 'Persisted-data reports with an explicit source for every result.'}</p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs flex items-center gap-1.5 w-fit">
          <RefreshCw className="w-3.5 h-3.5" /> {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 w-fit">
        {tabs.map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => setTab(item.id)} className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${tab === item.id ? 'bg-brand-navy text-brand-gold' : 'text-slate-600 dark:text-slate-400'}`}>
            <Icon className="w-3.5 h-3.5" /> {isAr ? item.labelAr : item.label}
          </button>;
        })}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      {loading && <div className="report-card rounded-xl p-10 text-center text-xs text-slate-500">{isAr ? 'جاري تحميل التقرير...' : 'Loading report...'}</div>}

      {!loading && !error && tab === 'tax' && (
        <div className="report-card rounded-xl p-6 space-y-2">
          <h2 className="font-bold text-slate-900 dark:text-white">{reportTitle}</h2>
          <p className="text-xs text-slate-500">{isAr ? 'لا يوجد مسار تقرير ضريبي مستقل بعد. حسابات الضريبة موجودة ضمن المستندات والأستاذ العام.' : 'A standalone tax report route is not available yet. Tax calculations currently live in document workflows and GL accounts.'}</p>
          <span className="inline-flex rounded-md bg-amber-100 text-amber-800 px-2 py-1 text-[11px] font-semibold">{isAr ? 'غير متاح حاليًا' : 'Not available'}</span>
        </div>
      )}

      {!loading && !error && tab === 'finance' && data && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="report-card rounded-xl p-5"><h2 className="font-bold mb-3">{isAr ? 'ميزان المراجعة' : 'Trial Balance'}</h2><div className="text-2xl font-bold">{number(data.trialBalance?.totalDebit)}</div><div className="text-xs text-slate-500 mt-1">{data.trialBalance?.isBalanced ? 'Balanced' : 'Difference detected'}</div></div>
          <div className="report-card rounded-xl p-5"><h2 className="font-bold mb-3">{isAr ? 'الأرباح والخسائر' : 'Income Statement'}</h2><div className="text-2xl font-bold">{number(data.incomeStatement?.netIncome)}</div><div className="text-xs text-slate-500 mt-1">Net income</div></div>
          <div className="report-card rounded-xl p-5"><h2 className="font-bold mb-3">{isAr ? 'الميزانية العمومية' : 'Balance Sheet'}</h2><div className="text-2xl font-bold">{number(data.balanceSheet?.totalAssets)}</div><div className="text-xs text-slate-500 mt-1">Total assets</div></div>
        </div>
      )}

      {!loading && !error && tab === 'inventory' && data && (
        <div className="report-card rounded-xl p-5"><h2 className="font-bold mb-3">{isAr ? 'تقرير اعتماد المخزون' : 'Inventory Certification'}</h2><ReportData value={data} isAr={isAr} /></div>
      )}

      {!loading && !error && tab === 'assets' && data && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="report-card rounded-xl p-5"><h2 className="font-bold mb-3">{isAr ? 'سجل الأصول' : 'Asset Register'}</h2><ReportData value={data.register} isAr={isAr} /></div>
          <div className="report-card rounded-xl p-5"><h2 className="font-bold mb-3">{isAr ? 'حركة الأصول' : 'Asset Roll-forward'}</h2><ReportData value={data.rollForward} isAr={isAr} /></div>
        </div>
      )}

      {!loading && !error && tab === 'treasury' && data && (
        <div className="report-card rounded-xl p-5"><h2 className="font-bold mb-3">{isAr ? 'ملخص الخزينة' : 'Treasury Dashboard'}</h2><ReportData value={data} isAr={isAr} /></div>
      )}
    </div>
  );
};
