import { amountText, fill } from '../content/act-one/text.ts';
import { formatBytes, formatNumber } from '../format.ts';

export function formatValue(resourceId: string, amount: number): string {
    if (resourceId === 'data') return formatBytes(amount);
    return withCurrency(resourceId, formatNumber(amount));
}

export function formatAmount(resourceId: string, amount: number): string {
    const template = (amountText as Readonly<Record<string, string>>)[resourceId] ?? '{amount}';
    return fill(template, { amount: resourceId === 'data' ? formatBytes(amount) : formatNumber(amount) });
}

export function formatRate(resourceId: string, perSecond: number): string {
    if (resourceId === 'data') return `${formatBytes(perSecond)}/s`;
    return `${withCurrency(resourceId, String(Number(perSecond.toFixed(2))))}/s`;
}

function withCurrency(resourceId: string, amount: string): string {
    return resourceId === 'money' ? fill(amountText.money, { amount }) : amount;
}
