import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const kycStatusEnum = pgEnum('kyc_status', ['pending', 'verified', 'rejected', 'not_submitted']);
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'failed', 'cancelled']);
export const transactionTypeEnum = pgEnum('transaction_type', ['pulsa', 'data', 'pln', 'voucher_game']);
export const depositStatusEnum = pgEnum('deposit_status', ['pending', 'completed', 'failed', 'cancelled']);
export const depositMethodEnum = pgEnum('deposit_method', ['bank_transfer', 'e_wallet', 'virtual_account']);
export const transferStatusEnum = pgEnum('transfer_status', ['pending', 'completed', 'failed', 'cancelled']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['pending', 'completed', 'failed', 'cancelled']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  kyc_status: kycStatusEnum('kyc_status').notNull().default('not_submitted'),
  wallet_balance: numeric('wallet_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  coins: integer('coins').notNull().default(0),
  referral_code: text('referral_code').notNull().unique(),
  referred_by: text('referred_by'),
  is_blocked: boolean('is_blocked').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// KYC documents table
export const kycDocumentsTable = pgTable('kyc_documents', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  id_card_url: text('id_card_url').notNull(),
  selfie_url: text('selfie_url').notNull(),
  status: kycStatusEnum('status').notNull().default('pending'),
  rejection_reason: text('rejection_reason'),
  submitted_at: timestamp('submitted_at').defaultNow().notNull(),
  reviewed_at: timestamp('reviewed_at'),
  reviewed_by: integer('reviewed_by').references(() => usersTable.id)
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: transactionTypeEnum('type').notNull(),
  price: numeric('price', { precision: 15, scale: 2 }).notNull(),
  provider_code: text('provider_code').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  target_number: text('target_number').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  coins_earned: integer('coins_earned').notNull().default(0),
  status: transactionStatusEnum('status').notNull().default('pending'),
  provider_transaction_id: text('provider_transaction_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Deposits table
export const depositsTable = pgTable('deposits', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  method: depositMethodEnum('method').notNull(),
  status: depositStatusEnum('status').notNull().default('pending'),
  payment_reference: text('payment_reference'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transfers table
export const transfersTable = pgTable('transfers', {
  id: serial('id').primaryKey(),
  from_user_id: integer('from_user_id').notNull().references(() => usersTable.id),
  to_user_id: integer('to_user_id').notNull().references(() => usersTable.id),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  status: transferStatusEnum('status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Withdrawals table
export const withdrawalsTable = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  bank_name: text('bank_name').notNull(),
  account_number: text('account_number').notNull(),
  account_name: text('account_name').notNull(),
  status: withdrawalStatusEnum('status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Coin exchanges table
export const coinExchangesTable = pgTable('coin_exchanges', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  coins_used: integer('coins_used').notNull(),
  balance_received: numeric('balance_received', { precision: 15, scale: 2 }).notNull(),
  exchange_rate: numeric('exchange_rate', { precision: 10, scale: 4 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  kycDocument: one(kycDocumentsTable),
  transactions: many(transactionsTable),
  deposits: many(depositsTable),
  sentTransfers: many(transfersTable, { relationName: 'sender' }),
  receivedTransfers: many(transfersTable, { relationName: 'receiver' }),
  withdrawals: many(withdrawalsTable),
  coinExchanges: many(coinExchangesTable),
  reviewedKyc: many(kycDocumentsTable, { relationName: 'reviewer' })
}));

export const kycDocumentsRelations = relations(kycDocumentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [kycDocumentsTable.user_id],
    references: [usersTable.id]
  }),
  reviewer: one(usersTable, {
    fields: [kycDocumentsTable.reviewed_by],
    references: [usersTable.id],
    relationName: 'reviewer'
  })
}));

export const productsRelations = relations(productsTable, ({ many }) => ({
  transactions: many(transactionsTable)
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [transactionsTable.user_id],
    references: [usersTable.id]
  }),
  product: one(productsTable, {
    fields: [transactionsTable.product_id],
    references: [productsTable.id]
  })
}));

export const depositsRelations = relations(depositsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [depositsTable.user_id],
    references: [usersTable.id]
  })
}));

export const transfersRelations = relations(transfersTable, ({ one }) => ({
  fromUser: one(usersTable, {
    fields: [transfersTable.from_user_id],
    references: [usersTable.id],
    relationName: 'sender'
  }),
  toUser: one(usersTable, {
    fields: [transfersTable.to_user_id],
    references: [usersTable.id],
    relationName: 'receiver'
  })
}));

export const withdrawalsRelations = relations(withdrawalsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [withdrawalsTable.user_id],
    references: [usersTable.id]
  })
}));

export const coinExchangesRelations = relations(coinExchangesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [coinExchangesTable.user_id],
    references: [usersTable.id]
  })
}));

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  kycDocuments: kycDocumentsTable,
  products: productsTable,
  transactions: transactionsTable,
  deposits: depositsTable,
  transfers: transfersTable,
  withdrawals: withdrawalsTable,
  coinExchanges: coinExchangesTable
};

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type KycDocument = typeof kycDocumentsTable.$inferSelect;
export type NewKycDocument = typeof kycDocumentsTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type Deposit = typeof depositsTable.$inferSelect;
export type NewDeposit = typeof depositsTable.$inferInsert;
export type Transfer = typeof transfersTable.$inferSelect;
export type NewTransfer = typeof transfersTable.$inferInsert;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
export type NewWithdrawal = typeof withdrawalsTable.$inferInsert;
export type CoinExchange = typeof coinExchangesTable.$inferSelect;
export type NewCoinExchange = typeof coinExchangesTable.$inferInsert;