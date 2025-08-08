import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { User, KycDocument, SubmitKycInput } from '../../../server/src/schema';

interface KycComponentProps {
  user: User;
}

export function KycComponent({ user }: KycComponentProps) {
  const [kycData, setKycData] = useState<KycDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [submitData, setSubmitData] = useState<SubmitKycInput>({
    id_card_url: '',
    selfie_url: ''
  });

  const loadKycStatus = useCallback(async () => {
    try {
      const result = await trpc.getKycStatus.query();
      setKycData(result);
    } catch (error: any) {
      // If no KYC found, that's okay - user hasn't submitted yet
      if (!error.message?.includes('not found')) {
        console.error('Failed to load KYC status:', error);
      }
    }
  }, []);

  useEffect(() => {
    loadKycStatus();
  }, [loadKycStatus]);

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await trpc.submitKyc.mutate(submitData);
      setSuccess('Dokumen KYC berhasil disubmit! Menunggu review dari admin.');
      
      // Reset form
      setSubmitData({
        id_card_url: '',
        selfie_url: ''
      });
      
      // Reload KYC status
      loadKycStatus();
    } catch (error: any) {
      setError(error.message || 'Gagal submit dokumen KYC');
    } finally {
      setIsLoading(false);
    }
  };

  // Mock file upload function (in real app would upload to cloud storage)
  const handleFileUpload = async (file: File, type: 'id_card' | 'selfie') => {
    // Simulate file upload
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        const mockUrl = `https://mock-storage.com/${type}_${Date.now()}.jpg`;
        resolve(mockUrl);
      }, 1000);
    });
  };

  const handleIdCardChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsLoading(true);
      try {
        const url = await handleFileUpload(file, 'id_card');
        setSubmitData((prev: SubmitKycInput) => ({ ...prev, id_card_url: url }));
        setSuccess('Foto KTP berhasil diupload!');
      } catch (error) {
        setError('Gagal upload foto KTP');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSelfieChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsLoading(true);
      try {
        const url = await handleFileUpload(file, 'selfie');
        setSubmitData((prev: SubmitKycInput) => ({ ...prev, selfie_url: url }));
        setSuccess('Foto selfie berhasil diupload!');
      } catch (error) {
        setError('Gagal upload foto selfie');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getKycStatusInfo = (status: string) => {
    const statusInfo = {
      not_submitted: {
        icon: '⚠️',
        title: 'Belum Submit KYC',
        description: 'Lengkapi verifikasi KYC untuk akses fitur lengkap',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        progress: 0
      },
      pending: {
        icon: '⏳',
        title: 'Menunggu Review',
        description: 'Dokumen KYC sedang direview oleh admin',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        progress: 50
      },
      verified: {
        icon: '✅',
        title: 'Terverifikasi',
        description: 'KYC berhasil diverifikasi. Akses penuh tersedia',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        progress: 100
      },
      rejected: {
        icon: '❌',
        title: 'Ditolak',
        description: 'Dokumen KYC ditolak. Silakan submit ulang',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        progress: 25
      }
    };

    return statusInfo[status as keyof typeof statusInfo] || statusInfo.not_submitted;
  };

  const statusInfo = getKycStatusInfo(user.kyc_status);

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

      {/* KYC Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🆔 Status Verifikasi KYC
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`p-4 rounded-lg ${statusInfo.bgColor}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{statusInfo.icon}</span>
              <div>
                <h3 className={`font-semibold ${statusInfo.color}`}>
                  {statusInfo.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {statusInfo.description}
                </p>
              </div>
            </div>
            <Progress value={statusInfo.progress} className="w-full" />
            <p className="text-xs text-gray-500 mt-2">
              Progress verifikasi: {statusInfo.progress}%
            </p>
          </div>

          {kycData && kycData.rejection_reason && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                <strong>Alasan Penolakan:</strong> {kycData.rejection_reason}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Benefits of KYC Verification */}
      <Card>
        <CardHeader>
          <CardTitle>Keuntungan Verifikasi KYC</CardTitle>
          <CardDescription>
            Fitur yang dapat diakses setelah verifikasi KYC
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">📤</span>
              <div>
                <h4 className="font-semibold">Transfer Saldo</h4>
                <p className="text-sm text-gray-600">
                  Kirim saldo ke pengguna lain dengan aman
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🏦</span>
              <div>
                <h4 className="font-semibold">Penarikan ke Bank</h4>
                <p className="text-sm text-gray-600">
                  Tarik saldo ke rekening bank pribadi
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">💰</span>
              <div>
                <h4 className="font-semibold">Limit Transaksi Lebih Tinggi</h4>
                <p className="text-sm text-gray-600">
                  Akses transaksi dengan nominal yang lebih besar
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🛡️</span>
              <div>
                <h4 className="font-semibold">Keamanan Extra</h4>
                <p className="text-sm text-gray-600">
                  Proteksi akun yang lebih baik dan terpercaya
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KYC Submission Form */}
      {(user.kyc_status === 'not_submitted' || user.kyc_status === 'rejected') && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Dokumen KYC</CardTitle>
            <CardDescription>
              Upload foto KTP dan foto selfie untuk proses verifikasi
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmitKyc}>
            <CardContent className="space-y-6">
              {/* ID Card Upload */}
              <div className="space-y-3">
                <Label htmlFor="id-card-upload">
                  Foto KTP <span className="text-red-500">*</span>
                </Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <div className="space-y-2">
                    <div className="text-4xl">🆔</div>
                    <div>
                      <p className="text-sm font-medium">Upload Foto KTP</p>
                      <p className="text-xs text-gray-500">
                        Format: JPG, PNG. Maksimal 5MB. Pastikan foto jelas dan tidak blur
                      </p>
                    </div>
                    <Input
                      id="id-card-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleIdCardChange}
                      className="w-full"
                      required
                    />
                    {submitData.id_card_url && (
                      <p className="text-green-600 text-sm">✅ Foto KTP berhasil diupload</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>📝 Tips foto KTP yang baik:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Pastikan semua teks dapat dibaca dengan jelas</li>
                    <li>Foto dalam cahaya yang cukup, tidak gelap atau silau</li>
                    <li>KTP tidak rusak, sobek, atau tertutup</li>
                    <li>Posisi foto lurus dan tidak miring</li>
                  </ul>
                </div>
              </div>

              {/* Selfie Upload */}
              <div className="space-y-3">
                <Label htmlFor="selfie-upload">
                  Foto Selfie dengan KTP <span className="text-red-500">*</span>
                </Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <div className="space-y-2">
                    <div className="text-4xl">🤳</div>
                    <div>
                      <p className="text-sm font-medium">Upload Foto Selfie</p>
                      <p className="text-xs text-gray-500">
                        Format: JPG, PNG. Maksimal 5MB. Selfie sambil memegang KTP
                      </p>
                    </div>
                    <Input
                      id="selfie-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleSelfieChange}
                      className="w-full"
                      required
                    />
                    {submitData.selfie_url && (
                      <p className="text-green-600 text-sm">✅ Foto selfie berhasil diupload</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>📝 Tips foto selfie yang baik:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Wajah dan KTP terlihat jelas dalam satu frame</li>
                    <li>Pastikan wajah di KTP dan selfie cocok</li>
                    <li>Cahaya cukup, tidak backlight atau gelap</li>
                    <li>Ekspresi natural, tidak tertutup masker/kacamata</li>
                  </ul>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !submitData.id_card_url || !submitData.selfie_url}
              >
                {isLoading ? 'Mengupload...' : 'Submit Dokumen KYC'}
              </Button>
            </CardContent>
          </form>
        </Card>
      )}

      {/* KYC Information */}
      {kycData && (
        <Card>
          <CardHeader>
            <CardTitle>Detail Verifikasi KYC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={
                  kycData.status === 'verified' ? 'default' : 
                  kycData.status === 'pending' ? 'secondary' : 
                  'destructive'
                }>
                  {statusInfo.icon} {statusInfo.title}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tanggal Submit:</span>
                <span className="text-sm">
                  {kycData.submitted_at.toLocaleDateString('id-ID')}
                </span>
              </div>
              {kycData.reviewed_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Tanggal Review:</span>
                  <span className="text-sm">
                    {kycData.reviewed_at.toLocaleDateString('id-ID')}
                  </span>
                </div>
              )}
              {kycData.reviewed_by && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Direview oleh:</span>
                  <span className="text-sm">Admin ID: {kycData.reviewed_by}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Time Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ℹ️ Informasi Proses Verifikasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Waktu proses verifikasi: 1-3 hari kerja</p>
            <p>• Admin akan melakukan review manual untuk keamanan</p>
            <p>• Pastikan dokumen yang diupload jelas dan valid</p>
            <p>• Jika ditolak, Anda dapat submit ulang dengan dokumen yang benar</p>
            <p>• Hubungi customer service jika ada pertanyaan</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}