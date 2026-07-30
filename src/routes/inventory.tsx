import { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  Search,
  ArrowUpDown,
  History,
  Box,
  X,
  Save,
  Pencil,
  Truck,
  Trash2,
} from 'lucide-react';
import {
  getAllProducts,
  saveProduct,
  getAllStockMovements,
  saveStockMovement,
  saveStockAdjustment,
  generateId,
  getAllSuppliers,
  saveSupplier,
  saveDelivery,
  saveDeliveryItem,
  getDeliveriesByStatus,
  getDeliveryItemsByDelivery,
} from '../lib/db';
import { syncInsertStockMovement, syncUpdateProduct, syncInsertDelivery, syncInsertDeliveryItem } from '../lib/sync';
import { logStockAdjusted } from '../lib/audit';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import type { Product, StockMovement, Supplier, Delivery, DeliveryItem } from '../lib/types';

type TabType = 'overview' | 'adjustments' | 'deliveries' | 'movements';

export function InventoryPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentData, setAdjustmentData] = useState({
    newStock: 0,
    reason: '',
    note: '',
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    sku: '',
    price: 0,
    cost: 0,
    category: '',
    low_stock_alert: 5,
    barcode: '',
  });

  // Delivery states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showDeliveryDetailModal, setShowDeliveryDetailModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [deliveryDetailItems, setDeliveryDetailItems] = useState<DeliveryItem[]>([]);
  const [deliveryFormData, setDeliveryFormData] = useState({
    supplier_id: '',
    delivery_note_number: '',
    notes: '',
  });
  const [deliveryItems, setDeliveryItems] = useState<Array<{
    product_id: string;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
  }>>([]);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const productData = await getAllProducts();
    setProducts(productData);

    const movements = await getAllStockMovements();
    movements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setStockMovements(movements.slice(0, 100));

    const supplierData = await getAllSuppliers();
    setSuppliers(supplierData);

    const allDeliveries = await getDeliveriesByStatus('pending');
    allDeliveries.push(...(await getDeliveriesByStatus('received')));
    allDeliveries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setDeliveries(allDeliveries.slice(0, 50));
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockProducts = products.filter(
    (p) => p.stock > 0 && p.stock <= (p.low_stock_alert || 5)
  );
  const outOfStockProducts = products.filter((p) => p.stock === 0);
  const totalInventoryValue = products.reduce(
    (sum, p) => sum + p.stock * (p.cost || p.price),
    0
  );

  const handleAdjustment = async () => {
    if (!selectedProduct) return;
    if (!adjustmentData.reason) {
      toast.show('Please select a reason for the adjustment', 'error');
      return;
    }

    const previousStock = selectedProduct.stock;
    const newStock = Math.max(0, adjustmentData.newStock);
    const qtyDelta = newStock - previousStock;
    const now = new Date().toISOString();

    const movement: StockMovement = {
      id: generateId(),
      product_id: selectedProduct.id,
      qty_delta: qtyDelta,
      reason: 'adjustment',
      note: adjustmentData.note || adjustmentData.reason,
      balance_after: newStock,
      reference_type: 'adjustment',
      created_at: now,
      created_by: user?.id || 'system',
      sync_status: 'pending',
      local_id: generateId(),
    };

    await saveStockMovement(movement);
    syncInsertStockMovement(movement);

    await saveStockAdjustment({
      id: generateId(),
      product_id: selectedProduct.id,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: adjustmentData.reason,
      note: adjustmentData.note,
      created_by: user?.id || 'system',
      created_at: now,
      sync_status: 'pending',
      local_id: generateId(),
    });

    const updatedProduct: Product = {
      ...selectedProduct,
      stock: newStock,
      updated_at: now,
      sync_status: 'pending',
    };
    await saveProduct(updatedProduct);
    syncUpdateProduct(updatedProduct);

    await logStockAdjusted(selectedProduct.id, previousStock, newStock, adjustmentData.reason, user?.id);

    toast.show('Stock adjusted successfully');
    setShowAdjustmentModal(false);
    setSelectedProduct(null);
    setAdjustmentData({ newStock: 0, reason: '', note: '' });
    loadData();
  };

  const openAdjustmentModal = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentData({
      newStock: product.stock,
      reason: '',
      note: '',
    });
    setShowAdjustmentModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      sku: product.sku || '',
      price: product.price,
      cost: product.cost,
      category: product.category || '',
      low_stock_alert: product.low_stock_alert || 5,
      barcode: product.barcode || '',
    });
    setShowEditModal(true);
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    if (!editFormData.name.trim()) {
      toast.show('Product name is required', 'error');
      return;
    }
    if (editFormData.price < 0) {
      toast.show('Price cannot be negative', 'error');
      return;
    }
    if (editFormData.cost < 0) {
      toast.show('Cost cannot be negative', 'error');
      return;
    }

    const now = new Date().toISOString();
    const updatedProduct: Product = {
      ...editingProduct,
      name: editFormData.name.trim(),
      sku: editFormData.sku.trim() || undefined,
      price: editFormData.price,
      cost: editFormData.cost,
      category: editFormData.category.trim() || undefined,
      low_stock_alert: editFormData.low_stock_alert,
      barcode: editFormData.barcode.trim() || undefined,
      updated_at: now,
      sync_status: 'pending',
    };

    await saveProduct(updatedProduct);
    syncUpdateProduct(updatedProduct);

    toast.show('Product updated successfully');
    setShowEditModal(false);
    setEditingProduct(null);
    loadData();
  };

  // Delivery handlers
  const openDeliveryModal = () => {
    setDeliveryFormData({ supplier_id: '', delivery_note_number: '', notes: '' });
    setDeliveryItems([{ product_id: '', quantity_ordered: 0, quantity_received: 0, unit_cost: 0 }]);
    setShowDeliveryModal(true);
  };

  const addDeliveryItem = () => {
    setDeliveryItems([...deliveryItems, { product_id: '', quantity_ordered: 0, quantity_received: 0, unit_cost: 0 }]);
  };

  const removeDeliveryItem = (index: number) => {
    if (deliveryItems.length > 1) {
      setDeliveryItems(deliveryItems.filter((_, i) => i !== index));
    }
  };

  const updateDeliveryItem = (index: number, field: string, value: string | number) => {
    const updated = [...deliveryItems];
    updated[index] = { ...updated[index], [field]: value };
    setDeliveryItems(updated);
  };

  const handleSaveDelivery = async () => {
    if (!deliveryFormData.supplier_id && suppliers.length > 0) {
      toast.show('Please select a supplier or create one', 'error');
      return;
    }

    const validItems = deliveryItems.filter(item => item.product_id && item.quantity_ordered > 0);
    if (validItems.length === 0) {
      toast.show('Please add at least one item with a product and quantity', 'error');
      return;
    }

    const now = new Date().toISOString();
    const deliveryId = generateId();
    const totalValue = validItems.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_cost), 0);

    const delivery: Delivery = {
      id: deliveryId,
      supplier_id: deliveryFormData.supplier_id || undefined,
      delivery_note_number: deliveryFormData.delivery_note_number || undefined,
      status: 'pending',
      total_items: validItems.length,
      total_value: totalValue,
      notes: deliveryFormData.notes || undefined,
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
    };

    await saveDelivery(delivery);
    syncInsertDelivery(delivery);

    for (const item of validItems) {
      const deliveryItem: DeliveryItem = {
        id: generateId(),
        delivery_id: deliveryId,
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_cost: item.unit_cost,
        sync_status: 'pending',
      };
      await saveDeliveryItem(deliveryItem);
      syncInsertDeliveryItem(deliveryItem);
    }

    toast.show('Delivery created successfully');
    setShowDeliveryModal(false);
    loadData();
  };

  const handleReceiveDelivery = async (delivery: Delivery, items: DeliveryItem[]) => {
    const now = new Date().toISOString();

    for (const item of items) {
      if (item.quantity_received > 0) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const previousStock = product.stock;
          const newStock = previousStock + item.quantity_received;

          const movement: StockMovement = {
            id: generateId(),
            product_id: product.id,
            qty_delta: item.quantity_received,
            reason: 'restock',
            note: `Delivery ${delivery.delivery_note_number || delivery.id.slice(0, 8)}`,
            balance_after: newStock,
            reference_type: 'delivery',
            reference_id: delivery.id,
            created_at: now,
            created_by: user?.id || 'system',
            sync_status: 'pending',
            local_id: generateId(),
          };
          await saveStockMovement(movement);
          syncInsertStockMovement(movement);

          const updatedProduct: Product = {
            ...product,
            stock: newStock,
            updated_at: now,
            sync_status: 'pending',
          };
          await saveProduct(updatedProduct);
          syncUpdateProduct(updatedProduct);
        }
      }
    }

    const updatedDelivery: Delivery = {
      ...delivery,
      status: 'received',
      received_by: user?.id,
      received_at: now,
      updated_at: now,
      sync_status: 'pending',
    };
    await saveDelivery(updatedDelivery);
    syncInsertDelivery(updatedDelivery);

    toast.show('Delivery received and stock updated');
    setShowDeliveryDetailModal(false);
    setSelectedDelivery(null);
    setDeliveryDetailItems([]);
    loadData();
  };

  const openDeliveryDetail = async (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    const items = await getDeliveryItemsByDelivery(delivery.id);
    setDeliveryDetailItems(items);
    setShowDeliveryDetailModal(true);
  };

  // Supplier handlers
  const openSupplierModal = () => {
    setSupplierFormData({ name: '', contact_person: '', phone: '', email: '', address: '' });
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierFormData.name.trim()) {
      toast.show('Supplier name is required', 'error');
      return;
    }

    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: generateId(),
      name: supplierFormData.name.trim(),
      contact_person: supplierFormData.contact_person.trim() || undefined,
      phone: supplierFormData.phone.trim() || undefined,
      email: supplierFormData.email.trim() || undefined,
      address: supplierFormData.address.trim() || undefined,
      is_active: true,
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
    };

    await saveSupplier(supplier);
    toast.show('Supplier created successfully');
    setShowSupplierModal(false);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 bg-slate-800 rounded-lg p-1">
        {(['overview', 'adjustments', 'deliveries', 'movements'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition capitalize ${
              activeTab === tab
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                  <Box size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{products.length}</p>
                  <p className="text-sm text-slate-400">Total Products</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Package size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    KES {totalInventoryValue.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-400">Inventory Value</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{lowStockProducts.length}</p>
                  <p className="text-sm text-slate-400">Low Stock Alert</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                  <Package size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{outOfStockProducts.length}</p>
                  <p className="text-sm text-slate-400">Out of Stock</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                Inventory Alerts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lowStockProducts.length > 0 && (
                  <div className="bg-slate-700 rounded-lg p-4">
                    <p className="text-sm text-amber-400 mb-2">Low Stock</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-overlay">
                      {lowStockProducts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-white">{p.name}</span>
                          <span className="text-amber-400">{p.stock} left</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {outOfStockProducts.length > 0 && (
                  <div className="bg-slate-700 rounded-lg p-4">
                    <p className="text-sm text-red-400 mb-2">Out of Stock</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-overlay">
                      {outOfStockProducts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-white">{p.name}</span>
                          <span className="text-red-400">Out of stock</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Product List */}
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white">Stock Levels</h3>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2 text-right">Stock</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-700/50">
                      <td className="py-3 text-white">{product.name}</td>
                      <td className="py-3 text-slate-400">{product.sku || '-'}</td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-medium ${
                            product.stock === 0
                              ? 'text-red-400'
                              : product.stock <= (product.low_stock_alert || 5)
                              ? 'text-amber-400'
                              : 'text-white'
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 text-right text-slate-400">
                        KES {(product.stock * (product.cost || product.price)).toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300"
                          >
                            <Pencil size={14} className="inline mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => openAdjustmentModal(product)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300"
                          >
                            <ArrowUpDown size={14} className="inline mr-1" />
                            Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Adjustments Tab */}
      {activeTab === 'adjustments' && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="font-medium text-white mb-4">Stock Adjustments</h3>
          <p className="text-slate-400 text-center py-8">
            Manual stock adjustments will appear here. Use the Adjust button in the
            Overview tab to make adjustments.
          </p>
        </div>
      )}

      {/* Deliveries Tab */}
      {activeTab === 'deliveries' && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white flex items-center gap-2">
              <Truck size={18} className="text-emerald-400" />
              Deliveries
            </h3>
            <button
              onClick={openDeliveryModal}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-sm font-medium transition"
            >
              <Plus size={18} />
              New Delivery
            </button>
          </div>

          {deliveries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Note #</th>
                    <th className="pb-2">Supplier</th>
                    <th className="pb-2 text-center">Items</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2 text-center">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {deliveries.map((delivery) => {
                    const supplier = suppliers.find(s => s.id === delivery.supplier_id);
                    return (
                      <tr key={delivery.id} className="hover:bg-slate-700/50">
                        <td className="py-3 text-sm text-slate-400">
                          {new Date(delivery.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-white text-sm font-mono">
                          {delivery.delivery_note_number || '-'}
                        </td>
                        <td className="py-3 text-white text-sm">
                          {supplier?.name || 'Unknown'}
                        </td>
                        <td className="py-3 text-center text-white">
                          {delivery.total_items}
                        </td>
                        <td className="py-3 text-right text-white">
                          KES {delivery.total_value.toLocaleString()}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            delivery.status === 'received'
                              ? 'bg-emerald-600/20 text-emerald-400'
                              : delivery.status === 'cancelled'
                              ? 'bg-red-600/20 text-red-400'
                              : 'bg-amber-600/20 text-amber-400'
                          }`}>
                            {delivery.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => openDeliveryDetail(delivery)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">
              No deliveries yet. Click "New Delivery" to create one.
            </p>
          )}
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white flex items-center gap-2">
              <History size={18} className="text-emerald-400" />
              Stock Movement History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Qty Change</th>
                  <th className="pb-2 text-right">Balance</th>
                  <th className="pb-2">Reason</th>
                  <th className="pb-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {stockMovements.map((movement) => {
                  const product = products.find(p => p.id === movement.product_id);
                  return (
                    <tr key={movement.id} className="hover:bg-slate-700/50">
                      <td className="py-3 text-sm text-slate-400">
                        {new Date(movement.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 text-white text-sm">
                        {product?.name || movement.product_id.slice(0, 8)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-medium ${
                            movement.qty_delta > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {movement.qty_delta > 0 ? '+' : ''}
                          {movement.qty_delta}
                        </span>
                      </td>
                      <td className="py-3 text-right text-white">
                        {movement.balance_after}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                          {movement.reason}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-slate-400 max-w-xs truncate">
                        {movement.note || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {stockMovements.length === 0 && (
            <p className="text-center text-slate-400 py-8">
              No stock movements recorded yet
            </p>
          )}
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustmentModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Adjust Stock</h3>
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-sm text-slate-400">Product</p>
                <p className="text-white font-medium">{selectedProduct.name}</p>
                <p className="text-sm text-slate-400">
                  Current Stock: <span className="text-white">{selectedProduct.stock}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">New Stock Level</label>
                <input
                  type="number"
                  value={adjustmentData.newStock}
                  onChange={(e) =>
                    setAdjustmentData({ ...adjustmentData, newStock: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Change:{' '}
                  <span
                    className={
                      adjustmentData.newStock - selectedProduct.stock > 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }
                  >
                    {adjustmentData.newStock - selectedProduct.stock > 0 ? '+' : ''}
                    {adjustmentData.newStock - selectedProduct.stock}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Reason</label>
                <select
                  value={adjustmentData.reason}
                  onChange={(e) =>
                    setAdjustmentData({ ...adjustmentData, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select reason...</option>
                  <option value="Stock count correction">Stock count correction</option>
                  <option value="Damaged goods">Damaged goods</option>
                  <option value="Theft/loss">Theft/loss</option>
                  <option value="Return to supplier">Return to supplier</option>
                  <option value="Found stock">Found stock</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Note (optional)</label>
                <textarea
                  value={adjustmentData.note}
                  onChange={(e) =>
                    setAdjustmentData({ ...adjustmentData, note: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Additional details..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAdjustmentModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustment}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Edit Product</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-sm text-slate-400">Product ID</p>
                <p className="text-white font-mono text-sm">{editingProduct.id.slice(0, 12)}...</p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Enter product name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="SKU"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={editFormData.barcode}
                    onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Barcode"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Selling Price (KES) *</label>
                  <input
                    type="number"
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Cost Price (KES)</label>
                  <input
                    type="number"
                    value={editFormData.cost}
                    onChange={(e) => setEditFormData({ ...editFormData, cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <input
                    type="text"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Category"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    value={editFormData.low_stock_alert}
                    onChange={(e) => setEditFormData({ ...editFormData, low_stock_alert: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    min="0"
                  />
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Current Stock:</span>
                  <span className="text-white font-medium">{editingProduct.stock}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-400">Stock Value:</span>
                  <span className="text-white font-medium">
                    KES {(editingProduct.stock * editFormData.cost).toLocaleString()}
                  </span>
                </div>
                {editFormData.cost > 0 && editFormData.price > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-400">Profit Margin:</span>
                    <span className="text-emerald-400 font-medium">
                      {(((editFormData.price - editFormData.cost) / editFormData.price) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditProduct}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Delivery Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Truck size={20} className="text-emerald-400" />
                New Delivery
              </h3>
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Supplier</label>
                  <div className="flex gap-2">
                    <select
                      value={deliveryFormData.supplier_id}
                      onChange={(e) => setDeliveryFormData({ ...deliveryFormData, supplier_id: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={openSupplierModal}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300"
                      title="Add new supplier"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Delivery Note #</label>
                  <input
                    type="text"
                    value={deliveryFormData.delivery_note_number}
                    onChange={(e) => setDeliveryFormData({ ...deliveryFormData, delivery_note_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="DN-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
                <textarea
                  value={deliveryFormData.notes}
                  onChange={(e) => setDeliveryFormData({ ...deliveryFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Delivery notes..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Items</label>
                  <button
                    onClick={addDeliveryItem}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm text-white"
                  >
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {deliveryItems.map((item, index) => {
                    const product = products.find(p => p.id === item.product_id);
                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          {index === 0 && <label className="block text-xs text-slate-500 mb-1">Product</label>}
                          <select
                            value={item.product_id}
                            onChange={(e) => updateDeliveryItem(index, 'product_id', e.target.value)}
                            className="w-full px-2 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Select product...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          {index === 0 && <label className="block text-xs text-slate-500 mb-1">Qty</label>}
                          <input
                            type="number"
                            value={item.quantity_ordered || ''}
                            onChange={(e) => updateDeliveryItem(index, 'quantity_ordered', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                            min="0"
                          />
                        </div>
                        <div className="col-span-3">
                          {index === 0 && <label className="block text-xs text-slate-500 mb-1">Unit Cost</label>}
                          <input
                            type="number"
                            value={item.unit_cost || ''}
                            onChange={(e) => updateDeliveryItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          {product && item.quantity_ordered > 0 && (
                            <span className="text-xs text-slate-400">
                              KES {((item.quantity_ordered * item.unit_cost) || 0).toLocaleString()}
                            </span>
                          )}
                          {deliveryItems.length > 1 && (
                            <button
                              onClick={() => removeDeliveryItem(index)}
                              className="p-1 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-3 flex justify-between items-center">
                <span className="text-slate-400">Total Value:</span>
                <span className="text-white font-bold">
                  KES {deliveryItems.reduce((sum, item) => sum + ((item.quantity_ordered * item.unit_cost) || 0), 0).toLocaleString()}
                </span>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDelivery}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Create Delivery
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">New Supplier</h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Supplier name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={supplierFormData.contact_person}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_person: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Contact person name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Address</label>
                <textarea
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Physical address"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSupplier}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Detail Modal */}
      {showDeliveryDetailModal && selectedDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Truck size={20} className="text-emerald-400" />
                Delivery {selectedDelivery.delivery_note_number || `#${selectedDelivery.id.slice(0, 8)}`}
              </h3>
              <button
                onClick={() => {
                  setShowDeliveryDetailModal(false);
                  setSelectedDelivery(null);
                  setDeliveryDetailItems([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 bg-slate-700 rounded-lg p-3">
                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="text-white text-sm">{new Date(selectedDelivery.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Supplier</p>
                  <p className="text-white text-sm">{suppliers.find(s => s.id === selectedDelivery.supplier_id)?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedDelivery.status === 'received'
                      ? 'bg-emerald-600/20 text-emerald-400'
                      : 'bg-amber-600/20 text-amber-400'
                  }`}>
                    {selectedDelivery.status}
                  </span>
                </div>
              </div>

              {selectedDelivery.notes && (
                <div className="bg-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Notes</p>
                  <p className="text-white text-sm">{selectedDelivery.notes}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-white mb-2">Items</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                        <th className="pb-2">Product</th>
                        <th className="pb-2 text-right">Ordered</th>
                        {selectedDelivery.status === 'pending' && <th className="pb-2 text-right">Received</th>}
                        <th className="pb-2 text-right">Unit Cost</th>
                        <th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {deliveryDetailItems.map((item) => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <tr key={item.id}>
                            <td className="py-2 text-white text-sm">{product?.name || 'Unknown'}</td>
                            <td className="py-2 text-right text-slate-300">{item.quantity_ordered}</td>
                            {selectedDelivery.status === 'pending' && (
                              <td className="py-2 text-right">
                                <input
                                  type="number"
                                  value={item.quantity_received || ''}
                                  onChange={(e) => {
                                    const updated = deliveryDetailItems.map(i =>
                                      i.id === item.id ? { ...i, quantity_received: parseInt(e.target.value) || 0 } : i
                                    );
                                    setDeliveryDetailItems(updated);
                                  }}
                                  className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm text-right focus:outline-none focus:border-emerald-500"
                                  min="0"
                                  max={item.quantity_ordered}
                                />
                              </td>
                            )}
                            <td className="py-2 text-right text-slate-300">
                              KES {item.unit_cost.toLocaleString()}
                            </td>
                            <td className="py-2 text-right text-white">
                              KES {(item.quantity_ordered * item.unit_cost).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-700 rounded-lg p-3 flex justify-between items-center">
                <span className="text-slate-400">Total Value:</span>
                <span className="text-white font-bold">
                  KES {selectedDelivery.total_value.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeliveryDetailModal(false);
                    setSelectedDelivery(null);
                    setDeliveryDetailItems([]);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition"
                >
                  Close
                </button>
                {selectedDelivery.status === 'pending' && (
                  <button
                    onClick={() => handleReceiveDelivery(selectedDelivery, deliveryDetailItems)}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition flex items-center justify-center gap-2"
                  >
                    <Package size={18} />
                    Receive Delivery
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
