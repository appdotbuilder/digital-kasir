import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, transactionsTable, productsTable, kycDocumentsTable } from '../db/schema';
import { type UpdateUserInput } from '../schema';
import { getAllUsers, updateUser, getUserStats, getTransactionStats, getDashboardSummary } from '../handlers/admin';

describe('Admin handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAllUsers', () => {
    it('should return empty list when no users exist', async () => {
      const result = await getAllUsers(1, 10);

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return paginated users', async () => {
      // Create test users
      await db.insert(usersTable).values([
        {
          name: 'User 1',
          email: 'user1@example.com',
          password_hash: 'hashed_password',
          referral_code: 'REF001',
          wallet_balance: '100.50'
        },
        {
          name: 'User 2', 
          email: 'user2@example.com',
          password_hash: 'hashed_password',
          referral_code: 'REF002',
          wallet_balance: '200.75'
        },
        {
          name: 'User 3',
          email: 'user3@example.com',
          password_hash: 'hashed_password',
          referral_code: 'REF003',
          wallet_balance: '50.25'
        }
      ]).execute();

      const result = await getAllUsers(1, 2);

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.users[0].name).toBeDefined();
      expect(result.users[0].email).toBeDefined();
      expect(typeof result.users[0].wallet_balance).toBe('number');
    });

    it('should handle pagination correctly', async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        await db.insert(usersTable).values({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password_hash: 'hashed_password',
          referral_code: `REF00${i}`,
          wallet_balance: '100.00'
        }).execute();
      }

      // Test first page
      const page1 = await getAllUsers(1, 3);
      expect(page1.users).toHaveLength(3);
      expect(page1.total).toBe(5);

      // Test second page
      const page2 = await getAllUsers(2, 3);
      expect(page2.users).toHaveLength(2);
      expect(page2.total).toBe(5);
    });
  });

  describe('updateUser', () => {
    it('should update user block status', async () => {
      // Create test user
      const userResult = await db.insert(usersTable).values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        referral_code: 'REF123',
        is_blocked: false
      }).returning().execute();

      const userId = userResult[0].id;

      const input: UpdateUserInput = {
        user_id: userId,
        is_blocked: true
      };

      const result = await updateUser(input);

      expect(result.id).toBe(userId);
      expect(result.is_blocked).toBe(true);
      expect(result.name).toBe('Test User');
    });

    it('should update user wallet balance', async () => {
      // Create test user
      const userResult = await db.insert(usersTable).values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        referral_code: 'REF123',
        wallet_balance: '100.00'
      }).returning().execute();

      const userId = userResult[0].id;

      const input: UpdateUserInput = {
        user_id: userId,
        wallet_balance: 250.75
      };

      const result = await updateUser(input);

      expect(result.id).toBe(userId);
      expect(result.wallet_balance).toBe(250.75);
      expect(typeof result.wallet_balance).toBe('number');
    });

    it('should update multiple fields', async () => {
      // Create test user
      const userResult = await db.insert(usersTable).values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        referral_code: 'REF123',
        wallet_balance: '100.00',
        is_blocked: false
      }).returning().execute();

      const userId = userResult[0].id;

      const input: UpdateUserInput = {
        user_id: userId,
        is_blocked: true,
        wallet_balance: 500.00
      };

      const result = await updateUser(input);

      expect(result.id).toBe(userId);
      expect(result.is_blocked).toBe(true);
      expect(result.wallet_balance).toBe(500.00);
    });

    it('should throw error for non-existent user', async () => {
      const input: UpdateUserInput = {
        user_id: 99999,
        is_blocked: true
      };

      await expect(updateUser(input)).rejects.toThrow(/User not found/i);
    });
  });

  describe('getUserStats', () => {
    it('should return zero stats when no users exist', async () => {
      const stats = await getUserStats();

      expect(stats.total_users).toBe(0);
      expect(stats.kyc_verified_users).toBe(0);
      expect(stats.kyc_pending_users).toBe(0);
      expect(stats.blocked_users).toBe(0);
    });

    it('should calculate user statistics correctly', async () => {
      // Create users with different statuses
      await db.insert(usersTable).values([
        {
          name: 'User 1',
          email: 'user1@example.com',
          password_hash: 'hashed_password',
          referral_code: 'REF001',
          kyc_status: 'verified',
          is_blocked: false
        },
        {
          name: 'User 2',
          email: 'user2@example.com',
          password_hash: 'hashed_password',
          referral_code: 'REF002',
          kyc_status: 'pending',
          is_blocked: true
        },
        {
          name: 'User 3',
          email: 'user3@example.com',
          password_hash: 'hashed_password',
          referral_code: 'REF003',
          kyc_status: 'not_submitted',
          is_blocked: false
        },
        {
          name: 'User 4',
          email: 'user4@example.com',
          password_hash: 'hashed_password',
          referral_code: 'REF004',
          kyc_status: 'verified',
          is_blocked: true
        }
      ]).execute();

      const stats = await getUserStats();

      expect(stats.total_users).toBe(4);
      expect(stats.kyc_verified_users).toBe(2);
      expect(stats.kyc_pending_users).toBe(1);
      expect(stats.blocked_users).toBe(2);
    });
  });

  describe('getTransactionStats', () => {
    it('should return zero stats when no transactions exist', async () => {
      const stats = await getTransactionStats();

      expect(stats.total_transactions).toBe(0);
      expect(stats.total_revenue).toBe(0);
      expect(stats.pending_transactions).toBe(0);
      expect(stats.completed_transactions).toBe(0);
      expect(stats.failed_transactions).toBe(0);
    });

    it('should calculate transaction statistics correctly', async () => {
      // Create test user and product first
      const userResult = await db.insert(usersTable).values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        referral_code: 'REF123'
      }).returning().execute();
      const userId = userResult[0].id;

      const productResult = await db.insert(productsTable).values({
        name: 'Test Product',
        type: 'pulsa',
        price: '10.00',
        provider_code: 'TEST01'
      }).returning().execute();
      const productId = productResult[0].id;

      // Create transactions with different statuses
      await db.insert(transactionsTable).values([
        {
          user_id: userId,
          product_id: productId,
          target_number: '081234567890',
          amount: '25.00',
          status: 'completed'
        },
        {
          user_id: userId,
          product_id: productId,
          target_number: '081234567891',
          amount: '50.00',
          status: 'completed'
        },
        {
          user_id: userId,
          product_id: productId,
          target_number: '081234567892',
          amount: '15.00',
          status: 'pending'
        },
        {
          user_id: userId,
          product_id: productId,
          target_number: '081234567893',
          amount: '30.00',
          status: 'failed'
        }
      ]).execute();

      const stats = await getTransactionStats();

      expect(stats.total_transactions).toBe(4);
      expect(stats.total_revenue).toBe(75.00); // Only completed transactions: 25 + 50
      expect(stats.pending_transactions).toBe(1);
      expect(stats.completed_transactions).toBe(2);
      expect(stats.failed_transactions).toBe(1);
    });
  });

  describe('getDashboardSummary', () => {
    it('should return complete dashboard summary', async () => {
      // Create test user
      const userResult = await db.insert(usersTable).values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        referral_code: 'REF123',
        kyc_status: 'verified'
      }).returning().execute();
      const userId = userResult[0].id;

      // Create test product
      const productResult = await db.insert(productsTable).values({
        name: 'Test Product',
        type: 'pulsa',
        price: '10.00',
        provider_code: 'TEST01'
      }).returning().execute();
      const productId = productResult[0].id;

      // Create test transaction
      await db.insert(transactionsTable).values({
        user_id: userId,
        product_id: productId,
        target_number: '081234567890',
        amount: '25.00',
        status: 'completed'
      }).execute();

      // Create test KYC document
      await db.insert(kycDocumentsTable).values({
        user_id: userId,
        id_card_url: 'http://example.com/id.jpg',
        selfie_url: 'http://example.com/selfie.jpg',
        status: 'pending'
      }).execute();

      const summary = await getDashboardSummary();

      // Verify user stats
      expect(summary.userStats.total_users).toBe(1);
      expect(summary.userStats.kyc_verified_users).toBe(1);

      // Verify transaction stats
      expect(summary.transactionStats.total_transactions).toBe(1);
      expect(summary.transactionStats.completed_transactions).toBe(1);
      expect(summary.transactionStats.total_revenue).toBe(25.00);

      // Verify recent transactions
      expect(summary.recentTransactions).toHaveLength(1);
      expect(summary.recentTransactions[0].user_name).toBe('Test User');
      expect(summary.recentTransactions[0].product_name).toBe('Test Product');
      expect(typeof summary.recentTransactions[0].amount).toBe('number');

      // Verify pending KYC
      expect(summary.pendingKyc).toBe(1);
    });

    it('should handle empty data gracefully', async () => {
      const summary = await getDashboardSummary();

      expect(summary.userStats.total_users).toBe(0);
      expect(summary.transactionStats.total_transactions).toBe(0);
      expect(summary.recentTransactions).toHaveLength(0);
      expect(summary.pendingKyc).toBe(0);
    });
  });
});