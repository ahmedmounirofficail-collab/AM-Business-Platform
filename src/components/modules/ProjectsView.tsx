import React, { useState } from 'react';
import { 
  Briefcase, 
  Layers, 
  DollarSign, 
  Clock, 
  Users, 
  Search, 
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';

export const ProjectsView: React.FC = () => {
  const { lang } = usePlatform();
  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState<'projects' | 'wbs' | 'jobCosting' | 'resources' | 'timesheets'>('projects');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="projects-workspace p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold border border-blue-500/20">
              OPERATIONS WORKSPACE
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Project workspace</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Briefcase className="w-7 h-7 text-blue-600" />
            <span>{isAr ? 'إدارة المشاريع والتكاليف' : 'Projects and costing'}</span>
          </h1>
        </div>

        <span className="px-3 py-2 rounded-md border border-slate-300 text-slate-500 text-xs">{isAr ? 'غير متاح حاليًا' : 'Not available'}</span>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'projects', labelEn: 'Project List', labelAr: 'قائمة المشاريع', icon: Briefcase },
          { id: 'wbs', labelEn: 'Work Breakdown (WBS)', labelAr: 'هيكل العمل (WBS)', icon: Layers },
          { id: 'jobCosting', labelEn: 'Job Costing & Budget', labelAr: 'تكلفة المشروع والميزانية', icon: DollarSign },
          { id: 'resources', labelEn: 'Resource Allocation', labelAr: 'تخصيص الموارد والمهام', icon: Users },
          { id: 'timesheets', labelEn: 'Timesheets & Progress', labelAr: 'ساعات العمل والإنجاز', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 text-xs text-amber-800 dark:text-amber-200">
        {isAr ? 'بيانات المشاريع والتكاليف غير متاحة من مصدر تشغيلي فعلي حاليًا.' : 'Project and costing data is not available from a live operational source yet.'}
      </div>

      {/* Main Content View */}
      {activeTab === 'projects' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'ابحث عن اسم المشروع أو العميل...' : 'Filter by project name or customer...'}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden"
              />
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {isAr ? 'لا توجد بيانات تشغيلية' : 'No live project data'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-3">{isAr ? 'رقم المشروع' : 'Project ID'}</th>
                  <th className="p-3">{isAr ? 'اسم المشروع' : 'Project Name'}</th>
                  <th className="p-3">{isAr ? 'العميل' : 'Customer'}</th>
                  <th className="p-3">{isAr ? 'الميزانية' : 'Budget'}</th>
                  <th className="p-3">{isAr ? 'المصروف' : 'Spent'}</th>
                  <th className="p-3">{isAr ? 'الإنجاز' : 'Progress'}</th>
                  <th className="p-3">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="p-3">{isAr ? 'المسؤول' : 'Manager'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr><td colSpan={8} className="p-10 text-center text-slate-500">{isAr ? 'غير متاح حاليًا' : 'Not available'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'wbs' && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs space-y-3">
          <Layers className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{isAr ? 'هيكل العمل غير متاح' : 'Work breakdown is unavailable'}</h3>
          <p className="text-xs text-slate-500">{isAr ? 'لا يوجد مصدر مشاريع تشغيلي موصول حاليًا.' : 'No live project source is connected for this workspace.'}</p>
        </div>
      )}

      {(activeTab === 'jobCosting' || activeTab === 'resources' || activeTab === 'timesheets') && (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
          <Clock className="w-10 h-10 text-blue-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isAr ? 'بيانات التكلفة وتتبع الساعات غير متاحة' : 'Costing and timesheet data unavailable'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isAr 
              ? 'لا توجد بيانات تشغيلية موصولة لهذه الوحدة حاليًا.'
              : 'No live operational data source is connected for this workspace.'
            }
          </p>
        </div>
      )}

    </div>
  );
};
