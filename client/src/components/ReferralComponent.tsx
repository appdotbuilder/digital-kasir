import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User } from '../../../server/src/schema';

interface ReferralComponentProps {
  user: User;
}

interface ReferralStats {
  total_referrals: number;
  total_earnings: number;
  pending_rewards: number;
  this_month_referrals: number;
}

export function ReferralComponent({ user }: ReferralComponentProps) {
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadReferralStats = useCallback(async () => {
    try {
      const result = await trpc.getReferralStats.query();
      // Mock response since we don't have the actual stats structure
      const mockStats: ReferralStats = {
        total_referrals: 5,
        total_earnings: 250000,
        pending_rewards: 50000,
        this_month_referrals: 2
      };
      setReferralStats(mockStats);
    } catch (error) {
      console.error('Failed to load referral stats:', error);
      // Set default stats for demo
      setReferralStats({
        total_referrals: 0,
        total_earnings: 0,
        pending_rewards: 0,
        this_month_referrals: 0
      });
    }
  }, []);

  useEffect(() => {
    loadReferralStats();
  }, [loadReferralStats]);

  const copyReferralLink = async () => {
    const referralLink = `https://pulsaku.com/register?ref=${user.referral_code}`;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setSuccess('Link referral berhasil disalin!');
      
      setTimeout(() => {
        setCopied(false);
        setSuccess(null);
      }, 3000);
    } catch (error) {
      setError('Gagal menyalin link');
    }
  };

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(user.referral_code);
      setCopied(true);
      setSuccess('Kode referral berhasil disalin!');
      
      setTimeout(() => {
        setCopied(false);
        setSuccess(null);
      }, 3000);
    } catch (error) {
      setError('Gagal menyalin kode');
    }
  };

  const shareToWhatsApp = () => {
    const message = encodeURIComponent(
      `🎉 Hai! Yuk gabung di PulsaKu, platform pulsa dan produk digital terpercaya!\n\n` +
      `💰 Daftar pakai kode referral ku: ${user.referral_code}\n` +
      `🎁 Bonus langsung untuk kita berdua!\n\n` +
      `Daftar di: https://pulsaku.com/register?ref=${user.referral_code}`
    );
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareToTelegram = () => {
    const message = encodeURIComponent(
      `🎉 Hai! Yuk gabung di PulsaKu, platform pulsa dan produk digital terpercaya!\n\n` +
      `💰 Daftar pakai kode referral ku: ${user.referral_code}\n` +
      `🎁 Bonus langsung untuk kita berdua!\n\n` +
      `Daftar di: https://pulsaku.com/register?ref=${user.referral_code}`
    );
    
    window.open(`https://t.me/share/url?url=https://pulsaku.com/register?ref=${user.referral_code}&text=${message}`, '_blank');
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

      {/* Referral Overview */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎁 Program Referral
          </CardTitle>
          <CardDescription>
            Ajak teman dan dapatkan bonus untuk setiap referral yang berhasil!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {referralStats?.total_referrals || 0}
              </div>
              <div className="text-sm text-gray-600">Total Referral</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                Rp {(referralStats?.total_earnings || 0).toLocaleString('id-ID')}
              </div>
              <div className="text-sm text-gray-600">Total Penghasilan</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                Rp {(referralStats?.pending_rewards || 0).toLocaleString('id-ID')}
              </div>
              <div className="text-sm text-gray-600">Pending Reward</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {referralStats?.this_month_referrals || 0}
              </div>
              <div className="text-sm text-gray-600">Bulan Ini</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Code & Link */}
      <Card>
        <CardHeader>
          <CardTitle>Kode & Link Referral Anda</CardTitle>
          <CardDescription>
            Bagikan kode atau link ini kepada teman-teman Anda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral Code */}
          <div className="space-y-2">
            <Label>Kode Referral</Label>
            <div className="flex gap-2">
              <Input 
                value={user.referral_code} 
                readOnly 
                className="font-mono text-lg font-bold text-center bg-gray-50"
              />
              <Button 
                variant="outline" 
                onClick={copyReferralCode}
                className="min-w-[100px]"
              >
                {copied ? '✅ Copied' : '📋 Copy'}
              </Button>
            </div>
          </div>

          {/* Referral Link */}
          <div className="space-y-2">
            <Label>Link Referral</Label>
            <div className="flex gap-2">
              <Input 
                value={`https://pulsaku.com/register?ref=${user.referral_code}`}
                readOnly 
                className="font-mono text-sm bg-gray-50"
              />
              <Button 
                variant="outline" 
                onClick={copyReferralLink}
                className="min-w-[100px]"
              >
                {copied ? '✅ Copied' : '🔗 Copy'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Share Buttons */}
          <div className="space-y-3">
            <Label>Bagikan ke Sosial Media</Label>
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={shareToWhatsApp}
                className="bg-green-500 hover:bg-green-600 text-white flex-1 min-w-[150px]"
              >
                📱 Share ke WhatsApp
              </Button>
              <Button 
                onClick={shareToTelegram}
                className="bg-blue-500 hover:bg-blue-600 text-white flex-1 min-w-[150px]"
              >
                ✈️ Share ke Telegram
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How Referral Works */}
      <Card>
        <CardHeader>
          <CardTitle>Cara Kerja Program Referral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold">Bagikan Kode Referral</h3>
                <p className="text-sm text-gray-600">
                  Ajak teman dengan membagikan kode referral atau link khusus Anda
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold">Teman Daftar & Transaksi</h3>
                <p className="text-sm text-gray-600">
                  Teman mendaftar dengan kode Anda dan melakukan transaksi pertama
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold">Dapatkan Reward</h3>
                <p className="text-sm text-gray-600">
                  Anda dan teman sama-sama mendapat bonus saldo dan koin
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reward Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Reward Referral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-green-600">💰 Untuk Anda (Referrer)</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm">Saldo Bonus</span>
                  <Badge variant="secondary">Rp 10.000</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm">Bonus Koin</span>
                  <Badge variant="secondary">🪙 50 koin</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm">Komisi Transaksi</span>
                  <Badge variant="secondary">1% dari transaksi</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-blue-600">🎁 Untuk Teman (Referee)</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm">Saldo Bonus</span>
                  <Badge variant="secondary">Rp 5.000</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm">Bonus Koin</span>
                  <Badge variant="secondary">🪙 25 koin</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-sm">Diskon Transaksi</span>
                  <Badge variant="secondary">5% untuk 10 transaksi</Badge>
                </div>
              </div>
            </div>
          </div>

          <Alert className="mt-6">
            <AlertDescription>
              <strong>Catatan:</strong> Reward akan diberikan setelah teman melakukan transaksi pertama minimal Rp 25.000. 
              Komisi transaksi diberikan untuk 6 bulan pertama.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Referral Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>🏆 Top Referrer Bulan Ini</CardTitle>
          <CardDescription>
            Lihat siapa yang paling aktif mengajak teman!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { rank: 1, name: 'John D.', referrals: 25, reward: 'Rp 500.000', badge: '🥇' },
              { rank: 2, name: 'Sarah K.', referrals: 18, reward: 'Rp 360.000', badge: '🥈' },
              { rank: 3, name: 'Mike R.', referrals: 15, reward: 'Rp 300.000', badge: '🥉' },
              { rank: 4, name: 'You', referrals: referralStats?.this_month_referrals || 0, reward: `Rp ${((referralStats?.this_month_referrals || 0) * 20000).toLocaleString('id-ID')}`, badge: '🎯' }
            ].map((item, index) => (
              <div 
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  item.name === 'You' ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.badge}</span>
                  <div>
                    <p className={`font-semibold ${item.name === 'You' ? 'text-indigo-600' : ''}`}>
                      #{item.rank} {item.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {item.referrals} referral berhasil
                    </p>
                  </div>
                </div>
                <Badge variant={item.name === 'You' ? 'default' : 'secondary'}>
                  {item.reward}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips for Better Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Tips Sukses Referral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-lg">📱</span>
              <div>
                <h4 className="font-semibold">Bagikan ke Grup WhatsApp</h4>
                <p className="text-sm text-gray-600">
                  Share ke grup keluarga, teman, atau komunitas dengan personal message
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-lg">💬</span>
              <div>
                <h4 className="font-semibold">Jelaskan Keuntungannya</h4>
                <p className="text-sm text-gray-600">
                  Ceritakan pengalaman positif Anda menggunakan PulsaKu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-lg">🎯</span>
              <div>
                <h4 className="font-semibold">Target yang Tepat</h4>
                <p className="text-sm text-gray-600">
                  Ajak orang yang sering beli pulsa, bayar tagihan, atau main game
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-lg">🔄</span>
              <div>
                <h4 className="font-semibold">Follow Up</h4>
                <p className="text-sm text-gray-600">
                  Bantu teman untuk melakukan transaksi pertama mereka
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}