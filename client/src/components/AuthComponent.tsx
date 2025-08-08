import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { User, RegisterInput, LoginInput, ResetPasswordInput } from '../../../server/src/schema';

interface AuthComponentProps {
  onLogin: (user: User) => void;
}

export function AuthComponent({ onLogin }: AuthComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Register form state
  const [registerData, setRegisterData] = useState<RegisterInput>({
    name: '',
    email: '',
    phone: '',
    password: '',
    referral_code: ''
  });

  // Login form state
  const [loginData, setLoginData] = useState<LoginInput>({
    email: '',
    password: ''
  });

  // Reset password form state
  const [resetData, setResetData] = useState<ResetPasswordInput>({
    email: ''
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await trpc.register.mutate(registerData);
      setSuccess('Akun berhasil dibuat! Silakan login.');
      // Reset form
      setRegisterData({
        name: '',
        email: '',
        phone: '',
        password: '',
        referral_code: ''
      });
    } catch (error: any) {
      setError(error.message || 'Gagal membuat akun');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.login.mutate(loginData);
      onLogin(response.user);
    } catch (error: any) {
      setError(error.message || 'Email atau password salah');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await trpc.resetPassword.mutate(resetData);
      setSuccess('Link reset password telah dikirim ke email Anda.');
      setResetData({ email: '' });
    } catch (error: any) {
      setError(error.message || 'Gagal mengirim link reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // For demo purposes - simulate successful login
    const demoUser: User = {
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
    onLogin(demoUser);
  };

  const handleAdminDemoLogin = () => {
    // For demo purposes - simulate admin login
    const adminUser: User = {
      id: 999,
      name: 'Admin Demo',
      email: 'admin@example.com',
      phone: '081999999999',
      password_hash: 'hashed_password',
      role: 'admin',
      kyc_status: 'verified',
      wallet_balance: 0,
      coins: 0,
      referral_code: 'ADMIN999',
      referred_by: null,
      is_blocked: false,
      created_at: new Date(),
      updated_at: new Date()
    };
    onLogin(adminUser);
  };

  return (
    <div className="max-w-md mx-auto">
      <Tabs defaultValue="login" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="login">Masuk</TabsTrigger>
          <TabsTrigger value="register">Daftar</TabsTrigger>
          <TabsTrigger value="reset">Reset</TabsTrigger>
        </TabsList>

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

        {/* Demo buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🚀 Demo Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              onClick={handleDemoLogin}
              className="w-full"
              variant="outline"
            >
              Login sebagai User Demo
            </Button>
            <Button 
              onClick={handleAdminDemoLogin}
              className="w-full"
              variant="outline"
            >
              Login sebagai Admin Demo
            </Button>
          </CardContent>
        </Card>

        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Masuk ke Akun</CardTitle>
              <CardDescription>
                Masukkan email dan password Anda
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="nama@email.com"
                    value={loginData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData((prev: LoginInput) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                    }
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Memproses...' : 'Masuk'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Akun Baru</CardTitle>
              <CardDescription>
                Buat akun untuk mulai bertransaksi
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nama Lengkap</Label>
                  <Input
                    id="register-name"
                    placeholder="John Doe"
                    value={registerData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: RegisterInput) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="nama@email.com"
                    value={registerData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: RegisterInput) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-phone">No. HP (Opsional)</Label>
                  <Input
                    id="register-phone"
                    placeholder="081234567890"
                    value={registerData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: RegisterInput) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={registerData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: RegisterInput) => ({ ...prev, password: e.target.value }))
                    }
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-referral">Kode Referral (Opsional)</Label>
                  <Input
                    id="register-referral"
                    placeholder="Masukkan kode referral"
                    value={registerData.referral_code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: RegisterInput) => ({ ...prev, referral_code: e.target.value }))
                    }
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Mendaftar...' : 'Daftar Sekarang'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="reset">
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Masukkan email untuk reset password
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleResetPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="nama@email.com"
                    value={resetData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setResetData((prev: ResetPasswordInput) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Mengirim...' : 'Kirim Link Reset'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}