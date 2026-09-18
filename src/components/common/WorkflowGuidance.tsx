import React from 'react';
import { Info } from 'lucide-react';

interface WorkflowGuidanceProps {
  title: string;
  steps: string[];
  impact?: string;
}

export const WorkflowGuidance: React.FC<WorkflowGuidanceProps> = ({ title, steps, impact }) => (
  <aside className="am-surface flex gap-3 p-4 text-xs" aria-label={title}>
    <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
    <div className="space-y-1.5">
      <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
      <ol className="list-decimal space-y-0.5 ps-4 text-slate-600 dark:text-slate-300">
        {steps.map(step => <li key={step}>{step}</li>)}
      </ol>
      {impact && <p className="border-t border-slate-200 pt-1.5 text-slate-500 dark:border-slate-700 dark:text-slate-400">{impact}</p>}
    </div>
  </aside>
);
