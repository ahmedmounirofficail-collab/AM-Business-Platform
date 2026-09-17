/**
 * AM Business Platform - Navigation Sidebar
 * Organized by official Enterprise ERP Business Domains:
 * CORE, OPERATIONS, INTELLIGENCE, ADMINISTRATION, FUTURE
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building,
  Calculator,
  Package,
  ShoppingBag,
  Truck,
  Users,
  UserCheck,
  Bot,
  Landmark,
  Factory,
  Store,
  Briefcase,
  Building2,
  PieChart,
  FileSpreadsheet,
  Workflow,
  FolderGit2,
  Database,
  Settings,
  ShieldCheck,
  ClipboardList,
  Sliders,
  Palette,
  Wrench,
  KeyRound,
  Car,
  Headphones,
  CheckCircle2,
  Cpu,
  Globe,
  ChevronDown,
  Sparkles,
  Award,
  ChevronRight
} from 'lucide-react';
import { ModuleView, usePlatform } from '../../context/PlatformContext';

interface NavItem {
  id: ModuleView;
  labelEn: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string }>;
  isFuture?: boolean;
  badge?: string | number;
  badgeColor?: string;
}

interface NavCategory {
  titleEn: string;
  titleAr: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const {
    lang,
    activeModule,
    setActiveModule,
    pendingApprovalsCount,
    anomaliesCount,
    branding,
    activeCompany
  } = usePlatform();
  const isAr = lang === 'ar';

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (title: string) => {
    setCollapsedCategories(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Feature Gating: Vertical-aware logic
  const isManufacturingEnabled = Boolean(
    (activeCompany as any)?.vertical?.includes('MFG') ||
    (activeCompany as any)?.industry === 'MANUFACTURING' ||
    (activeCompany as any)?.vertical === 'GARMENT_MANUFACTURING' ||
    (activeCompany as any)?.enableManufacturing ||
    activeCompany?.name?.toLowerCase().includes('manufacturing') ||
    activeCompany?.nameAr?.includes('تصنيع') ||
    activeModule === 'manufacturing'
  );

  const rawCategories: (NavCategory & { isVisible?: boolean })[] = [
    {
      titleEn: 'MAIN',
      titleAr: 'الرئيسية',
      items: [
        {
          id: 'dashboard',
          labelEn: 'Business Overview',
          labelAr: 'لوحة القيادة التنفيذية',
          icon: LayoutDashboard
        },
        {
          id: 'ai',
          labelEn: 'Smart Review',
          labelAr: 'المساعد الذكي والتدقيق',
          icon: Bot,
          badge: anomaliesCount > 0 ? anomaliesCount : undefined,
          badgeColor: 'bg-amber-500 text-white'
        }
      ]
    },
    {
      titleEn: 'SALES & CUSTOMERS',
      titleAr: 'المبيعات والعملاء',
      items: [
        {
          id: 'sales',
          labelEn: 'Sales & Invoices',
          labelAr: 'المبيعات والفواتير',
          icon: ShoppingBag
        },
        {
          id: 'pos',
          labelEn: 'Point of Sale',
          labelAr: 'نقاط البيع والتجزئة',
          icon: Store,
          badge: 'POS',
          badgeColor: 'bg-[#C9A227] text-slate-950 font-bold'
        }
      ]
    },
    {
      titleEn: 'PURCHASING & VENDORS',
      titleAr: 'المشتريات والموردون',
      items: [
        {
          id: 'purchasing',
          labelEn: 'Purchasing & Bills',
          labelAr: 'المشتريات وفواتير الموردين',
          icon: Truck
        }
      ]
    },
    {
      titleEn: 'INVENTORY & WAREHOUSES',
      titleAr: 'المخزون والمستودعات',
      items: [
        {
          id: 'inventory',
          labelEn: 'Inventory Management',
          labelAr: 'إدارة المخازن والمستودعات',
          icon: Package
        }
      ]
    },
    {
      titleEn: 'TREASURY & BANKING',
      titleAr: 'الخزينة والبنوك',
      items: [
        {
          id: 'banking',
          labelEn: 'Treasury & Cash',
          labelAr: 'الخزينة والحسابات البنكية',
          icon: Landmark
        }
      ]
    },
    {
      titleEn: 'ACCOUNTING & FINANCE',
      titleAr: 'الحسابات العامة',
      items: [
        {
          id: 'accounting',
          labelEn: 'General Ledger',
          labelAr: 'الأستاذ العام ودليل الحسابات',
          icon: Calculator
        },
        {
          id: 'fixed_assets',
          labelEn: 'Fixed Assets',
          labelAr: 'الأصول الثابتة والإهلاك',
          icon: Building2
        }
      ]
    },
    {
      titleEn: 'MANUFACTURING',
      titleAr: 'التصنيع والإنتاج',
      isVisible: isManufacturingEnabled,
      items: [
        {
          id: 'manufacturing',
          labelEn: 'Work Orders & Assembly',
          labelAr: 'أوامر التشغيل وخطوط الإنتاج',
          icon: Factory,
          badge: isAr ? 'إنتاج' : 'MFG',
          badgeColor: 'bg-indigo-600 text-white'
        }
      ]
    },
    {
      titleEn: 'ANALYTICS & REPORTS',
      titleAr: 'التحليل والتقارير',
      items: [
        {
          id: 'bi_analytics',
          labelEn: 'Analytics & Insights',
          labelAr: 'التحليل والتقارير الذكية',
          icon: PieChart
        },
        {
          id: 'reports',
          labelEn: 'Financial Reports',
          labelAr: 'مركز التقارير التنفيذية',
          icon: FileSpreadsheet
        }
      ]
    },
    {
      titleEn: 'USERS & GOVERNANCE',
      titleAr: 'المستخدمون والحوكمة',
      items: [
        {
          id: 'users_security',
          labelEn: 'Users & Permissions',
          labelAr: 'المستخدمون والصلاحيات',
          icon: ShieldCheck
        },
        {
          id: 'workflows',
          labelEn: 'Approval Workflows',
          labelAr: 'دورات الاعتماد والتواقيع',
          icon: Workflow,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
          badgeColor: 'bg-rose-500 text-white font-bold'
        },
        {
          id: 'audit_center',
          labelEn: 'Audit Trail',
          labelAr: 'سجل التدقيق والعمليات',
          icon: ClipboardList
        }
      ]
    },
    {
      titleEn: 'SYSTEM & SETTINGS',
      titleAr: 'الإعدادات والنظام',
      items: [
        {
          id: 'settings',
          labelEn: 'Tax & Regional Setup',
          labelAr: 'الضرائب وإعدادات التوطين',
          icon: Settings
        },
        {
          id: 'master_data',
          labelEn: 'Master Data Foundation',
          labelAr: 'البيانات الأساسية الموحدة',
          icon: Database
        },
        {
          id: 'branding',
          labelEn: 'Corporate Branding',
          labelAr: 'الهوية المؤسسية والشعار',
          icon: Palette
        },
        {
          id: 'onboarding_wizard',
          labelEn: 'Setup Guide',
          labelAr: 'معالج التهيئة المؤسسية',
          icon: Award
        }
      ]
    }
  ];

  const navCategories = rawCategories.filter(cat => cat.isVisible !== false);

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-4 hidden md:flex flex-col justify-between select-none overflow-y-auto max-h-[calc(100vh-4.25rem)]">
      <div className="space-y-5">
        {navCategories.map((cat) => {
          const isCollapsed = collapsedCategories[cat.titleEn];

          return (
            <div key={cat.titleEn} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleCategory(cat.titleEn)}
                className="w-full px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
              >
                <span>{isAr ? cat.titleAr : cat.titleEn}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>

              {!isCollapsed && (
                <nav className="space-y-0.5">
                  {cat.items.filter(item => !item.isFuture).map((item) => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveModule(item.id)}
                        style={isActive ? {
                          backgroundColor: branding?.primaryColor || '#0B1F3A',
                          borderColor: `${branding?.accentColor || '#C9A227'}4D`
                        } : {}}
                        className={`w-full min-h-[38px] flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition cursor-pointer ${
                          isActive
                            ? 'text-white font-bold border'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate min-w-0">
                          <Icon
                            className="w-4 h-4 shrink-0"
                            style={isActive ? { color: branding?.accentColor || '#C9A227' } : {}}
                          />
                          <span className="truncate text-xs font-semibold">
                            {isAr ? item.labelAr : item.labelEn}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.isFuture ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {isAr ? 'قريباً' : 'Soon'}
                            </span>
                          ) : item.badge ? (
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${item.badgeColor || 'text-white'}`}
                              style={!item.badgeColor ? { backgroundColor: branding?.accentColor || '#C9A227' } : {}}
                            >
                              {item.badge}
                            </span>
                          ) : (
                            isActive && (
                              <ChevronRight
                                className="w-3.5 h-3.5 rtl:rotate-180"
                                style={{ color: branding?.accentColor || '#C9A227' }}
                              />
                            )
                          )}
                        </div>
                      </button>
                    );
                  })}
                </nav>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Branding */}
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-900 dark:text-white font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: branding?.accentColor || '#C9A227' }} />
              <span className="font-bold truncate max-w-[140px]">
                {isAr
                  ? (branding?.appNameAr || branding?.appName || 'منصة إيه إم للأعمال')
                  : (branding?.appName || 'AM Business OS')}
              </span>
            </span>
            <span
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border"
              style={{
                color: branding?.accentColor || '#C9A227',
                backgroundColor: `${branding?.accentColor || '#C9A227'}1A`,
                borderColor: `${branding?.accentColor || '#C9A227'}33`
              }}
            >
              v2.8.0
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
            {branding?.tradingName || (isAr
              ? 'إدارة متكاملة للأعمال والعمليات المالية'
              : 'Integrated business and financial operations')}
          </p>
          {(branding?.showPoweredBy ?? true) && (
            <div className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-700/60 space-y-0.5">
              <div className="font-semibold text-slate-500 dark:text-slate-300">
                {isAr ? 'منصة إيه إم للأعمال' : 'AM Business Platform'}
              </div>
              <div className="text-[8.5px] text-[#C9A227] italic">
                {isAr ? '«كل قرار ناجح يبدأ برقم صحيح»' : '"Every successful decision begins with an accurate number"'}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
