import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerInputSchema,
  loginInputSchema,
  resetPasswordInputSchema,
  submitKycInputSchema,
  reviewKycInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  createTransactionInputSchema,
  createDepositInputSchema,
  createTransferInputSchema,
  createWithdrawalInputSchema,
  exchangeCoinsInputSchema,
  updateUserInputSchema
} from './schema';

// Import handlers
import { register, login, resetPassword, logout } from './handlers/auth';
import { submitKyc, getKycStatus, getPendingKycRequests, reviewKyc } from './handlers/kyc';
import { getProducts, getProductsByType, getProductById, createProduct, updateProduct, deleteProduct } from './handlers/products';
import { createTransaction, getUserTransactions, getTransactionById, updateTransactionStatus, getAllTransactions, getTransactionStats } from './handlers/transactions';
import { getUserWalletBalance, createDeposit, getUserDeposits, createTransfer, getUserTransfers, createWithdrawal, getUserWithdrawals, processDepositCallback } from './handlers/wallet';
import { exchangeCoinsToBalance, getUserCoinHistory, getCoinExchangeRate, addCoinsToUser } from './handlers/coins';
import { getAllUsers, updateUser, getUserStats, getTransactionStats as getAdminTransactionStats, getDashboardSummary } from './handlers/admin';
import { generateReferralCode, getReferralStats, processReferralReward, validateReferralCode } from './handlers/referral';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(({ input }) => register(input)),
  
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),
  
  resetPassword: publicProcedure
    .input(resetPasswordInputSchema)
    .mutation(({ input }) => resetPassword(input)),
  
  logout: publicProcedure
    .mutation(() => logout()),

  // KYC routes
  submitKyc: publicProcedure
    .input(submitKycInputSchema)
    .mutation(({ input }) => submitKyc(1, input)), // TODO: Get userId from auth context

  getKycStatus: publicProcedure
    .query(() => getKycStatus(1)), // TODO: Get userId from auth context

  getPendingKycRequests: publicProcedure
    .query(() => getPendingKycRequests()),

  reviewKyc: publicProcedure
    .input(reviewKycInputSchema)
    .mutation(({ input }) => reviewKyc(1, input)), // TODO: Get adminId from auth context

  // Product routes
  getProducts: publicProcedure
    .query(() => getProducts()),

  getProductsByType: publicProcedure
    .input(z.object({ type: z.string() }))
    .query(({ input }) => getProductsByType(input.type)),

  getProductById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getProductById(input.id)),

  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),

  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),

  deleteProduct: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteProduct(input.id)),

  // Transaction routes
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(1, input)), // TODO: Get userId from auth context

  getUserTransactions: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ input }) => getUserTransactions(1, input.limit)), // TODO: Get userId from auth context

  getTransactionById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getTransactionById(input.id, 1)), // TODO: Get userId from auth context

  updateTransactionStatus: publicProcedure
    .input(z.object({ 
      id: z.number(), 
      status: z.string(),
      providerTransactionId: z.string().optional()
    }))
    .mutation(({ input }) => updateTransactionStatus(input.id, input.status, input.providerTransactionId)),

  getAllTransactions: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ input }) => getAllTransactions(input.limit)),

  getTransactionStats: publicProcedure
    .query(() => getTransactionStats()),

  // Wallet routes
  getUserWalletBalance: publicProcedure
    .query(() => getUserWalletBalance(1)), // TODO: Get userId from auth context

  createDeposit: publicProcedure
    .input(createDepositInputSchema)
    .mutation(({ input }) => createDeposit(1, input)), // TODO: Get userId from auth context

  getUserDeposits: publicProcedure
    .query(() => getUserDeposits(1)), // TODO: Get userId from auth context

  createTransfer: publicProcedure
    .input(createTransferInputSchema)
    .mutation(({ input }) => createTransfer(1, input)), // TODO: Get userId from auth context

  getUserTransfers: publicProcedure
    .query(() => getUserTransfers(1)), // TODO: Get userId from auth context

  createWithdrawal: publicProcedure
    .input(createWithdrawalInputSchema)
    .mutation(({ input }) => createWithdrawal(1, input)), // TODO: Get userId from auth context

  getUserWithdrawals: publicProcedure
    .query(() => getUserWithdrawals(1)), // TODO: Get userId from auth context

  processDepositCallback: publicProcedure
    .input(z.object({ 
      paymentReference: z.string(),
      status: z.string()
    }))
    .mutation(({ input }) => processDepositCallback(input.paymentReference, input.status)),

  // Coin routes
  exchangeCoinsToBalance: publicProcedure
    .input(exchangeCoinsInputSchema)
    .mutation(({ input }) => exchangeCoinsToBalance(1, input)), // TODO: Get userId from auth context

  getUserCoinHistory: publicProcedure
    .query(() => getUserCoinHistory(1)), // TODO: Get userId from auth context

  getCoinExchangeRate: publicProcedure
    .query(() => getCoinExchangeRate()),

  addCoinsToUser: publicProcedure
    .input(z.object({ 
      userId: z.number(),
      coins: z.number(),
      reason: z.string()
    }))
    .mutation(({ input }) => addCoinsToUser(input.userId, input.coins, input.reason)),

  // Admin routes
  getAllUsers: publicProcedure
    .input(z.object({ 
      page: z.number().optional(),
      limit: z.number().optional()
    }))
    .query(({ input }) => getAllUsers(input.page, input.limit)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  getUserStats: publicProcedure
    .query(() => getUserStats()),

  getAdminTransactionStats: publicProcedure
    .query(() => getAdminTransactionStats()),

  getDashboardSummary: publicProcedure
    .query(() => getDashboardSummary()),

  // Referral routes
  generateReferralCode: publicProcedure
    .query(() => generateReferralCode(1)), // TODO: Get userId from auth context

  getReferralStats: publicProcedure
    .query(() => getReferralStats(1)), // TODO: Get userId from auth context

  processReferralReward: publicProcedure
    .input(z.object({ 
      referrerCode: z.string(),
      newUserId: z.number()
    }))
    .mutation(({ input }) => processReferralReward(input.referrerCode, input.newUserId)),

  validateReferralCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(({ input }) => validateReferralCode(input.code))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();