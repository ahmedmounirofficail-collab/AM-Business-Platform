import { CostingMethod } from '../types';
import { money, roundMoney } from '../financial/financialLocalization';

export interface CostingReceipt {
  quantity: number;
  unitCost: number;
  currency: string;
  receiptId: string;
  receiptDate?: string;
  sequence?: number;
}

export interface CostingIssue {
  quantity: number;
  issueId: string;
}

export interface LandedCostAllocationLine {
  receiptId: string;
  quantity: number;
  inventoryValue: number;
  allocatedLandedCost: number;
  capitalizedValue: number;
  unitCost: number;
}

export interface LandedCostAllocation {
  currency: string;
  method: 'BY_VALUE' | 'BY_QUANTITY';
  totalLandedCost: number;
  lines: LandedCostAllocationLine[];
}

export class CostingEngine {
  static fifoCost(receipts: CostingReceipt[], issue: CostingIssue, currency: string): number {
    let remaining = issue.quantity;
    let total = 0;
    for (const receipt of [...receipts].sort((a, b) =>
      (a.receiptDate || '').localeCompare(b.receiptDate || '') ||
      (a.sequence ?? 0) - (b.sequence ?? 0) ||
      a.receiptId.localeCompare(b.receiptId)
    )) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, receipt.quantity);
      total += consumed * receipt.unitCost;
      remaining -= consumed;
    }
    if (remaining > 0) throw new Error(`Insufficient FIFO quantity for issue ${issue.issueId}.`);
    return roundMoney(total, currency);
  }

  static weightedAverageCost(receipts: CostingReceipt[], currency: string): number {
    const quantity = receipts.reduce((sum, receipt) => sum + receipt.quantity, 0);
    if (quantity <= 0) throw new Error('Weighted average requires positive receipt quantity.');
    const value = receipts.reduce((sum, receipt) => sum + receipt.quantity * receipt.unitCost, 0);
    return roundMoney(value / quantity, currency);
  }

  static allocateLandedCost(
    receipts: CostingReceipt[],
    landedCost: number,
    method: 'BY_VALUE' | 'BY_QUANTITY',
    currency: string
  ): LandedCostAllocation {
    const cost = money(landedCost, currency);
    const denominator = receipts.reduce((sum, receipt) =>
      sum + (method === 'BY_VALUE' ? receipt.quantity * receipt.unitCost : receipt.quantity), 0);
    if (denominator <= 0) throw new Error('Landed cost allocation requires positive receipt basis.');
    let allocated = 0;
    const lines = receipts.map((receipt, index) => {
      const inventoryValue = receipt.quantity * receipt.unitCost;
      const basis = method === 'BY_VALUE' ? inventoryValue : receipt.quantity;
      const share = index === receipts.length - 1
        ? roundMoney(cost.amount - allocated, currency)
        : roundMoney(cost.amount * basis / denominator, currency);
      allocated += share;
      const capitalizedValue = roundMoney(inventoryValue + share, currency);
      return {
        receiptId: receipt.receiptId,
        quantity: receipt.quantity,
        inventoryValue: roundMoney(inventoryValue, currency),
        allocatedLandedCost: share,
        capitalizedValue,
        unitCost: roundMoney(capitalizedValue / receipt.quantity, currency)
      };
    });
    return { currency: cost.currency, method, totalLandedCost: cost.amount, lines };
  }
}
