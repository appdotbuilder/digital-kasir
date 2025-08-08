import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import type { User } from '../../server/src/schema';

// Import components
import { AuthComponent } from '@/components/AuthComponent';
import { KycComponent } from '@/components/KycComponent';
import { WalletComponent } from '@/components/WalletComponent';
import { TransactionComponent } from '@/components/TransactionComponent';
import { ReferralComponent } from '@/components/ReferralComponent';
import { AdminPanel } from '@/components/AdminPanel';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('products');

  // Mock current user - in real app this would come from auth context
  const loadUserData = useCallback(async () => {
    setIsLoading(true);
    try {
      // For demo purposes, we'll simulate a logged-in user
      // In production, this would check authentication token and fetch user data
      const mockUser: User = {
        id: 1,
        name: 'Demo User',
        email: 'demo@example.com',
        phone: '081234567890',
        password_hash: 'hashed_password',
        role: 'user',
        kyc_status: 'not_submitted',
        wallet_balance: 100000,
        coins: 50,
        referral_code: 'DEMO123',
        referred_by: null,
        is_blocked: false,
        created_at: new Date(),
        updated_at: new Date()
      };
      setUser(mockUser);
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleLogout = () => {
    setUser(null);
    setActiveTab('products');
  };

  // If not logged in, show auth component
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-indigo-900 mb-2">💳 PulsaKu</h1>
            <p className="text-indigo-600">Platform Pulsa & Produk Digital Terpercaya</p>
          </div>
          <AuthComponent onLogin={setUser} />
        </div>
      </div>
    );
  }

  // Admin panel for admin users
  if (user.role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminPanel user={user} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-indigo-900">💳 PulsaKu</h1>
              <Badge variant={user.kyc_status === 'verified' ? 'default' : 'secondary'}>
                KYC: {user.kyc_status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Saldo</p>
                <p className="font-semibold text-indigo-900">
                  Rp {user.wallet_balance.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Koin</p>
                <p className="font-semibold text-yellow-600">🪙 {user.coins}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Keluar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Welcome Card */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                👋 Selamat datang, {user.name}!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                {user.kyc_status === 'verified' 
                  ? 'Akun Anda sudah terverifikasi. Nikmati semua fitur PulsaKu!'
                  : 'Lengkapi verifikasi KYC untuk mengakses fitur transfer dan penarikan saldo.'
                }
              </p>
            </CardContent>
          </Card>

          {/* Navigation Tabs */}
          <div className="lg:col-span-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="products">📱 Produk</TabsTrigger>
                <TabsTrigger value="wallet">💰 Dompet</TabsTrigger>
                <TabsTrigger value="transactions">📋 Transaksi</TabsTrigger>
                <TabsTrigger value="kyc">🆔 KYC</TabsTrigger>
                <TabsTrigger value="referral">🎁 Referral</TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="products">
                  <TransactionComponent user={user} />
                </TabsContent>

                <TabsContent value="wallet">
                  <WalletComponent user={user} />
                </TabsContent>

                <TabsContent value="transactions">
                  <TransactionComponent user={user} showHistoryOnly />
                </TabsContent>

                <TabsContent value="kyc">
                  <KycComponent user={user} />
                </TabsContent>

                <TabsContent value="referral">
                  <ReferralComponent user={user} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;