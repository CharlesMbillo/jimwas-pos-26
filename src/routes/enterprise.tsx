import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardCheck, Truck, WalletCards, RefreshCw } from 'lucide-react';
import { calculateReport, listEnterpriseRecords } from '../lib/enterprise';
import type { OutboundDelivery, ReconciliationRecord, ShiftRecord } from '../lib/types';

const money = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);

export function EnterpriseOperationsPage({ section = 'reports' }: { section?: 'reports' | 'reconciliation' | 'deliveries' | 'shifts' }) {
  const [active, setActive] = useState(section);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState({ count: 0, gross: 0, paid: 0, averageBasket: 0, paymentMix: {} as Record<string, number> });
  const [deliveries, setDeliveries] = useState<OutboundDelivery[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);

  const refresh = async () => {
    const [summary, deliveryRows, reconciliationRows, shiftRows] = await Promise.all([
      calculateReport({ from: `${from}T00:00:00`, to: `${to}T23:59:59` }),
      listEnterpriseRecords<OutboundDelivery>('outbound_deliveries'),
      listEnterpriseRecords<ReconciliationRecord>('reconciliations'),
      listEnterpriseRecords<ShiftRecord>('shifts'),
    ]);
    setReport(summary);
    setDeliveries(deliveryRows);
    setReconciliations(reconciliationRows);
    setShifts(shiftRows);
  };

  useEffect(() => { void refresh(); }, [from, to]);

  const deliverySummary = useMemo(() => deliveries.reduce<Record<string, number>>((summary, delivery) => { summary[delivery.status] = (summary[delivery.status] || 0) + 1; return summary; }, {}), [deliveries]);
  const reconciliationSummary = useMemo(() => reconciliations.reduce<Record<string, number>>((summary, row) => { summary[row.status] = (summary[row.status] || 0) + 1; return summary; }, {}), [reconciliations]);
  const tabs = [
    { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
    { id: 'reconciliation' as const, label: 'Reconciliation', icon: ClipboardCheck },
    { id: 'deliveries' as const, label: 'Deliveries', icon: Truck },
    { id: 'shifts' as const, label: 'Shifts / X-Y-Z', icon: WalletCards },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Operations intelligence</p><h1 className="text-2xl font-bold text-white mt-1">Enterprise control center</h1><p className="text-slate-400 mt-1">Local-first reporting for sales, cash, fulfillment, and delivery.</p></div>
      <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><RefreshCw size={16} /> Refresh</button>
    </div>
    <div className="flex gap-2 overflow-x-auto border-b border-slate-700 pb-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActive(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${active === id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon size={16} />{label}</button>)}</div>
    {active === 'reports' && <section className="space-y-5"><div className="flex flex-wrap gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4"><label className="text-xs text-slate-400">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-400">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" /></label></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Gross sales', money(report.gross)], ['Collected', money(report.paid)], ['Transactions', report.count.toString()], ['Average basket', money(report.averageBasket)]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Payment mix</h2><div className="mt-4 space-y-3">{Object.entries(report.paymentMix).map(([method, amount]) => <div key={method}><div className="flex justify-between text-sm"><span className="capitalize text-slate-300">{method}</span><span className="text-slate-400">{money(amount)}</span></div><div className="mt-1 h-2 rounded-full bg-slate-700"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${report.gross ? Math.min(100, amount / report.gross * 100) : 0}%` }} /></div></div>)}</div></div><div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Control coverage</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-900 p-3"><span className="text-slate-400">Open shifts</span><strong className="mt-1 block text-xl text-white">{shifts.filter((shift) => shift.status === 'open').length}</strong></div><div className="rounded-lg bg-slate-900 p-3"><span className="text-slate-400">Pending reconciliation</span><strong className="mt-1 block text-xl text-amber-400">{reconciliationSummary.pending || 0}</strong></div></div></div></div></section>}
    {active === 'reconciliation' && <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Payment reconciliation</h2><p className="mt-1 text-sm text-slate-400">Normalize cash, mobile money, card, bank, credit, and COD records.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{['matched', 'pending', 'exception'].map((status) => <div key={status} className="rounded-lg bg-slate-900 p-4"><span className="capitalize text-slate-400">{status}</span><strong className="mt-1 block text-2xl text-white">{reconciliationSummary[status] || 0}</strong></div>)}</div>{reconciliations.length === 0 && <p className="mt-6 text-sm text-slate-500">No reconciliation records are queued yet.</p>}</section>}
    {active === 'deliveries' && <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Outbound delivery pipeline</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['pending', 'packed', 'assigned', 'in_transit', 'delivered', 'closed'].map((status) => <div key={status} className="rounded-lg bg-slate-900 p-4"><span className="capitalize text-slate-400">{status.replace('_', ' ')}</span><strong className="mt-1 block text-2xl text-white">{deliverySummary[status] || 0}</strong></div>)}</div></section>}
    {active === 'shifts' && <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Shift register</h2><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="py-3">Status</th><th>Opened</th><th>Gross sales</th><th>Variance</th></tr></thead><tbody>{shifts.map((shift) => <tr key={shift.id} className="border-t border-slate-700 text-slate-200"><td className="py-3 capitalize">{shift.status}</td><td>{new Date(shift.opened_at).toLocaleString()}</td><td>{money(shift.gross_sales)}</td><td>{shift.variance === undefined ? '—' : money(shift.variance)}</td></tr>)}</tbody></table>{shifts.length === 0 && <p className="py-6 text-slate-500">No shifts recorded locally.</p>}</div></section>}
  </div>;
}
