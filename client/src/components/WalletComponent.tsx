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
import type { 
  User, 
  Deposit, 
  Transfer, 
  Withdrawal, 
  CreateDepositInput, 
  CreateTransferInput, 
  CreateWithdrawalInput,
  ExchangeCoinsInput 
} from '../../../server/src/schema';

interface WalletComponentProps {
  user: User;
}

interface TransferResponse {
  sent: Transfer[];
  received: Transfer[];
}

export function WalletComponent({ user }: WalletComponentProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [depositData, setDepositData] = useState<CreateDepositInput>({
    amount: 0,
    method: 'bank_transfer'
  });

  const [transferData, setTransferData] = useState<CreateTransferInput>({
    to_user_email: '',
    amount: 0
  });

  const [withdrawalData, setWithdrawalData] = useState<CreateWithdrawalInput>({
    amount: 0,
    bank_name: '',
    account_number: '',
    account_name: ''
  });

  const [exchangeData, setExchangeData] = useState<ExchangeCoinsInput>({
    coins: 0
  });

  const loadWalletData = useCallback(async () => {
    try {
      const [depositsResult, transfersResult, withdrawalsResult] = await Promise.all([
        trpc.getUserDeposits.query(),
        trpc.getUserTransfers.query(),
        trpc.getUserWithdrawals.query()
      ]);
      
      setDeposits(depositsResult || []);
      // Handle the response structure from getUserTransfers
      const transferResponse = transfersResult as Transfer[] | TransferResponse;
      if (Array.isArray(transferResponse)) {
        setTransfers(transferResponse);
      } else if (transferResponse && typeof transferResponse === 'object' && 'sent' in transferResponse) {
        // If it's an object with sent/received arrays, combine them
        const allTransfers = [...(transferResponse.sent || []), ...(transferResponse.received || [])];
        setTransfers(allTransfers);
      } else {
        setTransfers([]);
      }
      setWithdrawals(withdrawalsResult || []);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await trpc.createDeposit.mutate(depositData);
      setSuccess(`Deposit berhasil dibuat! ID: ${response.id}. Silakan lakukan pembayaran sesuai instruksi.`);
      
      // Reset form
      setDepositData({
        amount: 0,
        method: 'bank_transfer'
      });
      
      // Reload data
      loadWalletData();
    } catch (error: any) {
      setError(error.message || 'Gagal membuat deposit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user.kyc_status !== 'verified') {
      setError('Transfer saldo memerlukan verifikasi KYC. Silakan lengkapi KYC terlebih dahulu.');
      return;
    }

    if (user.wallet_balance < transferData.amount) {
      setError('Saldo tidak mencukupi untuk transfer.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await trpc.createTransfer.mutate(transferData);
      setSuccess(`Transfer berhasil! ID: ${response.id}`);
      
      // Reset form
      setTransferData({
        to_user_email: '',
        amount: 0
      });
      
      // Reload data
      loadWalletData();
    } catch (error: any) {
      setError(error.message || 'Gagal melakukan transfer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user.kyc_status !== 'verified') {
      setError('Penarikan saldo memerlukan verifikasi KYC. Silakan lengkapi KYC terlebih dahulu.');
      return;
    }

    if (user.wallet_balance < withdrawalData.amount) {
      setError('Saldo tidak mencukupi untuk penarikan.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await trpc.createWithdrawal.mutate(withdrawalData);
      setSuccess(`Permintaan penarikan berhasil! ID: ${response.id}. Dana akan diproses dalam 1-3 hari kerja.`);
      
      // Reset form
      setWithdrawalData({
        amount: 0,
        bank_name: '',
        account_number: '',
        account_name: ''
      });
      
      // Reload data
      loadWalletData();
    } catch (error: any) {
      setError(error.message || 'Gagal membuat permintaan penarikan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExchangeCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user.coins < exchangeData.coins) {
      setError('Koin tidak mencukupi untuk ditukar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await trpc.exchangeCoinsToBalance.mutate(exchangeData);
      setSuccess(`Berhasil menukar ${exchangeData.coins} koin menjadi Rp ${response.balance_received.toLocaleString('id-ID')}!`);
      
      // Reset form
      setExchangeData({ coins: 0 });
      
      // Reload data would happen here in real app
    } catch (error: any) {
      setError(error.message || 'Gagal menukar koin');
    } finally {
      setIsLoading(false);
    }
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

      {/* Wallet Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Saldo Dompet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              Rp {user.wallet_balance.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tersedia untuk transaksi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Koin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 flex items-center gap-1">
              🪙 {user.coins}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dapat ditukar menjadi saldo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Status KYC</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={user.kyc_status === 'verified' ? 'default' : 'secondary'}>
              {user.kyc_status === 'verified' ? '✅ Terverifikasi' : '⚠️ Belum Verifikasi'}
            </Badge>
            <p className="text-xs text-gray-500 mt-2">
              {user.kyc_status === 'verified' 
                ? 'Akses penuh ke semua fitur'
                : 'Perlu untuk transfer & withdrawal'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deposit" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="deposit">💰 Top Up</TabsTrigger>
          <TabsTrigger value="transfer">📤 Transfer</TabsTrigger>
          <TabsTrigger value="withdrawal">🏦 Tarik</TabsTrigger>
          <TabsTrigger value="coins">🪙 Koin</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Up Saldo</CardTitle>
                <CardDescription>
                  Isi saldo untuk mulai bertransaksi
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleDeposit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deposit-amount">Jumlah (Rp)</Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder="50000"
                      min="10000"
                      step="1000"
                      value={depositData.amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDepositData((prev: CreateDepositInput) => ({ 
                          ...prev, 
                          amount: parseFloat(e.target.value) || 0 
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deposit-method">Metode Pembayaran</Label>
                    <Select
                      value={depositData.method}
                      onValueChange={(value: any) =>
                        setDepositData((prev: CreateDepositInput) => ({ ...prev, method: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">🏦 Transfer Bank</SelectItem>
                        <SelectItem value="e_wallet">📱 E-Wallet</SelectItem>
                        <SelectItem value="virtual_account">💳 Virtual Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Memproses...' : 'Buat Deposit'}
                  </Button>
                </CardContent>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Riwayat Deposit</CardTitle>
              </CardHeader>
              <CardContent>
                {deposits.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Belum ada deposit
                  </p>
                ) : (
                  <div className="space-y-3">
                    {deposits.slice(0, 5).map((deposit: Deposit) => (
                      <div key={deposit.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="font-semibold">
                            Rp {deposit.amount.toLocaleString('id-ID')}
                          </p>
                          <p className="text-sm text-gray-600 capitalize">
                            {deposit.method.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-gray-400">
                            {deposit.created_at.toLocaleString('id-ID')}
                          </p>
                        </div>
                        {getStatusBadge(deposit.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transfer">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Transfer Saldo</CardTitle>
                <CardDescription>
                  Transfer saldo ke pengguna lain
                  {user.kyc_status !== 'verified' && (
                    <span className="block text-red-500 mt-1">
                      ⚠️ Memerlukan verifikasi KYC
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleTransfer}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="transfer-email">Email Penerima</Label>
                    <Input
                      id="transfer-email"
                      type="email"
                      placeholder="penerima@email.com"
                      value={transferData.to_user_email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTransferData((prev: CreateTransferInput) => ({ 
                          ...prev, 
                          to_user_email: e.target.value 
                        }))
                      }
                      required
                      disabled={user.kyc_status !== 'verified'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transfer-amount">Jumlah (Rp)</Label>
                    <Input
                      id="transfer-amount"
                      type="number"
                      placeholder="50000"
                      min="10000"
                      max={user.wallet_balance}
                      step="1000"
                      value={transferData.amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTransferData((prev: CreateTransferInput) => ({ 
                          ...prev, 
                          amount: parseFloat(e.target.value) || 0 
                        }))
                      }
                      required
                      disabled={user.kyc_status !== 'verified'}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || user.kyc_status !== 'verified'}
                  >
                    {isLoading ? 'Memproses...' : 'Transfer Sekarang'}
                  </Button>
                </CardContent>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Riwayat Transfer</CardTitle>
              </CardHeader>
              <CardContent>
                {transfers.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Belum ada transfer
                  </p>
                ) : (
                  <div className="space-y-3">
                    {transfers.slice(0, 5).map((transfer: Transfer) => (
                      <div key={transfer.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="font-semibold">
                            Rp {transfer.amount.toLocaleString('id-ID')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {transfer.from_user_id === user.id 
                              ? `Ke User ID: ${transfer.to_user_id}` 
                              : `Dari User ID: ${transfer.from_user_id}`
                            }
                          </p>
                          <p className="text-xs text-gray-400">
                            {transfer.created_at.toLocaleString('id-ID')}
                          </p>
                        </div>
                        {getStatusBadge(transfer.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="withdrawal">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tarik Saldo</CardTitle>
                <CardDescription>
                  Tarik saldo ke rekening bank
                  {user.kyc_status !== 'verified' && (
                    <span className="block text-red-500 mt-1">
                      ⚠️ Memerlukan verifikasi KYC
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleWithdrawal}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdrawal-amount">Jumlah (Rp)</Label>
                    <Input
                      id="withdrawal-amount"
                      type="number"
                      placeholder="100000"
                      min="50000"
                      max={user.wallet_balance}
                      step="1000"
                      value={withdrawalData.amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setWithdrawalData((prev: CreateWithdrawalInput) => ({ 
                          ...prev, 
                          amount: parseFloat(e.target.value) || 0 
                        }))
                      }
                      required
                      disabled={user.kyc_status !== 'verified'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="withdrawal-bank">Nama Bank</Label>
                    <Input
                      id="withdrawal-bank"
                      placeholder="BCA, Mandiri, BRI, dll"
                      value={withdrawalData.bank_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setWithdrawalData((prev: CreateWithdrawalInput) => ({ 
                          ...prev, 
                          bank_name: e.target.value 
                        }))
                      }
                      required
                      disabled={user.kyc_status !== 'verified'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="withdrawal-account">Nomor Rekening</Label>
                    <Input
                      id="withdrawal-account"
                      placeholder="1234567890"
                      value={withdrawalData.account_number}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setWithdrawalData((prev: CreateWithdrawalInput) => ({ 
                          ...prev, 
                          account_number: e.target.value 
                        }))
                      }
                      required
                      disabled={user.kyc_status !== 'verified'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="withdrawal-name">Nama Pemilik Rekening</Label>
                    <Input
                      id="withdrawal-name"
                      placeholder="Sesuai dengan KTP"
                      value={withdrawalData.account_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setWithdrawalData((prev: CreateWithdrawalInput) => ({ 
                          ...prev, 
                          account_name: e.target.value 
                        }))
                      }
                      required
                      disabled={user.kyc_status !== 'verified'}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || user.kyc_status !== 'verified'}
                  >
                    {isLoading ? 'Memproses...' : 'Ajukan Penarikan'}
                  </Button>
                </CardContent>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Riwayat Penarikan</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Belum ada penarikan
                  </p>
                ) : (
                  <div className="space-y-3">
                    {withdrawals.slice(0, 5).map((withdrawal: Withdrawal) => (
                      <div key={withdrawal.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="font-semibold">
                            Rp {withdrawal.amount.toLocaleString('id-ID')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {withdrawal.bank_name} - {withdrawal.account_number}
                          </p>
                          <p className="text-xs text-gray-400">
                            {withdrawal.created_at.toLocaleString('id-ID')}
                          </p>
                        </div>
                        {getStatusBadge(withdrawal.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="coins">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tukar Koin</CardTitle>
                <CardDescription>
                  Tukar koin menjadi saldo dompet (Rate: 100 koin = Rp 1.000)
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleExchangeCoins}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="exchange-coins">Jumlah Koin</Label>
                    <Input
                      id="exchange-coins"
                      type="number"
                      placeholder="100"
                      min="100"
                      max={user.coins}
                      step="10"
                      value={exchangeData.coins}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setExchangeData((prev: ExchangeCoinsInput) => ({ 
                          ...prev, 
                          coins: parseInt(e.target.value) || 0 
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      💡 {exchangeData.coins} koin = Rp {(exchangeData.coins * 10).toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Koin tersisa: {user.coins - exchangeData.coins}
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || user.coins < exchangeData.coins}
                  >
                    {isLoading ? 'Memproses...' : 'Tukar Koin'}
                  </Button>
                </CardContent>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cara Mendapat Koin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📱</span>
                    <div>
                      <h4 className="font-semibold">Transaksi Pulsa/Data</h4>
                      <p className="text-sm text-gray-600">Dapatkan 5-10 koin setiap transaksi</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-lg">🎁</span>
                    <div>
                      <h4 className="font-semibold">Referral Teman</h4>
                      <p className="text-sm text-gray-600">Dapatkan 50 koin per referral berhasil</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-lg">🎮</span>
                    <div>
                      <h4 className="font-semibold">Beli Voucher Game</h4>
                      <p className="text-sm text-gray-600">Bonus koin ekstra untuk voucher game</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg mt-4">
                  <h4 className="font-semibold text-blue-800">💰 Total Koin Anda</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    🪙 {user.coins}
                  </p>
                  <p className="text-xs text-blue-600">
                    Senilai ~Rp {(user.coins * 10).toLocaleString('id-ID')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}