import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';
import { usePlatform } from '../../context/PlatformContext';

type CloseTask = { label: string; key: string; value: boolean };

export const MonthEndCloseWorkspace: React.FC = () => {
  const { lang } = usePlatform();
  const isAr = lang === 'ar';
  const [periods, setPeriods] = useState<any[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPeriods = async () => {
    setLoading(true);
    try {
      const result = await ApiClient.getGLFiscalPeriods();
      setPeriods(Array.isArray(result) ? result : []);
      const open = result.find((period: any) => period.status === 'OPEN' || period.status === 'REOPENED');
      const selected = open || result[0];
      if (selected) {
        setPeriodId(selected.id);
        setChecklist(await ApiClient.getGLClosingChecklist(selected.id));
      }
    } catch (err: any) {
      setError(err?.message || (isAr ? 'تعذر تحميل فترات الإغلاق' : 'Unable to load close periods'));
    } finally {
      setLoading(false);
    }
  };

  const selectPeriod = async (id: string) => {
    setPeriodId(id);
    setMessage('');
    setError('');
    try {
      setChecklist(await ApiClient.getGLClosingChecklist(id));
    } catch (err: any) {
      setError(err?.message || (isAr ? 'تعذر تحميل قائمة الإغلاق' : 'Unable to load close checklist'));
    }
  };

  useEffect(() => { loadPeriods(); }, []);

  const closePeriod = async () => {
    if (!periodId) return;
    setMessage('');
    setError('');
    try {
      await ApiClient.closeGLPeriod(periodId, 'usr-001');
      setMessage(isAr ? 'تم إغلاق الفترة وإنشاء لقطة الإغلاق.' : 'Period closed and closing snapshot created.');
      await loadPeriods();
    } catch (err: any) {
      setError(err?.message || (isAr ? 'تعذر إغلاق الفترة' : 'Period close was rejected'));
    }
  };

  const tasks: CloseTask[] = checklist ? [
    { label: isAr ? 'مطابقة البنك' : 'Bank Reconciliation', key: 'isForeignCurrencyRevalued', value: Boolean(checklist.isForeignCurrencyRevalued) },
    { label: isAr ? 'مطابقة العملاء' : 'AR Reconciliation', key: 'isARClosed', value: Boolean(checklist.isARClosed) },
    { label: isAr ? 'مطابقة الموردين' : 'AP Reconciliation', key: 'isAPClosed', value: Boolean(checklist.isAPClosed) },
    { label: isAr ? 'مطابقة المخزون' : 'Inventory Reconciliation', key: 'isInventoryClosed', value: Boolean(checklist.isInventoryClosed) },
    { label: isAr ? 'الاستحقاقات والأحداث' : 'Accruals and Events', key: 'isAllEventsProcessed', value: Boolean(checklist.isAllEventsProcessed) },
    { label: isAr ? 'مراجعة الحسابات المعلقة' : 'Suspense Review', key: 'isSuspenseAccountsCleared', value: Boolean(checklist.isSuspenseAccountsCleared) },
    { label: isAr ? 'مراجعة ميزان المراجعة' : 'Trial Balance Review', key: 'isTrialBalanceBalanced', value: Boolean(checklist.isTrialBalanceBalanced) },
    { label: isAr ? 'مراجعة البيانات المالية' : 'Financial Statements Review', key: 'isSubledgersReconciled', value: Boolean(checklist.isSubledgersReconciled) }
  ] : [];

  const currentPeriod = periods.find(period => period.id === periodId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isAr ? 'مساحة إغلاق نهاية الشهر' : 'Month-End Close Workspace'}</h2>
          <p className="text-xs text-slate-500">{isAr ? 'Open → Review → Prepare → Approve → Close → Lock' : 'Open → Review → Prepare → Approve → Close → Lock'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={periodId} onChange={event => selectPeriod(event.target.value)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs">
            {periods.map(period => <option key={period.id} value={period.id}>{period.periodName} ({period.year}) — {period.status}</option>)}
          </select>
          <button onClick={loadPeriods} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-xs">{message}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {loading ? <div className="report-card rounded-xl p-8 text-center text-xs text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</div> : checklist && (
        <>
          <div className="report-card rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><div className="text-xs text-slate-500">{isAr ? 'الفترة الحالية' : 'Current period'}</div><div className="font-bold text-slate-900 dark:text-white">{currentPeriod?.periodName} ({currentPeriod?.year})</div></div>
            <div className={`text-sm font-bold ${checklist.canClose ? 'text-emerald-600' : 'text-amber-600'}`}>{checklist.canClose ? (isAr ? 'جاهزة للإغلاق' : 'Ready to close') : (isAr ? 'توجد استثناءات' : 'Exceptions require review')}</div>
            <button disabled={!checklist.canClose || currentPeriod?.status === 'CLOSED'} onClick={closePeriod} className="rounded-lg bg-brand-navy text-brand-gold px-4 py-2 text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{isAr ? 'إغلاق وقفل الفترة' : 'Close and lock period'}</button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {tasks.map(task => <div key={task.key} className="report-card rounded-xl p-4"><div className="flex items-center gap-2 text-xs font-semibold">{task.value ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}{task.label}</div><div className={`text-[11px] mt-2 ${task.value ? 'text-emerald-600' : 'text-amber-600'}`}>{task.value ? 'Completed' : 'Exception / Pending'}</div></div>)}
          </div>
          {checklist.blockers?.length > 0 && <div className="report-card rounded-xl p-5"><h3 className="font-bold text-sm mb-3">{isAr ? 'أسباب عدم الإغلاق' : 'Close blockers'}</h3><ul className="list-disc pl-5 space-y-1 text-xs text-rose-700">{checklist.blockers.map((blocker: string) => <li key={blocker}>{blocker}</li>)}</ul></div>}
        </>
      )}
    </div>
  );
};
