import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardCheck, Download, Plus, RefreshCw, Truck, WalletCards } from 'lucide-react';
import {
  calculateReport,
  closeShift,
  createReportSchedule,
  listEnterpriseRecords,
  saveOffer,
  markShiftReport,
  matchReconciliation,
  openShift,
  recordSafeDrop,
  updateDeliveryStatus,
} from '../lib/enterprise';
import type { OfferRule, OutboundDelivery, ReconciliationRecord, ReportSchedule, ShiftRecord } from '../lib/types';

const money = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);
const today = () => new Date().toISOString().slice(0, 10);

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Object.keys(rows[0] ?? {});
  const body = rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','));
  const blob = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EnterpriseOperationsPage({ section = 'reports' }: { section?: 'reports' | 'reconciliation' | 'deliveries' | 'shifts' | 'offers' }) {
  const [active, setActive] = useState(section);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today());
  const [reportKind, setReportKind] = useState<'sales' | 'financial' | 'inventory' | 'delivery' | 'customer' | 'user' | 'xyz'>('sales');
  const [safeDropAmount, setSafeDropAmount] = useState('');
  const [report, setReport] = useState({ count: 0, gross: 0, paid: 0, averageBasket: 0, paymentMix: {} as Record<string, number>, rows: [] as Array<Record<string, unknown>> });
  const [deliveries, setDeliveries] = useState<OutboundDelivery[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [offers, setOffers] = useState<OfferRule[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setIsBusy(true);
    try {
      const [summary, deliveryRows, reconciliationRows, shiftRows, scheduleRows, offerRows] = await Promise.all([
        calculateReport({ from: `${from}T00:00:00`, to: `${to}T23:59:59` }),
        listEnterpriseRecords<OutboundDelivery>('outbound_deliveries'),
        listEnterpriseRecords<ReconciliationRecord>('reconciliations'),
        listEnterpriseRecords<ShiftRecord>('shifts'),
        listEnterpriseRecords<ReportSchedule>('report_schedules'),
        listEnterpriseRecords<OfferRule>('offers'),
      ]);
      setReport(summary);
      setDeliveries(deliveryRows);
      setReconciliations(reconciliationRows);
      setShifts(shiftRows);
      setSchedules(scheduleRows);
      setOffers(offerRows);
    } finally {
      setIsBusy(false);
    }
  }, [from, to]);

  useEffect(() => { void refresh(); }, [refresh]);

  const deliverySummary = useMemo(() => deliveries.reduce<Record<string, number>>((summary, delivery) => { summary[delivery.status] = (summary[delivery.status] || 0) + 1; return summary; }, {}), [deliveries]);
  const reconciliationSummary = useMemo(() => reconciliations.reduce<Record<string, number>>((summary, row) => { summary[row.status] = (summary[row.status] || 0) + 1; return summary; }, {}), [reconciliations]);
  const openShiftRecord = shifts.find((shift) => shift.status === 'open');
  const tabs = [
    { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
    { id: 'reconciliation' as const, label: 'Reconciliation', icon: ClipboardCheck },
    { id: 'deliveries' as const, label: 'Deliveries', icon: Truck },
    { id: 'shifts' as const, label: 'Shifts / X-Y-Z', icon: WalletCards },
    { id: 'offers' as const, label: 'Offers', icon: Plus },
  ];

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    setIsBusy(true);
    try { await action(); setNotice(message); await refresh(); } finally { setIsBusy(false); }
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Operations intelligence</p><h1 className="mt-1 text-2xl font-bold text-white">Enterprise control center</h1><p className="mt-1 text-slate-400">Local-first reporting for sales, cash, fulfillment, and delivery.</p></div>
      <div className="flex items-center gap-2"><button onClick={() => void refresh()} disabled={isBusy} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"><RefreshCw size={16} className={isBusy ? 'animate-spin' : ''} /> Refresh</button></div>
    </div>
    {notice && <div role="status" className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">{notice}</div>}
    <div className="flex gap-2 overflow-x-auto border-b border-slate-700 pb-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActive(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${active === id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon size={16} />{label}</button>)}</div>

    {active === 'reports' && <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4"><div className="flex flex-wrap gap-3"><label className="text-xs text-slate-400">Report<select value={reportKind} onChange={(event) => setReportKind(event.target.value as typeof reportKind)} className="mt-1 block rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"><option value="sales">Sales</option><option value="financial">Financial</option><option value="inventory">Inventory</option><option value="delivery">Delivery</option><option value="customer">Customer</option><option value="user">User</option><option value="xyz">X / Y / Z</option></select></label><label className="text-xs text-slate-400">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-400">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" /></label></div><div className="flex gap-2"><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200"><span aria-hidden="true">Print</span></button><button onClick={() => downloadCsv(`jimwas-sales-${from}-${to}.csv`, report.rows)} disabled={!report.rows.length} className="inline-flex items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"><Download size={15} /> Export CSV</button><button onClick={() => void runAction(() => createReportSchedule({ name: 'Daily executive sales', report_type: 'executive', frequency: 'daily', recipients: [], filters: { from, to }, next_run_at: `${today()}T18:00:00.000Z`, is_active: true }), 'Daily report schedule saved')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white"><Plus size={15} /> Schedule</button></div></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Gross sales', money(report.gross)], ['Collected', money(report.paid)], ['Transactions', report.count.toString()], ['Average basket', money(report.averageBasket)]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Payment mix</h2><div className="mt-4 space-y-3">{Object.entries(report.paymentMix).map(([method, amount]) => <div key={method}><div className="flex justify-between text-sm"><span className="capitalize text-slate-300">{method}</span><span className="text-slate-400">{money(amount)}</span></div><div className="mt-1 h-2 rounded-full bg-slate-700"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${report.gross ? Math.min(100, amount / report.gross * 100) : 0}%` }} /></div></div>)}</div></div><div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Scheduled reports</h2><p className="mt-1 text-sm text-slate-400">Automated report definitions sync when the device is online.</p><div className="mt-4 space-y-2">{schedules.slice(0, 4).map((schedule) => <div key={schedule.id} className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-sm"><span className="text-slate-200">{schedule.name}</span><span className="capitalize text-slate-500">{schedule.frequency}</span></div>)}{!schedules.length && <p className="text-sm text-slate-500">No schedules configured.</p>}</div></div></div></section>}

    {active === 'reconciliation' && <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Payment reconciliation</h2><p className="mt-1 text-sm text-slate-400">Normalize cash, mobile money, card, bank, credit, and COD records.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{['matched', 'pending', 'exception'].map((status) => <div key={status} className="rounded-lg bg-slate-900 p-4"><span className="capitalize text-slate-400">{status}</span><strong className="mt-1 block text-2xl text-white">{reconciliationSummary[status] || 0}</strong></div>)}</div><div className="mt-5 space-y-2">{reconciliations.slice(0, 8).map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"><div><p className="text-sm text-white">{record.payment_method} {record.reference ? `· ${record.reference}` : ''}</p><p className="text-xs text-slate-500">Expected {money(record.expected_amount)} · Received {money(record.received_amount)}</p></div>{record.status !== 'matched' && <button onClick={() => void runAction(() => matchReconciliation(record, record.expected_amount), 'Reconciliation matched')} className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white">Match expected</button>}</div>)}{!reconciliations.length && <p className="mt-6 text-sm text-slate-500">No reconciliation records are queued yet.</p>}</div></section>}

    {active === 'deliveries' && <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><h2 className="font-semibold text-white">Outbound delivery pipeline</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{['pending', 'packed', 'assigned', 'in_transit', 'delivered', 'closed'].map((status) => <div key={status} className="rounded-lg bg-slate-900 p-4"><span className="capitalize text-slate-400">{status.replace('_', ' ')}</span><strong className="mt-1 block text-2xl text-white">{deliverySummary[status] || 0}</strong></div>)}</div><div className="mt-5 space-y-2">{deliveries.slice(0, 8).map((delivery) => <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"><div><p className="text-sm text-white">Order {delivery.transaction_id.slice(0, 8)}</p><p className="text-xs capitalize text-slate-500">{delivery.status.replace('_', ' ')} {delivery.courier ? `· ${delivery.courier}` : ''}</p></div>{delivery.status !== 'closed' && <button onClick={() => void runAction(() => updateDeliveryStatus(delivery, delivery.status === 'pending' ? 'packed' : delivery.status === 'packed' ? 'assigned' : delivery.status === 'assigned' ? 'in_transit' : delivery.status === 'in_transit' ? 'delivered' : 'closed'), 'Delivery status updated')} className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white">Advance status</button>}</div>)}{!deliveries.length && <p className="mt-6 text-sm text-slate-500">No outbound deliveries are queued yet.</p>}</div></section>}

    {active === 'shifts' && <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Shift register</h2><p className="mt-1 text-sm text-slate-400">Open, snapshot, and lock cashier shifts with variance tracking.</p></div>{!openShiftRecord && <button onClick={() => void runAction(() => openShift({ cashier_id: 'current-cashier', opening_float: 0 }), 'Shift opened')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white"><Plus size={15} /> Open shift</button>}</div>{openShiftRecord && <div className="mt-5 flex flex-wrap gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-4"><span className="text-sm text-emerald-300">Open shift: {openShiftRecord.id.slice(0, 8)}</span><button onClick={() => void runAction(() => markShiftReport(openShiftRecord, 'x'), 'X report saved')} className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-300">X report</button><button onClick={() => void runAction(() => markShiftReport(openShiftRecord, 'y'), 'Y report saved')} className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-300">Y report</button><input aria-label="Safe drop amount" inputMode="decimal" value={safeDropAmount} onChange={(event) => setSafeDropAmount(event.target.value)} placeholder="Safe drop" className="w-24 rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white" /><button onClick={() => { const amount = Number(safeDropAmount); if (amount > 0) void runAction(() => recordSafeDrop({ shift_id: openShiftRecord.id, amount, reason: 'Cash drawer safe drop' }), 'Safe drop recorded'); }} className="rounded-md border border-emerald-700 px-3 py-1.5 text-xs text-emerald-300">Drop</button><button onClick={() => void runAction(() => closeShift(openShiftRecord, openShiftRecord.opening_float + openShiftRecord.cash_sales - openShiftRecord.refunds), 'Z report generated and shift locked')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white">Close / Z report</button></div>}<div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="py-3">Status</th><th>Opened</th><th>Gross sales</th><th>Variance</th></tr></thead><tbody>{shifts.map((shift) => <tr key={shift.id} className="border-t border-slate-700 text-slate-200"><td className="py-3 capitalize">{shift.status}</td><td>{new Date(shift.opened_at).toLocaleString()}</td><td>{money(shift.gross_sales)}</td><td>{shift.variance === undefined ? '—' : money(shift.variance)}</td></tr>)}</tbody></table>{!shifts.length && <p className="py-6 text-slate-500">No shifts recorded locally.</p>}</div></section>}
    {active === 'offers' && <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Offer rules</h2><p className="mt-1 text-sm text-slate-400">Manage stackable promotions, coupons, BOGO, multi-buy, staff, and senior rules.</p></div><button onClick={() => void runAction(() => saveOffer({ name: `Promo ${offers.length + 1}`, type: 'percentage', value: 10, priority: offers.length + 1, stackable: false, is_active: true, product_ids: [] }), 'Offer rule saved')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white"><Plus size={15} /> Add 10% offer</button></div><div className="mt-5 grid gap-3 md:grid-cols-2">{offers.map((offer) => <div key={offer.id} className="rounded-lg border border-slate-700 bg-slate-900/60 p-4"><div className="flex items-center justify-between"><span className="font-medium text-white">{offer.name}</span><span className="rounded-full bg-emerald-900/40 px-2 py-1 text-xs capitalize text-emerald-300">{offer.is_active ? 'active' : 'inactive'}</span></div><p className="mt-2 text-sm capitalize text-slate-400">{offer.type} · {offer.value}{offer.type === 'percentage' ? '%' : ' KES'} · priority {offer.priority}</p></div>)}{!offers.length && <p className="text-sm text-slate-500">No offer rules configured.</p>}</div></section>}
  </div>;
}
