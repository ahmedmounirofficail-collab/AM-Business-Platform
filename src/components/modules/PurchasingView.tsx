/**
 * AM Business Platform - Purchasing, Procurement & Accounts Payable Module
 */

import React, { useEffect, useState } from 'react';
import { ProcurementManagementView } from '../ProcurementManagementView';
import { AccountsPayableManagementView } from '../AccountsPayableManagementView';
import { ShoppingCart, Receipt, PlusCircle, Truck, PackageCheck, CircleDollarSign } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';
import { usePlatform } from '../../context/PlatformContext';

export const PurchasingView: React.FC = () => {
  const [domainMode, setDomainMode] = useState<'PROCUREMENT' | 'ACCOUNTS_PAYABLE'>('PROCUREMENT');
  const { lang } = usePlatform();
  const isAr = lang === 'ar';
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      ApiClient.getPurchaseOrders().catch(() => []),
      ApiClient.getPurchaseInvoices().catch(() => [])
    ]).then(([orders, invoices]) => {
      setPurchaseOrders(Array.isArray(orders) ? orders : []);
      setPurchaseInvoices(Array.isArray(invoices) ? invoices : []);
    });
  }, []);

  const openPurchaseOrders = purchaseOrders.filter(order => ['DRAFT', 'APPROVED', 'OPEN'].includes(order.status || 'OPEN')).length;
  const pendingReceipts = purchaseOrders.filter(order => order.status === 'PARTIALLY_RECEIVED' || order.status === 'OPEN').length;
  const outstandingPayables = purchaseInvoices.reduce((sum, invoice) => {
    const remaining = Number(invoice.remainingAmount ?? invoice.totalAmount ?? 0);
    return sum + remaining;
  }, 0);

  const overview = (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-brand-navy" />
            <span>{isAr ? 'المشتريات' : 'Purchasing'}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">{isAr ? 'طلبات الشراء، الاستلام، والفواتير الموردية' : 'Purchase requests, receipts, supplier bills, and payment follow-up'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-am-secondary flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg cursor-pointer"><PlusCircle className="w-3.5 h-3.5" />{isAr ? 'طلب شراء' : 'New Purchase Request'}</button>
          <button className="btn-am-secondary flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg cursor-pointer"><Truck className="w-3.5 h-3.5" />{isAr ? 'أمر شراء' : 'New Purchase Order'}</button>
          <button className="btn-am-secondary flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg cursor-pointer"><PackageCheck className="w-3.5 h-3.5" />{isAr ? 'استلام' : 'Record Receipt'}</button>
          <button className="btn-am-accent flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg cursor-pointer"><Receipt className="w-3.5 h-3.5" />{isAr ? 'فاتورة مورد' : 'New Supplier Bill'}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card-am-surface rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">{isAr ? 'أوامر الشراء المفتوحة' : 'Open Purchase Orders'}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{openPurchaseOrders}</div>
        </div>
        <div className="card-am-surface rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">{isAr ? 'الاستلامات المعلقة' : 'Pending Receipts'}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{pendingReceipts}</div>
        </div>
        <div className="card-am-surface rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">{isAr ? 'فواتير الموردين' : 'Supplier Bills'}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{purchaseInvoices.length}</div>
        </div>
        <div className="card-am-surface rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">{isAr ? 'المستحقات' : 'Outstanding Payables'}</div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{Number(outstandingPayables).toLocaleString()} SAR</div>
        </div>
      </div>

      <div className="card-am-surface rounded-xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">{isAr ? 'آخر النشاط' : 'Recent Activity'}</h3>
          <button onClick={() => setDomainMode('ACCOUNTS_PAYABLE')} className="text-xs font-semibold text-brand-primary">{isAr ? 'عرض الموردين' : 'View payables'}</button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          {purchaseInvoices.length > 0 ? purchaseInvoices.slice(0,3).map((invoice, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
              <span>{invoice.vendorName || invoice.supplierName || 'Supplier invoice'}</span>
              <span className="font-semibold text-slate-900">{Number(invoice.totalAmount ?? invoice.grandTotal ?? 0).toLocaleString()} SAR</span>
            </div>
          )) : <div className="text-slate-500">{isAr ? 'لا توجد بيانات مشتريات بعد.' : 'No purchasing data yet.'}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="purchasing-shell">
      <div className="purchasing-switcher px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="purchasing-switcher-label">{isAr ? 'مساحة المشتريات' : 'Purchasing workspace'}</span>
            <div className="purchasing-segmented-control">
              <button onClick={() => setDomainMode('PROCUREMENT')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${domainMode === 'PROCUREMENT' ? 'is-active' : ''}`}><ShoppingCart className="w-3.5 h-3.5" />{isAr ? 'المشتريات' : 'Procurement'}</button>
              <button onClick={() => setDomainMode('ACCOUNTS_PAYABLE')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${domainMode === 'ACCOUNTS_PAYABLE' ? 'is-active is-success' : ''}`}><Receipt className="w-3.5 h-3.5" />{isAr ? 'المستحقات' : 'Accounts payable'}</button>
            </div>
          </div>
          <span className="purchasing-context">{domainMode === 'PROCUREMENT' ? (isAr ? 'طلبات الشراء والاستلام والتوريد' : 'Sourcing, orders & supplier performance') : (isAr ? 'الفواتير والدفعات والمبالغ المستحقة' : 'Invoice matching, payments & vendor balances')}</span>
        </div>
      </div>

      {domainMode === 'PROCUREMENT' ? overview : <AccountsPayableManagementView />}
    </div>
  );
};

