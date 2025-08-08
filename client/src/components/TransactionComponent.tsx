import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/utils/trpc';
import type { User, Product, Transaction, CreateTransactionInput } from '../../../server/src/schema';

interface TransactionComponentProps {
  user: User;
  showHistoryOnly?: boolean;
}

export function TransactionComponent({ user, showHistoryOnly = false }: TransactionComponentProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetNumber, setTargetNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const result = await trpc.getProducts.query();
      setProducts(result);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const result = await trpc.getUserTransactions.query({ limit: 20 });
      setTransactions(result);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, []);

  useEffect(() => {
    if (!showHistoryOnly) {
      loadProducts();
    }
    loadTransactions();
  }, [loadProducts, loadTransactions, showHistoryOnly]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setError(null);
    setSuccess(null);
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !targetNumber) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if user has sufficient balance
      if (user.wallet_balance < selectedProduct.price) {
        throw new Error('Saldo tidak mencukupi. Silakan top up terlebih dahulu.');
      }

      const transactionData: CreateTransactionInput = {
        product_id: selectedProduct.id,
        target_number: targetNumber
      };

      const response = await trpc.createTransaction.mutate(transactionData);
      setSuccess(`Transaksi ${selectedProduct.name} berhasil! ID: ${response.id}`);
      
      // Reset form
      setSelectedProduct(null);
      setTargetNumber('');
      
      // Reload transactions
      loadTransactions();
      
    } catch (error: any) {
      setError(error.message || 'Gagal melakukan transaksi');
    } finally {
      setIsLoading(false);
    }
  };

  const getProductsByType = (type: string) => {
    return products.filter((product: Product) => product.type === type && product.is_active);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Proses', icon: '⏳' },
      completed: { variant: 'default' as const, label: 'Berhasil', icon: '✅' },
      failed: { variant: 'destructive' as const, label: 'Gagal', icon: '❌' },
      cancelled: { variant: 'outline' as const, label: 'Dibatalkan', icon: '⚠️' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant}>
        {config.icon} {config.label}
      </Badge>
    );
  };

  const getProductIcon = (type: string) => {
    const icons = {
      pulsa: '📱',
      data: '📊',
      pln: '⚡',
      voucher_game: '🎮'
    };
    return icons[type as keyof typeof icons] || '📱';
  };

  if (showHistoryOnly) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📋 Riwayat Transaksi
            </CardTitle>
            <CardDescription>
              Lihat semua transaksi Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Belum ada transaksi. Mulai beli produk digital sekarang!
              </p>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction: Transaction) => {
                  const product = products.find((p: Product) => p.id === transaction.product_id);
                  return (
                    <div key={transaction.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {product ? getProductIcon(product.type) : '📱'}
                          </span>
                          <div>
                            <h3 className="font-semibold">
                              {product?.name || 'Produk Tidak Ditemukan'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {transaction.target_number}
                            </p>
                            <p className="text-xs text-gray-400">
                              {transaction.created_at.toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="mb-2">
                            {getStatusBadge(transaction.status)}
                          </div>
                          <p className="font-semibold">
                            Rp {transaction.amount.toLocaleString('id-ID')}
                          </p>
                          <p className="text-xs text-yellow-600">
                            🪙 +{transaction.coins_earned} koin
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pulsa" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pulsa">📱 Pulsa</TabsTrigger>
          <TabsTrigger value="data">📊 Data</TabsTrigger>
          <TabsTrigger value="pln">⚡ PLN</TabsTrigger>
          <TabsTrigger value="voucher_game">🎮 Game</TabsTrigger>
        </TabsList>

        <TabsContent value="pulsa">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pulsa & Kredit</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getProductsByType('pulsa').map((product: Product) => (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-all ${
                    selectedProduct?.id === product.id 
                      ? 'ring-2 ring-indigo-500 bg-indigo-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl mb-2">📱</div>
                      <h4 className="font-semibold">{product.name}</h4>
                      <p className="text-lg font-bold text-indigo-600">
                        Rp {product.price.toLocaleString('id-ID')}
                      </p>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Paket Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getProductsByType('data').map((product: Product) => (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-all ${
                    selectedProduct?.id === product.id 
                      ? 'ring-2 ring-indigo-500 bg-indigo-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl mb-2">📊</div>
                      <h4 className="font-semibold">{product.name}</h4>
                      <p className="text-lg font-bold text-indigo-600">
                        Rp {product.price.toLocaleString('id-ID')}
                      </p>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pln">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Token PLN</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getProductsByType('pln').map((product: Product) => (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-all ${
                    selectedProduct?.id === product.id 
                      ? 'ring-2 ring-indigo-500 bg-indigo-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl mb-2">⚡</div>
                      <h4 className="font-semibold">{product.name}</h4>
                      <p className="text-lg font-bold text-indigo-600">
                        Rp {product.price.toLocaleString('id-ID')}
                      </p>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="voucher_game">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Voucher Game</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getProductsByType('voucher_game').map((product: Product) => (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-all ${
                    selectedProduct?.id === product.id 
                      ? 'ring-2 ring-indigo-500 bg-indigo-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl mb-2">🎮</div>
                      <h4 className="font-semibold">{product.name}</h4>
                      <p className="text-lg font-bold text-indigo-600">
                        Rp {product.price.toLocaleString('id-ID')}
                      </p>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Transaction Form */}
      {selectedProduct && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getProductIcon(selectedProduct.type)} Konfirmasi Pembelian
            </CardTitle>
            <CardDescription>
              {selectedProduct.name} - Rp {selectedProduct.price.toLocaleString('id-ID')}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleTransaction}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target-number">
                  {selectedProduct.type === 'pln' ? 'Nomor Meter PLN' : 'Nomor HP/ID'}
                </Label>
                <Input
                  id="target-number"
                  placeholder={selectedProduct.type === 'pln' ? '123456789012' : '081234567890'}
                  value={targetNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetNumber(e.target.value)}
                  required
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Detail Transaksi:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Produk:</span>
                    <span>{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Harga:</span>
                    <span>Rp {selectedProduct.price.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo Anda:</span>
                    <span>Rp {user.wallet_balance.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Saldo Setelah Transaksi:</span>
                    <span className={user.wallet_balance >= selectedProduct.price ? 'text-green-600' : 'text-red-600'}>
                      Rp {Math.max(0, user.wallet_balance - selectedProduct.price).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || user.wallet_balance < selectedProduct.price}
                  className="flex-1"
                >
                  {isLoading ? 'Memproses...' : 'Beli Sekarang'}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Transaksi Terakhir
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.slice(0, 5).length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              Belum ada transaksi
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction: Transaction) => {
                const product = products.find((p: Product) => p.id === transaction.product_id);
                return (
                  <div key={transaction.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {product ? getProductIcon(product.type) : '📱'}
                      </span>
                      <div>
                        <p className="font-semibold text-sm">
                          {product?.name || 'Produk Tidak Ditemukan'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {transaction.target_number}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(transaction.status)}
                      <p className="text-sm font-semibold">
                        Rp {transaction.amount.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}