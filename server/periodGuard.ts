import { Express, NextFunction, Request, Response } from 'express';

type PeriodRecord = {
  tenantId?: string;
  companyId?: string;
  fiscalYear?: number;
  fiscalPeriod?: number;
  year?: number;
  periodNumber?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  isLocked?: boolean;
};

const financialPrefixes = [
  '/api/v1/gl/',
  '/api/v1/ar/',
  '/api/v1/ap/',
  '/api/v1/inventory/',
  '/api/v1/treasury/',
  '/api/v1/assets/',
  '/api/v1/mfg/',
  '/api/v1/procurement/',
  '/api/v1/sales/',
  '/api/v1/reports/reconciliation'
];

function isFinancialMutation(req: Request): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    financialPrefixes.some(prefix => req.path.startsWith(prefix));
}

function resolveTargetPeriod(req: Request, periods: PeriodRecord[]): PeriodRecord | undefined {
  const auth = (req as any).auth;
  const scopedPeriods = auth?.tenantId && auth?.companyId
    ? periods.filter(period =>
      (!period.tenantId || period.tenantId === auth.tenantId) &&
      (!period.companyId || period.companyId === auth.companyId)
    )
    : periods;
  const periodId = req.body?.periodId || req.params?.id;
  if (periodId) {
    const byId = scopedPeriods.find(period => (period as any).id === periodId || period.periodNumber === Number(periodId));
    if (byId) return byId;
  }
  const requestedYear = Number(req.body?.year || req.query?.year);
  if (Number.isInteger(requestedYear)) {
    const byYear = scopedPeriods.find(period => (period.fiscalYear ?? period.year) === requestedYear);
    if (byYear) return byYear;
  }
  const fiscalYear = Number(req.body?.fiscalYear);
  const fiscalPeriod = Number(req.body?.fiscalPeriod);
  if (Number.isInteger(fiscalYear) && Number.isInteger(fiscalPeriod)) {
    return scopedPeriods.find(period =>
      (period.fiscalYear ?? period.year) === fiscalYear && (period.fiscalPeriod ?? period.periodNumber) === fiscalPeriod
    );
  }

  const dateValue = req.body?.postingDate || req.body?.transactionDate || req.body?.date ||
    req.body?.valuationDate || req.body?.startDate || req.query?.postingDate ||
    req.query?.transactionDate || req.query?.date || new Date().toISOString().slice(0, 10);
  const targetTime = new Date(String(dateValue)).getTime();
  if (!Number.isFinite(targetTime)) return undefined;
  return scopedPeriods.find(period => {
    const start = new Date(String(period.startDate)).getTime();
    const end = new Date(String(period.endDate)).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && targetTime >= start && targetTime <= end;
  });
}

export function registerPeriodGuardMiddleware(
  app: Express,
  getPeriods: () => PeriodRecord[]
): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isFinancialMutation(req)) return next();
    const targetPeriod = resolveTargetPeriod(req, getPeriods());
    if (!targetPeriod) {
      return res.status(400).json({
        error: 'Financial mutation requires a valid fiscal year/period or a transaction date within a configured fiscal period.'
      });
    }

    const normalizedStatus = String(targetPeriod.status || '').toUpperCase();
    if (targetPeriod.isLocked || normalizedStatus === 'LOCKED' || normalizedStatus === 'CLOSED') {
      return res.status(409).json({
        error: 'Financial mutation rejected because the target period is closed or locked.',
        fiscalYear: targetPeriod.fiscalYear ?? targetPeriod.year,
        fiscalPeriod: targetPeriod.fiscalPeriod ?? targetPeriod.periodNumber,
        status: targetPeriod.status || (targetPeriod.isLocked ? 'LOCKED' : 'CLOSED')
      });
    }
    next();
  });
}
