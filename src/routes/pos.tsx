import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Minus, Trash2, Search, User, ShoppingCart, Banknote, CreditCard, Smartphone, X, Package, Archive, ArchiveRestore, Loader2, CheckCircle2, XCircle, AlertCircle, Clock, FlaskConical, Zap, Printer } from 'lucide-react';
import { generateId, saveProduct, getAllProducts, getAllCustomers, saveCustomer, getKCBSettings, getBusinessSettings, getReceiptSettings, getTransaction } from '../lib/db';
import { syncInsertCustomer, syncInsertProduct, getSupabase } from '../lib/sync';
import { logSaleCompleted, logCustomerCreated } from '../lib/audit';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { initiateKCBSTKPush, pollForKCBPaymentCompletion } from '../lib/mpesa';
import { completeSale, validatePhoneNumber, validatePrice, validateStock, sanitizeInput } from '../lib/transaction-utils';
import { printReceipt, saveReceiptToHistory, getReceiptHistory, previewReceipt } from '../lib/print';
import { useDebounce } from '../hooks/useDebounce';
import { SaleTypeSelector } from '../components/SaleTypeSelector';
import type { Product, Customer, CartItem } from '../lib/types';

const LOYALTY_POINTS_PER_SHILLING = 100;

// Format phone number to 254XXXXXXXXX format (KCB standard)
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return `254${cleaned.slice(1)}`;
  if (cleaned.length === 9) return `254${cleaned}`;
  return cleaned;
}

export function POSTerminal() {
  const { user } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'kcb'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: '' });
  const [parkedSales, setParkedSales] = useState<Array<{id: string; cart: CartItem[]; customer: Customer | null; timestamp: string}>>([]);
  const [showParkedSales, setShowParkedSales] = useState(false);

  // KCB BUNI STK Push state
  const [kcbPhone, setKCBPhone] = useState('');
  const [kcbStatus, setKCBStatus] = useState<'idle' | 'initiating' | 'waiting' | 'checking' | 'success' | 'failed' | 'cancelled'>('idle');
  const [kcbCheckoutId, setKCBCheckoutId] = useState<string | null>(null);
  const [kcbError, setKCBError] = useState<string | null>(null);
  const [kcbReceiptNumber, setKCBReceiptNumber] = useState<string | null>(null);
  const [kcbStartTime, setKCBStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [kcbEnabled, setKCBEnabled] = useState<boolean | null>(null);
  const [kcbConfigured, setKCBConfigured] = useState<boolean>(false);
  const [kcbEnvironment, setKCBEnvironment] = useState<'sandbox' | 'production'>('sandbox');

  
  // Sale type state
  const [saleType, setSaleType] = useState<'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama'>('standard');
  const [depositAmount, setDepositAmount] = useState(0);

  // Receipt printing state
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  const [showReceiptHistory, setShowReceiptHistory] = useState(false);

  useEffect(() => {
    loadData();
    // Load cart from storage on mount
    loadSavedCart();
    // Load parked sales on mount
    loadSavedParkedSales();
  }, []);

  // Auto-save cart to IndexedDB whenever it changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cart.length > 0) {
        saveCartToStorage();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, selectedCustomer, saleType, depositAmount]);

  // Timer for KCB BUNI STK in-progress states only — do NOT reset on failure/success so the final time remains visible
  useEffect(() => {
    if (kcbStatus !== 'waiting' && kcbStatus !== 'initiating' && kcbStatus !== 'checking') {
      return;
    }

    const interval = setInterval(() => {
      if (kcbStartTime) {
        setElapsedSeconds(Math.floor((Date.now() - kcbStartTime.getTime()) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [kcbStatus, kcbStartTime]);

  const loadData = async () => {
    const [prods, custs, idbMpesa] = await Promise.all([
      getAllProducts(),
      getAllCustomers(),
      getKCBSettings(),
    ]);
    setProducts(prods.filter(p => p.is_active));
    setCustomers(custs);

    // Always try Supabase first for KCB settings (authoritative source)
    let kcbSettings = idbMpesa;
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('kcb_settings')
        .select('*')
        .eq('id', 'kcb-settings')
        .maybeSingle();
      if (data) kcbSettings = data;
    }

    setKCBEnabled(kcbSettings?.is_enabled ?? false);
    setKCBEnvironment(kcbSettings?.environment ?? 'sandbox');
    // KCB BUNI STK is "configured" when enabled + has client ID + secret (minimum to attempt)
    // org_passkey and org_shortcode are validated at the edge function level with clear errors
    const hasCredentials = !!(kcbSettings?.is_enabled &&
      kcbSettings.client_id &&
      kcbSettings.client_secret);
    setKCBConfigured(hasCredentials);
  };

  const saveCartToStorage = async () => {
    try {
      const { saveCartSession } = await import('../lib/db');
      await saveCartSession({
        id: 'current-cart',
        items: cart,
        selectedCustomer,
        total: cartTotal,
        saleType,
        depositAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[v0] Failed to save cart:', error);
    }
  };

  const loadSavedCart = async () => {
    try {
      const { loadCartSession } = await import('../lib/db');
      const savedCart = await loadCartSession();
      if (savedCart && savedCart.items.length > 0) {
        setCart(savedCart.items);
        setSelectedCustomer(savedCart.selectedCustomer);
        setSaleType(savedCart.saleType || 'standard');
        setDepositAmount(savedCart.depositAmount || 0);
      }
    } catch (error) {
      console.error('[v0] Failed to load cart:', error);
    }
  };

  const loadSavedParkedSales = async () => {
    try {
      const { getAllParkedSales } = await import('../lib/db');
      const parked = await getAllParkedSales();
      if (parked.length > 0) {
        console.log(`[v0] Loaded ${parked.length} parked sales`);
        // You can display these in a UI list if needed
      }
    } catch (error) {
      console.error('[v0] Failed to load parked sales:', error);
    }
  };

  // Debounce search terms for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const debouncedCustomerSearch = useDebounce(customerSearch, 200);

  const filteredProducts = useMemo(() => {
    const term = debouncedSearchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term)
    );
  }, [products, debouncedSearchTerm]);

  const filteredCustomers = useMemo(() => {
    const term = debouncedCustomerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.phone?.includes(debouncedCustomerSearch)
    );
  }, [customers, debouncedCustomerSearch]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, paid - cartTotal);
  }, [amountPaid, cartTotal]);

  const loyaltyPointsToEarn = useMemo(() => {
    if (!selectedCustomer) return 0;
    return Math.floor(cartTotal / LOYALTY_POINTS_PER_SHILLING);
  }, [cartTotal, selectedCustomer]);

  const addToCart = useCallback((product: Product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product_id === product.id);
      if (existing) {
        return prevCart.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        );
      }

      return [...prevCart, {
        id: generateId(),
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        subtotal: product.price,
      }];
    });
  }, []);

  const updateCartItem = useCallback((itemId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id !== itemId) return item;
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty, subtotal: newQty * item.unit_price };
      }).filter(item => item.quantity > 0);
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  }, []);

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setAmountPaid('');
    setShowCheckout(false);
    // Reset KCB BUNI STK state
    setKCBPhone('');
    setKCBStatus('idle');
    setKCBCheckoutId(null);
    setKCBError(null);
    setKCBReceiptNumber(null);
    setKCBStartTime(null);
    setElapsedSeconds(0);
    // Reset sale type
    setSaleType('standard');
    setDepositAmount(0);
  };

  // Handle KCB BUNI STK Push
  const handleKCBSTKPayment = async () => {
    // In production, require full configuration; in sandbox, allow testing without credentials
    if (kcbEnvironment !== 'sandbox' && !kcbConfigured) {
      setKCBStatus('failed');
      setKCBError(kcbEnabled
        ? 'KCB BUNI API credentials not configured. Go to Settings > Payments to add Client ID, Secret, and Pass Key.'
        : 'KCB BUNI is not enabled. Go to Settings > Payments to enable it.');
      return;
    }

    const phoneValidation = validatePhoneNumber(kcbPhone);
    if (!phoneValidation.valid) {
      setKCBError(phoneValidation.error || 'Please enter a valid Kenyan phone number');
      return;
    }

    // Format phone number to 254XXXXXXXXX format per ICDN standards
    const formattedPhone = formatPhoneNumber(kcbPhone);

    setKCBStatus('initiating');
    setKCBError(null);
    setKCBStartTime(new Date());

    // Always call the real KCB BUNI STK Push API — sandbox sends real prompts to test numbers
    try {
      const result = await initiateKCBSTKPush(formattedPhone, cartTotal, {
        cashierId: user?.id,
        cashierName: user?.name,
        accountReference: `POS-${Date.now()}`,
        transactionDesc: 'KCB BUNI STK Push Payment',
      });

      if (!result.success || !result.checkoutRequestId) {
        setKCBStatus('failed');
        setKCBError(result.error || 'Failed to initiate KCB BUNI STK payment');
        return;
      }

      setKCBCheckoutId(result.checkoutRequestId);
      setKCBStatus('waiting');
      toast.show('KCB BUNI STK Push request sent. Check your phone for the prompt.');

      // Start polling for completion
      const statusResult = await pollForKCBPaymentCompletion(result.checkoutRequestId, {
        maxAttempts: 36, // 3 minutes
        intervalMs: 5000,
        onStatusChange: (status) => {
          if (status.status === 'processing') {
            setKCBStatus('checking');
          }
        },
      });

      if (statusResult.status === 'success') {
        setKCBStatus('success');
        setKCBReceiptNumber(statusResult.mpesaReceiptNumber || null);
        toast.show('KCB payment successful!');
        // Auto-complete the sale
        await completeKCBSTKSale(statusResult.mpesaReceiptNumber);
      } else if (statusResult.status === 'cancelled') {
        setKCBStatus('cancelled');
        setKCBError('Payment was cancelled by user');
      } else if (statusResult.status === 'timeout') {
        setKCBStatus('failed');
        setKCBError('KCB payment timed out. Please try again.');
      } else if (statusResult.status === 'insufficient_balance') {
        setKCBStatus('failed');
        setKCBError('Insufficient balance on M-Pesa account');
      } else {
        setKCBStatus('failed');
        setKCBError(statusResult.resultDesc || 'KCB payment failed');
      }
    } catch (error) {
      setKCBStatus('failed');
      setKCBError(error instanceof Error ? error.message : 'KCB payment error occurred');
    }
  };

  // Complete sale after KCB BUNI STK payment
  const completeKCBSTKSale = useCallback(async (mpesaReceipt?: string) => {
    const result = await completeSale({
      cart,
      cartTotal,
      products,
      selectedCustomer,
      paymentMethod: 'kcb',
      amountPaid: cartTotal,
      change: 0,
      userId: user?.id || 'system',
      mpesaReceipt,
    });

    if (result.success) {
      await logSaleCompleted(result.transactionId, { cart, total_amount: cartTotal }, user?.id);

      // Brief delay to show success, then close
      setTimeout(() => {
        clearCart();
        loadData();
      }, 1500);
    }

    return result;
  }, [cart, cartTotal, products, selectedCustomer, user?.id]);

  const parkSale = () => {
    if (cart.length === 0) return;
    const parkedSale = {
      id: generateId(),
      cart: [...cart],
      customer: selectedCustomer,
      timestamp: new Date().toISOString(),
    };
    setParkedSales(prev => [...prev, parkedSale]);
    clearCart();
  };

  const resumeSale = (parkedId: string) => {
    const sale = parkedSales.find(s => s.id === parkedId);
    if (!sale) return;
    setCart(sale.cart);
    setSelectedCustomer(sale.customer);
    setParkedSales(prev => prev.filter(s => s.id !== parkedId));
    setShowParkedSales(false);
  };

  const deleteParkedSale = (parkedId: string) => {
    setParkedSales(prev => prev.filter(s => s.id !== parkedId));
  };

  const handleAddProduct = useCallback(async () => {
    const sanitizedName = sanitizeInput(newProduct.name);
    if (!sanitizedName) {
      toast.show('Product name is required', 'error');
      return;
    }

    const priceValidation = validatePrice(newProduct.price);
    if (!priceValidation.valid) {
      toast.show(priceValidation.error || 'Invalid price', 'error');
      return;
    }

    const stockValidation = validateStock(newProduct.stock);
    if (!stockValidation.valid) {
      toast.show(stockValidation.error || 'Invalid stock', 'error');
      return;
    }

    const product: Product = {
      id: generateId(),
      name: sanitizedName,
      price: priceValidation.value!,
      cost: 0,
      stock: stockValidation.value!,
      category: sanitizeInput(newProduct.category),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await saveProduct(product);
    syncInsertProduct(product);
    setProducts(prev => [...prev, product]);
    setNewProduct({ name: '', price: '', stock: '', category: '' });
    setShowAddProduct(false);
    toast.show('Product added successfully!');
  }, [newProduct, toast]);

  const handleCreateCustomer = useCallback(async () => {
    const sanitizedName = sanitizeInput(newCustomer.name);
    if (!sanitizedName) {
      toast.show('Customer name is required', 'error');
      return;
    }

    if (newCustomer.phone) {
      const phoneValidation = validatePhoneNumber(newCustomer.phone);
      if (!phoneValidation.valid) {
        toast.show(phoneValidation.error || 'Invalid phone number', 'error');
        return;
      }
    }

    const customer: Customer = {
      id: generateId(),
      name: sanitizedName,
      phone: newCustomer.phone ? sanitizeInput(newCustomer.phone) : undefined,
      email: newCustomer.email ? sanitizeInput(newCustomer.email) : undefined,
      loyalty_points: 0,
      total_spent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await saveCustomer(customer);
    syncInsertCustomer(customer);
    await logCustomerCreated(customer.id, customer, user?.id);
    setCustomers(prev => [...prev, customer]);
    setSelectedCustomer(customer);
    setNewCustomer({ name: '', phone: '', email: '' });
    setShowNewCustomer(false);
    toast.show('Customer created successfully!');
  }, [newCustomer, user?.id, toast]);

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;

    // Stock validation
    for (const item of cart) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;
      if (product.stock < item.quantity) {
        toast.show(`Insufficient stock for ${item.product_name}. Available: ${product.stock}`, 'error');
        return;
      }
    }

    // Calculate amount paid based on sale type
    let paid = parseFloat(amountPaid) || cartTotal;
    let amountRequired = cartTotal;
    
    // For Lipa Mdogo and Kyama, only deposit is required today
    if (saleType === 'lipa_mdogo' || saleType === 'kyama') {
      amountRequired = depositAmount;
      paid = Math.min(parseFloat(amountPaid) || depositAmount, cartTotal);
    }
    
    if (paid < amountRequired) {
      const requiredLabel = (saleType === 'lipa_mdogo' || saleType === 'kyama') 
        ? 'deposit amount' 
        : 'total amount due';
      toast.show(`Amount paid is less than ${requiredLabel}`, 'error');
      return;
    }

    const result = await completeSale({
      cart,
      cartTotal,
      products,
      selectedCustomer,
      paymentMethod,
      amountPaid: paid,
      change: (saleType === 'lipa_mdogo' || saleType === 'kyama') ? 0 : change,
      userId: user?.id || 'system',
      saleType,
      depositAmount: (saleType === 'lipa_mdogo' || saleType === 'kyama') ? depositAmount : 0,
      balanceAmount: (saleType === 'lipa_mdogo' || saleType === 'kyama') ? (cartTotal - depositAmount) : 0,
    });

    if (result.success) {
      await logSaleCompleted(result.transactionId, { cart, total_amount: cartTotal }, user?.id);
      
      // Automatically print receipt after successful sale
      try {
        const transaction = await getTransaction(result.transactionId);
        if (transaction) {
          const [business, receipt] = await Promise.all([
            getBusinessSettings(),
            getReceiptSettings(),
          ]);
          
          if (business && receipt && transaction) {
            const receiptData = {
              id: transaction.id,
              items: transaction.items,
              total_amount: transaction.total_amount,
              amount_paid: transaction.amount_paid,
              change_amount: transaction.change_amount,
              payment_method: transaction.payment_method,
              created_at: transaction.created_at,
              customer_name: selectedCustomer?.name,
              customer_phone: selectedCustomer?.phone,
              cashier_name: user?.name,
              mpesa_receipt: kcbReceiptNumber || undefined,
            };
            
            // Print receipt
            printReceipt({
              business,
              receipt,
              transaction: receiptData,
            });
            
            // Save to history for reprinting
            saveReceiptToHistory(receiptData);
            setLastTransactionId(result.transactionId);
          }
        }
      } catch (error) {
        console.error('[v0] Error printing receipt:', error);
      }
      
      clearCart();
      loadData();
      toast.show('Transaction completed successfully!');
    }
  }, [cart, cartTotal, products, selectedCustomer, paymentMethod, amountPaid, change, user?.id, toast]);

  return (
    <div className="grid grid-cols-3 gap-6 h-full">
      {/* Product Grid */}
      <div className="col-span-2 bg-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
        {/* Search and Products */}
        <div className="flex-shrink-0 p-4 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowAddProduct(true)}
              className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
            >
              <Plus size={20} />
              Add Product
            </button>
          </div>
        </div>

        {/* Products Grid - Only scrollable section */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`bg-slate-700 rounded-lg p-4 text-left transition ${
                  product.stock > 0
                    ? 'hover:bg-slate-600 hover:ring-2 hover:ring-emerald-500'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-white">{product.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    product.stock > 10 ? 'bg-emerald-600/20 text-emerald-400' :
                    product.stock > 0 ? 'bg-amber-600/20 text-amber-400' :
                    'bg-red-600/20 text-red-400'
                  }`}>
                    {product.stock} in stock
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">
                  KES {product.price.toLocaleString()}
                </p>
                {product.category && (
                  <p className="text-xs text-slate-400 mt-2">{product.category}</p>
                )}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart - Fixed height with internal scroll for items */}
      <div className="bg-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
        {/* Cart Header */}
        <div className="flex-shrink-0 p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-emerald-400" />
              <span className="font-medium text-white">Cart</span>
              <span className="text-slate-400">({cart.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {parkedSales.length > 0 && (
                <button
                  onClick={() => setShowParkedSales(true)}
                  className="relative p-2 text-amber-400 hover:bg-slate-700 rounded-lg transition"
                  title={`${parkedSales.length} parked sale(s)`}
                >
                  <Archive size={18} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                    {parkedSales.length}
                  </span>
                </button>
              )}
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-slate-400 hover:text-red-400 transition"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cart Items - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {cart.map((item) => (
            <div key={item.id} className="bg-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-medium">{item.product_name}</span>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCartItem(item.id, -1)}
                    className="w-8 h-8 bg-slate-600 rounded flex items-center justify-center hover:bg-slate-500 text-white"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-white w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateCartItem(item.id, 1)}
                    className="w-8 h-8 bg-slate-600 rounded flex items-center justify-center hover:bg-slate-500 text-white"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className="text-emerald-400 font-medium">
                  KES {item.subtotal.toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
            </div>
          )}
        </div>

        {/* Customer Selection */}
        <div className="flex-shrink-0 p-4 border-t border-slate-700">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <User size={18} className="text-emerald-400" />
                <div>
                  <p className="text-white font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-400">
                    {selectedCustomer.loyalty_points} points
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-red-400"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 text-sm"
                />
              </div>
              {customerSearch && (
                <div className="bg-slate-700 rounded-lg max-h-40 overflow-auto">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerSearch('');
                      }}
                      className="w-full p-2 text-left hover:bg-slate-600 flex items-center gap-2"
                    >
                      <User size={16} className="text-slate-400" />
                      <div>
                        <p className="text-white text-sm">{customer.name}</p>
                        <p className="text-xs text-slate-400">{customer.phone}</p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    className="w-full p-2 text-left hover:bg-slate-600 text-emerald-400 text-sm flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add new customer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Total and Checkout */}
        <div className="flex-shrink-0 p-4 border-t border-slate-700 space-y-4">
          <div className="flex justify-between text-lg">
            <span className="text-slate-400">Total</span>
            <span className="text-white font-bold">KES {cartTotal.toLocaleString()}</span>
          </div>

          {selectedCustomer && loyaltyPointsToEarn > 0 && (
            <div className="text-sm text-emerald-400 flex items-center gap-2">
              <span>+{loyaltyPointsToEarn} loyalty points</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={parkSale}
              disabled={cart.length === 0}
              className="py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              <Archive size={18} />
              Park Sale
            </button>
            <button
              onClick={() => setShowReceiptHistory(true)}
              className="py-3 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-500 transition flex items-center justify-center gap-2 text-sm"
            >
              <Printer size={18} />
              History
            </button>
            <button
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
              className="py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-700 flex-shrink-0">
              <h3 className="text-xl font-bold text-white">Checkout</h3>
              <button
                onClick={() => {
                  if (kcbStatus === 'waiting' || kcbStatus === 'initiating') {
                    if (confirm('M-Pesa payment is in progress. Are you sure you want to cancel?')) {
                      setShowCheckout(false);
                      setKCBStatus('idle');
                    }
                  } else {
                    setShowCheckout(false);
                  }
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4 min-h-0">
              {/* Sale Type Selector */}
              <SaleTypeSelector
                saleType={saleType}
                onSaleTypeChange={setSaleType}
                cartTotal={cartTotal}
                depositAmount={depositAmount}
                onDepositChange={setDepositAmount}
              />

              {/* Payment Method */}
              <div>
                <label className="text-sm text-slate-400 block mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', icon: Banknote, label: 'Cash' },
                    { id: 'card', icon: CreditCard, label: 'Card' },
                    { id: 'kcb', icon: Smartphone, label: 'KCB STK' },
                  ].map(({ id, icon: Icon, label }) => {
                    const isLocked = kcbStatus === 'waiting' || kcbStatus === 'initiating';
                    const isKcbUnconfigured = id === 'kcb' && !kcbConfigured;
                    return (
                      <button
                        key={id}
                        onClick={() => setPaymentMethod(id as 'cash' | 'card' | 'kcb')}
                        disabled={isLocked}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition relative ${
                          paymentMethod === id
                            ? 'border-emerald-500 bg-emerald-600/20'
                            : 'border-slate-600 hover:border-slate-500'
                        } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Icon size={24} className={paymentMethod === id ? 'text-emerald-400' : isKcbUnconfigured ? 'text-slate-500' : 'text-slate-400'} />
                        <span className={`text-sm ${paymentMethod === id ? 'text-white' : isKcbUnconfigured ? 'text-slate-500' : 'text-slate-400'}`}>
                          {label}
                        </span>
                        {isKcbUnconfigured && (
                          <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1 rounded">
                            {!kcbEnabled ? 'OFF' : 'KEY'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KCB BUNI STK Push Section */}
              {paymentMethod === 'kcb' && (
                <div className="bg-slate-700 rounded-lg p-4 space-y-4">
                  {/* Sandbox badge */}
                  {kcbEnvironment === 'sandbox' && (
                    <div className="flex items-center gap-2 bg-blue-900/40 border border-blue-700 rounded-lg px-3 py-2">
                      <FlaskConical size={14} className="text-blue-400" />
                      <span className="text-blue-300 text-xs font-semibold">KCB SANDBOX / TESTING MODE</span>
                      <span className="text-blue-400/70 text-xs ml-auto">No real money moves</span>
                    </div>
                  )}
                  {kcbStatus === 'idle' && (
                    <>
                      {!kcbConfigured && kcbEnvironment !== 'sandbox' && (
                        <div className="flex items-start gap-3 bg-amber-900/30 border border-amber-700 rounded-lg p-3">
                          <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-amber-300 text-sm font-medium">KCB BUNI not ready</p>
                            <p className="text-amber-400/80 text-xs mt-0.5">
                              {!kcbEnabled
                                ? 'Enable KCB BUNI in Settings › Payments'
                                : 'Add Client ID & Secret in Settings › Payments'}
                            </p>
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-slate-400">Phone Number (STK Push)</label>
                          {kcbEnvironment === 'sandbox' && (
                            <button
                              type="button"
                              onClick={() => setKCBPhone('254700000000')}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              <Zap size={11} />
                              Use test number
                            </button>
                          )}
                        </div>
                  <input
                        type="tel"
                        value={kcbPhone}
                        onChange={(e) => setKCBPhone(e.target.value)}
                        placeholder={kcbEnvironment === 'sandbox' ? '0722123456 or 254722123456' : '07XX XXX XXX'}
                          className="w-full px-4 py-3 bg-slate-600 text-white rounded-lg border border-slate-500 focus:border-emerald-500 focus:outline-none text-lg"
                        />
                        {kcbEnvironment === 'sandbox' && (
                          <p className="text-xs text-blue-400/70 mt-1">Sandbox test number: 254700000000 • PIN: any 4 digits</p>
                        )}
                      </div>
                      <button
                        onClick={handleKCBSTKPayment}
                        disabled={(kcbEnvironment !== 'sandbox' && !kcbConfigured) || !validatePhoneNumber(kcbPhone).valid}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Smartphone size={20} />
                        Send Payment Request
                      </button>
                    </>
                  )}

                  {(kcbStatus === 'initiating' || kcbStatus === 'waiting' || kcbStatus === 'checking') && (
                    <div className="space-y-4">
                      {/* Saving Action Bar */}
                      <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border border-emerald-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Loader2 size={32} className="animate-spin text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-white font-semibold">
                                {kcbStatus === 'initiating' && 'Initiating Payment...'}
                                {kcbStatus === 'waiting' && 'Waiting for Confirmation...'}
                                {kcbStatus === 'checking' && 'Verifying Payment...'}
                              </p>
                              <p className="text-emerald-300 text-sm">
                                KES {cartTotal.toLocaleString()} to {kcbPhone}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-emerald-400">
                              <Clock size={16} />
                              <span className="font-mono text-lg font-bold">
                                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">elapsed</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (elapsedSeconds / 180) * 100)}%`,
                              animation: 'pulse 2s ease-in-out infinite'
                            }}
                          />
                        </div>

                        {/* Timestamp info */}
                        {kcbStartTime && (
                          <p className="text-xs text-slate-400 mt-2 text-center">
                            Started at {kcbStartTime.toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      {/* Instructions */}
                      <div className="flex items-start gap-3 bg-slate-600/50 rounded-lg p-3">
                        <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-300">
                          {kcbStatus === 'initiating' && (
                            <p>Connecting to M-Pesa servers. Please wait...</p>
                          )}
                          {kcbStatus === 'waiting' && (
                            <p>Check your phone for the M-Pesa prompt and enter your PIN to confirm payment.</p>
                          )}
                          {kcbStatus === 'checking' && (
                            <p>Payment detected. Verifying transaction with M-Pesa...</p>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {kcbStatus === 'success' && (
                    <div className="space-y-4">
                      {/* Success Action Bar */}
                      <div className="bg-gradient-to-r from-emerald-900/50 to-green-900/50 border border-emerald-600 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 size={40} className="text-emerald-400" />
                          <div className="flex-1">
                            <p className="text-white font-bold text-lg">Payment Successful!</p>
                            <p className="text-emerald-300">KES {cartTotal.toLocaleString()} received</p>
                          </div>
                        </div>

                        {kcbReceiptNumber && (
                          <div className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center">
                            <span className="text-slate-400 text-sm">KCB Receipt Number</span>
                            <span className="text-white font-mono font-bold">{kcbReceiptNumber}</span>
                          </div>
                        )}

                        {kcbStartTime && (
                          <p className="text-xs text-slate-400 mt-3 text-center">
                            Completed at {new Date().toLocaleTimeString()} ({elapsedSeconds}s)
                          </p>
                        )}
                      </div>

                      {/* Completing sale message */}
                      <div className="flex items-center justify-center gap-2 text-emerald-400">
                        <Loader2 size={20} className="animate-spin" />
                        <span>Completing sale...</span>
                      </div>

                      {/* Reprint button */}
                      <button
                        onClick={async () => {
                          try {
                            if (!lastTransactionId) {
                              toast.show('No transaction to reprint');
                              return;
                            }
                            const transaction = await getTransaction(lastTransactionId);
                            if (transaction) {
                              const [business, receipt] = await Promise.all([
                                getBusinessSettings(),
                                getReceiptSettings(),
                              ]);
                              if (business && receipt) {
                                printReceipt({
                                  business,
                                  receipt,
                                  transaction: {
                                    id: transaction.id,
                                    items: transaction.items,
                                    total_amount: transaction.total_amount,
                                    amount_paid: transaction.amount_paid,
                                    change_amount: transaction.change_amount,
                                    payment_method: transaction.payment_method,
                                    created_at: transaction.created_at,
                                    customer_name: selectedCustomer?.name || transaction.customer_name,
                                    customer_phone: selectedCustomer?.phone || transaction.customer_phone,
                                    cashier_name: user?.name,
                                    mpesa_receipt: transaction.mpesa_receipt,
                                  },
                                });
                                toast.show('Receipt sent to printer');
                              }
                            }
                          } catch (error) {
                            console.error('[v0] Error reprinting:', error);
                            toast.show('Error printing receipt');
                          }
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                      >
                        <Printer size={16} />
                        Reprint Receipt
                      </button>
                    </div>
                  )}

                  {(kcbStatus === 'failed' || kcbStatus === 'cancelled') && (
                    <div className="space-y-4">
                      {/* Failed Action Bar */}
                      <div className="bg-gradient-to-r from-red-900/50 to-rose-900/50 border border-red-700 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <XCircle size={40} className="text-red-400" />
                          <div className="flex-1">
                            <p className="text-white font-bold text-lg">
                              {kcbStatus === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}
                            </p>
                            <p className="text-red-300">KES {cartTotal.toLocaleString()} not received</p>
                          </div>
                        </div>

                        {kcbError && (
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <p className="text-slate-300 text-sm">{kcbError}</p>
                          </div>
                        )}

                        {kcbStartTime && (
                          <p className="text-xs text-slate-400 mt-3 text-center">
                            Failed after {elapsedSeconds}s at {new Date().toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setKCBStatus('idle');
                          setKCBError(null);
                          setKCBStartTime(null);
                          setElapsedSeconds(0);
                        }}
                        className="w-full py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition flex items-center justify-center gap-2"
                      >
                        Try Again
                      </button>


                    </div>
                  )}
                </div>
              )}

              {/* Cash/Card Payment Section */}
              {paymentMethod !== 'kcb' && (
                <>
                  {/* Amount Paid */}
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">
                      {saleType === 'lipa_mdogo' || saleType === 'kyama' 
                        ? 'Deposit Amount (KES)' 
                        : 'Amount Paid (KES)'}
                    </label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={(saleType === 'lipa_mdogo' || saleType === 'kyama' 
                        ? depositAmount 
                        : cartTotal).toString()}
                      className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-lg"
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-slate-700 rounded-lg p-4 space-y-2">
                    {saleType === 'lipa_mdogo' || saleType === 'kyama' ? (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>Total Amount</span>
                          <span>KES {cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-emerald-400">
                          <span>Deposit Today</span>
                          <span>KES {depositAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Received</span>
                          <span>KES {(parseFloat(amountPaid) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-slate-600 pt-2">
                          <span className="text-white">Balance Due</span>
                          <span className="text-amber-400">KES {Math.max(0, cartTotal - depositAmount).toLocaleString()}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>Total</span>
                          <span>KES {cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Paid</span>
                          <span>KES {(parseFloat(amountPaid) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-slate-600 pt-2">
                          <span className="text-white">Change</span>
                          <span className="text-emerald-400">KES {change.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Complete Button */}
                  <button
                    onClick={handleCheckout}
                    className="w-full py-4 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition"
                  >
                    Complete Sale
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">New Customer</h3>
              <button onClick={() => setShowNewCustomer(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Phone</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleCreateCustomer}
                disabled={!newCustomer.name}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Product</h3>
              <button onClick={() => setShowAddProduct(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Price (KES) *</label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Stock</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Category</label>
                  <input
                    type="text"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleAddProduct}
                disabled={!newProduct.name || !newProduct.price}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parked Sales Modal */}
      {showParkedSales && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Parked Sales</h3>
              <button onClick={() => setShowParkedSales(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {parkedSales.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Archive size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No parked sales</p>
                </div>
              ) : (
                parkedSales.map((sale) => {
                  const saleTotal = sale.cart.reduce((sum, item) => sum + item.subtotal, 0);
                  return (
                    <div key={sale.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-white font-medium">
                            {sale.cart.length} item{sale.cart.length !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(sale.timestamp).toLocaleString()}
                          </p>
                          {sale.customer && (
                            <p className="text-xs text-emerald-400 mt-1">
                              Customer: {sale.customer.name}
                            </p>
                          )}
                        </div>
                        <p className="text-lg font-bold text-emerald-400">
                          KES {saleTotal.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resumeSale(sale.id)}
                          className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                        >
                          <ArchiveRestore size={16} />
                          Resume
                        </button>
                        <button
                          onClick={() => deleteParkedSale(sale.id)}
                          className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt History Modal */}
      {showReceiptHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-2xl p-6 max-h-96 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Receipt History</h3>
              <button onClick={() => setShowReceiptHistory(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1">
              {getReceiptHistory().length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Printer size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No receipt history</p>
                </div>
              ) : (
                getReceiptHistory().map((receipt) => (
                  <div key={receipt.id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-white font-medium">{receipt.id}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(receipt.created_at).toLocaleString()}
                        </p>
                        {receipt.customer_name && (
                          <p className="text-xs text-emerald-400 mt-1">
                            Customer: {receipt.customer_name}
                          </p>
                        )}
                        <p className="text-xs text-slate-300 mt-1">
                          {receipt.items.length} item{receipt.items.length !== 1 ? 's' : ''} • {receipt.payment_method.toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">
                          KES {receipt.total_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const [business, receiptSettings] = await Promise.all([
                            getBusinessSettings(),
                            getReceiptSettings(),
                          ]);
                          if (business && receiptSettings) {
                            printReceipt({
                              business,
                              receipt: receiptSettings,
                              transaction: receipt,
                            });
                            toast.show('Receipt sent to printer');
                          }
                        } catch (error) {
                          console.error('[v0] Error reprinting from history:', error);
                          toast.show('Error printing receipt');
                        }
                      }}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Printer size={16} />
                      Reprint
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
