import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Package, AlertTriangle, X, Power, AlertCircle, Trash2 } from 'lucide-react';
import { getAllProducts, saveProduct, deleteProduct, generateId } from '../lib/db';
import { syncInsertProduct, syncUpdateProduct, syncDeleteProduct } from '../lib/sync';
import { logProductCreated, logProductUpdated, logPriceChanged } from '../lib/audit';
import { useAuth, PermissionGuard } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import type { Product } from '../lib/types';

interface DuplicateCheck {
  nameMatch: Product | null;
  skuMatch: Product | null;
}

// Normalize for comparison: lowercase, trim, collapse internal whitespace
const normalizeName = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

export function ProductsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    price: '',
    cost: '',
    stock: '',
    category: '',
  });
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheck | null>(null);
  const [editDuplicateWarning, setEditDuplicateWarning] = useState<DuplicateCheck | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const data = await getAllProducts();
    setProducts(data);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= 10 && p.stock > 0);
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter(p => p.stock === 0);
  }, [products]);

  // Check for duplicate products against the provided list (defaults to current state)
  const checkForDuplicate = (name: string, sku: string, excludeId?: string, list?: Product[]): DuplicateCheck => {
    const pool = list ?? products;
    const normedName = normalizeName(name);
    const skuTrimmed = sku.trim().toLowerCase();

    const nameMatch = pool.find(
      p => normalizeName(p.name) === normedName && p.id !== excludeId
    ) || null;

    const skuMatch = skuTrimmed
      ? pool.find(p => (p.sku?.trim().toLowerCase() ?? '') === skuTrimmed && p.id !== excludeId) || null
      : null;

    return { nameMatch, skuMatch };
  };

  // Update duplicate warning when name or SKU changes (Add Modal)
  useEffect(() => {
    if (!showAddModal) {
      setDuplicateWarning(null);
      return;
    }

    if (newProduct.name.trim() || newProduct.sku.trim()) {
      const duplicates = checkForDuplicate(newProduct.name, newProduct.sku);
      if (duplicates.nameMatch || duplicates.skuMatch) {
        setDuplicateWarning(duplicates);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [newProduct.name, newProduct.sku, showAddModal, products]);

  // Update duplicate warning when editing (Edit Modal)
  useEffect(() => {
    if (!editingProduct) {
      setEditDuplicateWarning(null);
      return;
    }

    if (editingProduct.name.trim() || editingProduct.sku?.trim()) {
      const duplicates = checkForDuplicate(editingProduct.name, editingProduct.sku || '', editingProduct.id);
      if (duplicates.nameMatch || duplicates.skuMatch) {
        setEditDuplicateWarning(duplicates);
      } else {
        setEditDuplicateWarning(null);
      }
    } else {
      setEditDuplicateWarning(null);
    }
  }, [editingProduct?.name, editingProduct?.sku, editingProduct?.id, products]);

  const handleDeleteProduct = async (product: Product) => {
    await deleteProduct(product.id);
    await syncDeleteProduct(product.id);
    toast.show(`"${product.name}" removed`);
    setConfirmDeleteProduct(null);
    loadProducts();
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) return;

    // Always reload from IndexedDB for the freshest data before checking
    const freshProducts = await getAllProducts();
    const duplicates = checkForDuplicate(newProduct.name, newProduct.sku, undefined, freshProducts);
    if (duplicates.nameMatch || duplicates.skuMatch) {
      toast.show('Cannot add: Product already exists', 'error');
      // Update warning in UI too
      setDuplicateWarning(duplicates);
      return;
    }

    const product: Product = {
      id: generateId(),
      name: newProduct.name,
      sku: newProduct.sku || undefined,
      price: parseFloat(newProduct.price),
      cost: parseFloat(newProduct.cost) || 0,
      stock: parseInt(newProduct.stock) || 0,
      category: newProduct.category || undefined,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await saveProduct(product);
    syncInsertProduct(product);
    await logProductCreated(product.id, product, user?.id);
    toast.show('Product added successfully');
    setNewProduct({ name: '', sku: '', price: '', cost: '', stock: '', category: '' });
    setDuplicateWarning(null);
    setShowAddModal(false);
    loadProducts();
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    // Always reload from IndexedDB for the freshest data before checking
    const freshProducts = await getAllProducts();
    const duplicates = checkForDuplicate(editingProduct.name, editingProduct.sku || '', editingProduct.id, freshProducts);
    if (duplicates.nameMatch || duplicates.skuMatch) {
      toast.show('Cannot update: Duplicate name or SKU exists', 'error');
      setEditDuplicateWarning(duplicates);
      return;
    }

    const oldProduct = products.find(p => p.id === editingProduct.id);
    const updated = {
      ...editingProduct,
      updated_at: new Date().toISOString(),
      sync_status: 'pending' as const,
    };

    await saveProduct(updated);
    syncUpdateProduct(updated);
    await logProductUpdated(updated.id, oldProduct, updated, user?.id);
    if (oldProduct && oldProduct.price !== updated.price) {
      await logPriceChanged(updated.id, oldProduct.price, updated.price, 'Price updated via product edit', user?.id);
    }
    toast.show('Product updated successfully');
    setEditingProduct(null);
    setEditDuplicateWarning(null);
    loadProducts();
  };

  const handleToggleActive = async (product: Product) => {
    const updated = {
      ...product,
      is_active: !product.is_active,
      updated_at: new Date().toISOString(),
      sync_status: 'pending' as const,
    };

    await saveProduct(updated);
    syncUpdateProduct(updated);
    toast.show(`Product ${updated.is_active ? 'activated' : 'deactivated'}`);
    loadProducts();
  };

  const totalValue = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock * p.cost, 0);
  }, [products]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{products.length}</p>
              <p className="text-sm text-slate-400">Total Products</p>
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
              <p className="text-sm text-slate-400">Low Stock</p>
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
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">KES {totalValue.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Inventory Value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Add */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <PermissionGuard permission="inventory.create" fallback={<span />}>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
          >
            <Plus size={20} />
            Add Product
          </button>
        </PermissionGuard>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-600/10 border border-amber-600/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-amber-400" size={20} />
            <h3 className="font-medium text-amber-400">Low Stock Alert</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map((p) => (
              <span key={p.id} className="px-3 py-1 bg-amber-600/20 rounded-full text-sm text-amber-400">
                {p.name} ({p.stock} left)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Categories:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSearchTerm(cat)}
              className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300 hover:bg-slate-600 transition"
            >
              {cat}
            </button>
          ))}
          <button
            onClick={() => setSearchTerm('')}
            className="px-3 py-1 text-sm text-slate-400 hover:text-white transition"
          >
            Clear
          </button>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0 flex-1">
        <div className="overflow-y-auto flex-1">
          <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Product</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">SKU</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Category</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Price</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Cost</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Stock</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredProducts.map((product) => (
              <tr key={product.id} className={`hover:bg-slate-700/50 ${!product.is_active ? 'opacity-50' : ''}`}>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center">
                      <Package size={20} className="text-slate-400" />
                    </div>
                    <span className="text-white font-medium">{product.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">{product.sku || '-'}</td>
                <td className="py-3 px-4 text-slate-400">{product.category || '-'}</td>
                <td className="py-3 px-4 text-right font-medium text-emerald-400">
                  KES {product.price.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right text-slate-400">
                  KES {product.cost.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    product.stock === 0
                      ? 'bg-red-600/20 text-red-400'
                      : product.stock <= 10
                      ? 'bg-amber-600/20 text-amber-400'
                      : 'bg-emerald-600/20 text-emerald-400'
                  }`}>
                    {product.stock}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(product)}
                      className={`p-2 rounded transition ${
                        product.is_active
                          ? 'text-emerald-400 hover:bg-slate-600'
                          : 'text-red-400 hover:bg-slate-600'
                      }`}
                      title={product.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <Power size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteProduct(product)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-600 rounded transition"
                      title="Delete permanently"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>No products found</p>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Product</h3>
              <button onClick={() => { setShowAddModal(false); setDuplicateWarning(null); }} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Duplicate Warning */}
            {duplicateWarning && (duplicateWarning.nameMatch || duplicateWarning.skuMatch) && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-red-400 mt-0.5 flex-shrink-0" size={18} />
                  <div className="text-sm text-red-300">
                    <p className="font-medium mb-1">Duplicate product detected!</p>
                    {duplicateWarning.nameMatch && (
                      <p className="text-red-200">A product with name "{duplicateWarning.nameMatch.name}" already exists.</p>
                    )}
                    {duplicateWarning.skuMatch && (
                      <p className="text-red-200">SKU "{duplicateWarning.skuMatch.sku}" is already used by "{duplicateWarning.skuMatch.name}".</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className={`w-full px-4 py-3 bg-slate-700 text-white rounded-lg border ${duplicateWarning?.nameMatch ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">SKU</label>
                <input
                  type="text"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                  className={`w-full px-4 py-3 bg-slate-700 text-white rounded-lg border ${duplicateWarning?.skuMatch ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Price (KES) *</label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Cost (KES)</label>
                  <input
                    type="number"
                    value={newProduct.cost}
                    onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Initial Stock</label>
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
                disabled={!newProduct.name || !newProduct.price || !!(duplicateWarning && (duplicateWarning.nameMatch || duplicateWarning.skuMatch))}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 flex-shrink-0 rounded-full bg-red-600/20 flex items-center justify-center">
                <Trash2 className="text-red-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Product</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Permanently delete <span className="text-white font-medium">"{confirmDeleteProduct.name}"</span>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteProduct(null)}
                className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProduct(confirmDeleteProduct)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Edit Product</h3>
              <button onClick={() => { setEditingProduct(null); setEditDuplicateWarning(null); }} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Duplicate Warning */}
            {editDuplicateWarning && (editDuplicateWarning.nameMatch || editDuplicateWarning.skuMatch) && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-red-400 mt-0.5 flex-shrink-0" size={18} />
                  <div className="text-sm text-red-300">
                    <p className="font-medium mb-1">Duplicate product detected!</p>
                    {editDuplicateWarning.nameMatch && (
                      <p className="text-red-200">A product with name "{editDuplicateWarning.nameMatch.name}" already exists.</p>
                    )}
                    {editDuplicateWarning.skuMatch && (
                      <p className="text-red-200">SKU "{editDuplicateWarning.skuMatch.sku}" is already used by "{editDuplicateWarning.skuMatch.name}".</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className={`w-full px-4 py-3 bg-slate-700 text-white rounded-lg border ${editDuplicateWarning?.nameMatch ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">SKU</label>
                <input
                  type="text"
                  value={editingProduct.sku || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  className={`w-full px-4 py-3 bg-slate-700 text-white rounded-lg border ${editDuplicateWarning?.skuMatch ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Price (KES) *</label>
                  <input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Cost (KES)</label>
                  <input
                    type="number"
                    value={editingProduct.cost}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Stock</label>
                  <input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Category</label>
                  <input
                    type="text"
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleUpdateProduct}
                disabled={!editingProduct.name || !!(editDuplicateWarning && (editDuplicateWarning.nameMatch || editDuplicateWarning.skuMatch))}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Update Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
