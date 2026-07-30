import { ShoppingCart, Truck, Percent, Wallet } from 'lucide-react';

interface SaleTypeSelectorProps {
  saleType: 'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama';
  onSaleTypeChange: (type: 'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama') => void;
  cartTotal: number;
  depositAmount: number;
  onDepositChange: (amount: number) => void;
}

export function SaleTypeSelector({
  saleType,
  onSaleTypeChange,
  cartTotal,
  depositAmount,
  onDepositChange,
}: SaleTypeSelectorProps) {
  const balanceAmount = Math.max(0, cartTotal - depositAmount);

  const saleTypes = [
    {
      id: 'standard',
      label: 'Standard Retail',
      icon: ShoppingCart,
      description: 'Walking customer - Full payment at checkout',
      color: 'bg-slate-700 border-slate-600 hover:bg-slate-600',
      activeColor: 'bg-emerald-600/20 border-emerald-500',
      textColor: 'text-white',
      descColor: 'text-slate-400',
    },
    {
      id: 'wholesale',
      label: 'Wholesale/Drop-shipping',
      icon: Truck,
      description: 'Bulk orders with wholesale pricing',
      color: 'bg-slate-700 border-slate-600 hover:bg-slate-600',
      activeColor: 'bg-blue-600/20 border-blue-500',
      textColor: 'text-white',
      descColor: 'text-slate-400',
    },
    {
      id: 'lipa_mdogo',
      label: 'Lipa Mdogo-Mdogo',
      icon: Percent,
      description: 'Goods collected after full payment settled',
      color: 'bg-slate-700 border-slate-600 hover:bg-slate-600',
      activeColor: 'bg-amber-600/20 border-amber-500',
      textColor: 'text-white',
      descColor: 'text-slate-400',
    },
    {
      id: 'kyama',
      label: 'Kyama',
      icon: Wallet,
      description: 'Agreed deposit made, checkout after full amount',
      color: 'bg-slate-700 border-slate-600 hover:bg-slate-600',
      activeColor: 'bg-purple-600/20 border-purple-500',
      textColor: 'text-white',
      descColor: 'text-slate-400',
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-200">Sale Type</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {saleTypes.map((type) => {
          const IconComponent = type.icon;
          const isActive = saleType === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => onSaleTypeChange(type.id as any)}
              className={`p-3 rounded-lg border-2 transition text-left ${
                isActive ? type.activeColor : type.color
              }`}
            >
              <div className="flex items-start gap-2">
                <IconComponent size={18} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className={`font-medium text-sm ${type.textColor}`}>{type.label}</p>
                  <p className={`text-xs ${type.descColor}`}>{type.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {(saleType === 'lipa_mdogo' || saleType === 'kyama') && (
        <div className="bg-slate-700/50 border border-amber-600/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-400 mb-3">Payment Terms</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Deposit/Initial Payment (KES)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => onDepositChange(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="0"
                min="0"
                max={cartTotal}
              />
              <p className="text-xs text-slate-500 mt-1">
                Max: KES {cartTotal.toLocaleString()}
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Amount:</span>
                <span className="font-medium text-white">KES {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Deposit Today:</span>
                <span className="font-medium">KES {depositAmount.toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-600 pt-1 flex justify-between text-amber-400 font-medium">
                <span>Balance Outstanding:</span>
                <span>KES {balanceAmount.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-amber-300/80 italic">
              {saleType === 'lipa_mdogo' 
                ? 'Goods will be collected after the full amount is paid'
                : 'Goods will be checked out after the full amount is paid'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
