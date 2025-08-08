import { z } from 'zod';

// Enums
export const kycStatusEnum = z.enum(['pending', 'verified', 'rejected', 'not_submitted']);
export const userRoleEnum = z.enum(['user', 'admin']);
export const transactionStatusEnum = z.enum(['pending', 'completed', 'failed', 'cancelled']);
export const transactionTypeEnum = z.enum(['pulsa', 'data', 'pln', 'voucher_game']);
export const depositStatusEnum = z.enum(['pending', 'completed', 'failed', 'cancelled']);
export const depositMethodEnum = z.enum(['bank_transfer', 'e_wallet', 'virtual_account']);
export const transferStatusEnum = z.enum(['pending', 'completed', 'failed', 'cancelled']);
export const withdrawalStatusEnum = z.enum(['pending', 'completed', 'failed', 'cancelled']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  password_hash: z.string(),
  role: userRoleEnum,
  kyc_status: kycStatusEnum,
  wallet_balance: z.number(),
  coins: z.number().int(),
  referral_code: z.string(),
  referred_by: z.string().nullable(),
  is_blocked: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User input schemas
export const registerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  referral_code: z.string().optional()
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const resetPasswordInputSchema = z.object({
  email: z.string().email()
});

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

// KYC schemas
export const kycDocumentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  id_card_url: z.string(),
  selfie_url: z.string(),
  status: kycStatusEnum,
  rejection_reason: z.string().nullable(),
  submitted_at: z.coerce.date(),
  reviewed_at: z.coerce.date().nullable(),
  reviewed_by: z.number().nullable()
});

export type KycDocument = z.infer<typeof kycDocumentSchema>;

export const submitKycInputSchema = z.object({
  id_card_url: z.string().url(),
  selfie_url: z.string().url()
});

export type SubmitKycInput = z.infer<typeof submitKycInputSchema>;

export const reviewKycInputSchema = z.object({
  kyc_id: z.number(),
  status: z.enum(['verified', 'rejected']),
  rejection_reason: z.string().optional()
});

export type ReviewKycInput = z.infer<typeof reviewKycInputSchema>;

// Product schemas
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  type: transactionTypeEnum,
  price: z.number(),
  provider_code: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

export const createProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: transactionTypeEnum,
  price: z.number().positive(),
  provider_code: z.string()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  provider_code: z.string().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Transaction schemas
export const transactionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  target_number: z.string(),
  amount: z.number(),
  coins_earned: z.number().int(),
  status: transactionStatusEnum,
  provider_transaction_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionInputSchema = z.object({
  product_id: z.number(),
  target_number: z.string().min(1)
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Deposit schemas
export const depositSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  amount: z.number(),
  method: depositMethodEnum,
  status: depositStatusEnum,
  payment_reference: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Deposit = z.infer<typeof depositSchema>;

export const createDepositInputSchema = z.object({
  amount: z.number().positive(),
  method: depositMethodEnum
});

export type CreateDepositInput = z.infer<typeof createDepositInputSchema>;

// Transfer schemas
export const transferSchema = z.object({
  id: z.number(),
  from_user_id: z.number(),
  to_user_id: z.number(),
  amount: z.number(),
  status: transferStatusEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Transfer = z.infer<typeof transferSchema>;

export const createTransferInputSchema = z.object({
  to_user_email: z.string().email(),
  amount: z.number().positive()
});

export type CreateTransferInput = z.infer<typeof createTransferInputSchema>;

// Withdrawal schemas
export const withdrawalSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  amount: z.number(),
  bank_name: z.string(),
  account_number: z.string(),
  account_name: z.string(),
  status: withdrawalStatusEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Withdrawal = z.infer<typeof withdrawalSchema>;

export const createWithdrawalInputSchema = z.object({
  amount: z.number().positive(),
  bank_name: z.string().min(1),
  account_number: z.string().min(1),
  account_name: z.string().min(1)
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalInputSchema>;

// Coin exchange schemas
export const coinExchangeSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  coins_used: z.number().int(),
  balance_received: z.number(),
  exchange_rate: z.number(),
  created_at: z.coerce.date()
});

export type CoinExchange = z.infer<typeof coinExchangeSchema>;

export const exchangeCoinsInputSchema = z.object({
  coins: z.number().int().positive()
});

export type ExchangeCoinsInput = z.infer<typeof exchangeCoinsInputSchema>;

// Auth response schemas
export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Admin schemas
export const updateUserInputSchema = z.object({
  user_id: z.number(),
  is_blocked: z.boolean().optional(),
  wallet_balance: z.number().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const transactionStatsSchema = z.object({
  total_transactions: z.number().int(),
  total_revenue: z.number(),
  pending_transactions: z.number().int(),
  completed_transactions: z.number().int(),
  failed_transactions: z.number().int()
});

export type TransactionStats = z.infer<typeof transactionStatsSchema>;

export const userStatsSchema = z.object({
  total_users: z.number().int(),
  kyc_verified_users: z.number().int(),
  kyc_pending_users: z.number().int(),
  blocked_users: z.number().int()
});

export type UserStats = z.infer<typeof userStatsSchema>;