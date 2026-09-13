export type TransactionType = 'income' | 'expense' | 'transfer';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Scenario = 'favorable' | 'central' | 'defavorable';

export type Transaction = {
  id: string;
  date: string;
  label: string;
  amount: number;
  type: TransactionType;
  category: string;
};

export type BudgetEnvelope = {
  id: string;
  name: string;
  planned: number;
  spent: number;
};

export type Forecast = {
  scenario: Scenario;
  endBalance: number;
  assumptions: string[];
};
