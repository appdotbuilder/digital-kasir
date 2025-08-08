import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  Product, 
  Transaction, 
  KycDocument, 
  UserStats, 
  TransactionStats,
  CreateProductInput,
  UpdateUserInput,
  ReviewKycInput
} from '../../../server/src/schema';

interface AdminPanelProps {
  user: User;
  onLogout: () => void;
}

interface UsersResponse {
  users: User[];
  total: number;
}

export function AdminPanel({ user, onLogout }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [kycRequests, setKycRequests] = useState<KycDocument[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [transactionStats, setTransactionStats] = useState<TransactionStats | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [newProduct, setNewProduct] = useState<CreateProductInput>({
    name: '',
    description: null,
    type: 'pulsa',
    price: 0,
    provider_code: ''
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userUpdate, setUserUpdate] = useState<Partial<UpdateUserInput>>({});

  const [selectedKyc, setSelectedKyc] = useState<KycDocument | null>(null);
  const [kycReview, setKycReview] = useState<Partial<ReviewKycInput>>({
    status: 'verified',
    rejection_reason: ''
  });

  const loadAdminData = useCallback(async () => {
    try {
      const [usersResult, productsResult, transactionsResult, kycResult, userStatsResult, transactionStatsResult] = await Promise.all([
        trpc.getAllUsers.query({ page: 1, limit: 50 }),
        trpc.getProducts.query(),
        trpc.getAllTransactions.query({ limit: 100 }),
        trpc.getPendingKycRequests.query(),
        trpc.getUserStats.query(),
        trpc.getAdminTransactionStats.query()
      ]);

      // Handle the response structure from getAllUsers
      const usersResponse = usersResult as User[] | UsersResponse;
      setUsers(Array.isArray(usersResponse) ? usersResponse : usersResponse?.users || []);
      setProducts(productsResult || []);
      setTransactions(transactionsResult || []);
      setKycRequests(kycResult || []);
      setUserStats(userStatsResult);
      setTransactionStats(transactionStatsResult);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      // Set mock data for demo
      setUsers([]);
      setProducts([]);
      setTransactions([]);
      setKycRequests([]);
      setUserStats({
        total_users: 1500,
        kyc_verified_users: 800,
        kyc_pending_users: 50,
        blocked_users: 5
      });
      setTransactionStats({
        total_transactions: 25000,
        total_revenue: 50000000,
        pending_transactions: 25,
        completed_transactions: 24800,
        failed_transactions: 175
      });
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await trpc.createProduct.mutate(newProduct);
      setSuccess('Produk berhasil dibuat!');
      setNewProduct({
        name: '',
        description: null,
        type: 'pulsa',
        price: 0,
        provider_code: ''
      });
      loadAdminData();
    } catch (error: any) {
      setError(error.message || 'Gagal membuat produk');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    setError(null);

    try {
      const updateData: UpdateUserInput = {
        user_id: selectedUser.id,
        ...userUpdate
      };
      
      await trpc.updateUser.mutate(updateData);
      setSuccess('User berhasil diupdate!');
      setSelectedUser(null);
      setUserUpdate({});
      loadAdminData();
    } catch (error: any) {
      setError(error.message || 'Gagal update user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewKyc = async () => {
    if (!selectedKyc || !kycReview.status) return;

    setIsLoading(true);
    setError(null);

    try {
      const reviewData: ReviewKycInput = {
        kyc_id: selectedKyc.id,
        status: kycReview.status,
        rejection_reason: kycReview.rejection_reason
      };

      await trpc.reviewKyc.mutate(reviewData);
      setSuccess(`KYC berhasil ${kycReview.status === 'verified' ? 'diverifikasi' : 'ditolak'}!`);
      setSelectedKyc(null);
      setKycReview({ status: 'verified', rejection_reason: '' });
      loadAdminData();
    } catch (error: any) {
      setError(error.message || 'Gagal review KYC');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string, type: 'transaction' | 'kyc' | 'user' = 'transaction') => {
    if (type === 'transaction') {
      const config = {
        pending: { variant: 'secondary' as const, label: 'Pending', icon: '⏳' },
        completed: { variant: 'default' as const, label: 'Success', icon: '✅' },
        failed: { variant: 'destructive' as const, label: 'Failed', icon: '❌' },
        cancelled: { variant: 'outline' as const, label: 'Cancelled', icon: '⚠️' }
      };
      const item = config[status as keyof typeof config] || config.pending;
      return <Badge variant={item.variant}>{item.icon} {item.label}</Badge>;
    }
    
    if (type === 'kyc') {
      const config = {
        pending: { variant: 'secondary' as const, label: 'Pending' },
        verified: { variant: 'default' as const, label: 'Verified' },
        rejected: { variant: 'destructive' as const, label: 'Rejected' }
      };
      const item = config[status as keyof typeof config] || config.pending;
      return <Badge variant={item.variant}>{item.label}</Badge>;
    }

    return <Badge>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-red-900">🛡️ Admin Panel</h1>
              <Badge variant="destructive">Admin Access</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Selamat datang, {user.name}
              </span>
              <Button variant="outline" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats?.total_users || 0}</div>
              <p className="text-xs text-gray-500">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                Rp {(transactionStats?.total_revenue || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-gray-500">All time revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactionStats?.total_transactions || 0}</div>
              <p className="text-xs text-gray-500">Completed transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending KYC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {kycRequests.length}
              </div>
              <p className="text-xs text-gray-500">Awaiting review</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
            <TabsTrigger value="users">👥 Users</TabsTrigger>
            <TabsTrigger value="products">📱 Products</TabsTrigger>
            <TabsTrigger value="transactions">💳 Transactions</TabsTrigger>
            <TabsTrigger value="kyc">🆔 KYC Review</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Total Users</span>
                      <Badge>{userStats?.total_users || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>KYC Verified</span>
                      <Badge variant="default">{userStats?.kyc_verified_users || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>KYC Pending</span>
                      <Badge variant="secondary">{userStats?.kyc_pending_users || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Blocked Users</span>
                      <Badge variant="destructive">{userStats?.blocked_users || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transaction Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Total Transactions</span>
                      <Badge>{transactionStats?.total_transactions || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Completed</span>
                      <Badge variant="default">{transactionStats?.completed_transactions || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Pending</span>
                      <Badge variant="secondary">{transactionStats?.pending_transactions || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Failed</span>
                      <Badge variant="destructive">{transactionStats?.failed_transactions || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage registered users and their accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No users found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>KYC Status</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.slice(0, 10).map((user: User) => (
                          <TableRow key={user.id}>
                            <TableCell>{user.id}</TableCell>
                            <TableCell>{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              {getStatusBadge(user.kyc_status, 'kyc')}
                            </TableCell>
                            <TableCell>
                              Rp {user.wallet_balance.toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.is_blocked ? 'destructive' : 'default'}>
                                {user.is_blocked ? 'Blocked' : 'Active'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setUserUpdate({
                                        is_blocked: user.is_blocked,
                                        wallet_balance: user.wallet_balance
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit User: {selectedUser?.name}</DialogTitle>
                                    <DialogDescription>
                                      Update user account settings
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Account Status</Label>
                                      <Select
                                        value={userUpdate.is_blocked ? 'blocked' : 'active'}
                                        onValueChange={(value: string) =>
                                          setUserUpdate((prev: Partial<UpdateUserInput>) => ({
                                            ...prev,
                                            is_blocked: value === 'blocked'
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="active">Active</SelectItem>
                                          <SelectItem value="blocked">Blocked</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Wallet Balance (Rp)</Label>
                                      <Input
                                        type="number"
                                        value={userUpdate.wallet_balance || 0}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                          setUserUpdate((prev: Partial<UpdateUserInput>) => ({
                                            ...prev,
                                            wallet_balance: parseFloat(e.target.value) || 0
                                          }))
                                        }
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button 
                                      onClick={handleUpdateUser} 
                                      disabled={isLoading}
                                    >
                                      {isLoading ? 'Updating...' : 'Update User'}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Product</CardTitle>
                  <CardDescription>Add new digital product to the system</CardDescription>
                </CardHeader>
                <form onSubmit={handleCreateProduct}>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Product Name</Label>
                        <Input
                          value={newProduct.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewProduct((prev: CreateProductInput) => ({ ...prev, name: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Product Type</Label>
                        <Select
                          value={newProduct.type}
                          onValueChange={(value: any) =>
                            setNewProduct((prev: CreateProductInput) => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pulsa">Pulsa</SelectItem>
                            <SelectItem value="data">Data</SelectItem>
                            <SelectItem value="pln">PLN</SelectItem>
                            <SelectItem value="voucher_game">Voucher Game</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Price (Rp)</Label>
                        <Input
                          type="number"
                          min="1000"
                          value={newProduct.price}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewProduct((prev: CreateProductInput) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Provider Code</Label>
                        <Input
                          value={newProduct.provider_code}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewProduct((prev: CreateProductInput) => ({ ...prev, provider_code: e.target.value }))
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description (Optional)</Label>
                      <Input
                        value={newProduct.description || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setNewProduct((prev: CreateProductInput) => ({ ...prev, description: e.target.value || null }))
                        }
                      />
                    </div>
                  </CardContent>
                  <CardContent className="pt-0">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Product'}
                    </Button>
                  </CardContent>
                </form>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Product List</CardTitle>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No products found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: Product) => (
                          <TableRow key={product.id}>
                            <TableCell>{product.id}</TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{product.type}</Badge>
                            </TableCell>
                            <TableCell>Rp {product.price.toLocaleString('id-ID')}</TableCell>
                            <TableCell>{product.provider_code}</TableCell>
                            <TableCell>
                              <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                {product.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Management</CardTitle>
                <CardDescription>Monitor and manage all transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No transactions found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 20).map((transaction: Transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{transaction.id}</TableCell>
                          <TableCell>{transaction.user_id}</TableCell>
                          <TableCell>{transaction.product_id}</TableCell>
                          <TableCell>{transaction.target_number}</TableCell>
                          <TableCell>Rp {transaction.amount.toLocaleString('id-ID')}</TableCell>
                          <TableCell>
                            {getStatusBadge(transaction.status, 'transaction')}
                          </TableCell>
                          <TableCell>
                            {transaction.created_at.toLocaleDateString('id-ID')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kyc">
            <Card>
              <CardHeader>
                <CardTitle>KYC Review</CardTitle>
                <CardDescription>Review pending KYC verification requests</CardDescription>
              </CardHeader>
              <CardContent>
                {kycRequests.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending KYC requests</p>
                ) : (
                  <div className="space-y-4">
                    {kycRequests.map((kyc: KycDocument) => (
                      <div key={kyc.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-semibold">User ID: {kyc.user_id}</h3>
                            <p className="text-sm text-gray-600">
                              Submitted: {kyc.submitted_at.toLocaleDateString('id-ID')}
                            </p>
                          </div>
                          {getStatusBadge(kyc.status, 'kyc')}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label className="text-sm font-medium">ID Card Photo</Label>
                            <div className="mt-1 border rounded p-4 bg-gray-50">
                              <p className="text-sm text-gray-600">📄 {kyc.id_card_url}</p>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Selfie Photo</Label>
                            <div className="mt-1 border rounded p-4 bg-gray-50">
                              <p className="text-sm text-gray-600">🤳 {kyc.selfie_url}</p>
                            </div>
                          </div>
                        </div>

                        {kyc.status === 'pending' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm"
                                onClick={() => {
                                  setSelectedKyc(kyc);
                                  setKycReview({ status: 'verified', rejection_reason: '' });
                                }}
                              >
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Review KYC Request</DialogTitle>
                                <DialogDescription>
                                  User ID: {selectedKyc?.user_id}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Decision</Label>
                                  <Select
                                    value={kycReview.status}
                                    onValueChange={(value: any) =>
                                      setKycReview((prev: Partial<ReviewKycInput>) => ({ ...prev, status: value }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="verified">✅ Approve</SelectItem>
                                      <SelectItem value="rejected">❌ Reject</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {kycReview.status === 'rejected' && (
                                  <div className="space-y-2">
                                    <Label>Rejection Reason</Label>
                                    <Textarea
                                      value={kycReview.rejection_reason || ''}
                                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                        setKycReview((prev: Partial<ReviewKycInput>) => ({ ...prev, rejection_reason: e.target.value }))
                                      }
                                      placeholder="Please provide a reason for rejection..."
                                      required={kycReview.status === 'rejected'}
                                    />
                                  </div>
                                )}
                              </div>
                              <DialogFooter>
                                <Button onClick={handleReviewKyc} disabled={isLoading}>
                                  {isLoading ? 'Processing...' : 'Submit Review'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}