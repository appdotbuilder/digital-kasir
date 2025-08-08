import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, depositsTable, transfersTable, withdrawalsTable } from '../db/schema';
import { 
  getUserWalletBalance,
  createDeposit,
  getUserDeposits,
  createTransfer,
  getUserTransfers,
  createWithdrawal,
  getUserWithdrawals,
  processDepositCallback
} from '../handlers/wallet';
import { eq } from 'drizzle-orm';
import { type CreateDepositInput, type CreateTransferInput, type CreateWithdrawalInput } from '../schema';

describe('wallet handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getUserWalletBalance', () => {
    it('should return user wallet balance and coins', async () => {
      // Create test user
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          wallet_balance: '150.75',
          coins: 500,
          referral_code: 'REF123'
        })
        .returning()
        .execute();

      const result = await getUserWalletBalance(user[0].id);

      expect(result.balance).toEqual(150.75);
      expect(result.coins).toEqual(500);
    });

    it('should throw error for non-existent user', async () => {
      await expect(getUserWalletBalance(999)).rejects.toThrow(/user not found/i);
    });
  });

  describe('createDeposit', () => {
    it('should create a deposit with payment reference', async () => {
      // Create test user
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          referral_code: 'REF123'
        })
        .returning()
        .execute();

      const input: CreateDepositInput = {
        amount: 100.50,
        method: 'bank_transfer'
      };

      const result = await createDeposit(user[0].id, input);

      expect(result.user_id).toEqual(user[0].id);
      expect(result.amount).toEqual(100.50);
      expect(result.method).toEqual('bank_transfer');
      expect(result.status).toEqual('pending');
      expect(result.payment_reference).toMatch(/^PAY_\d+_\d+$/);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save deposit to database', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          referral_code: 'REF123'
        })
        .returning()
        .execute();

      const input: CreateDepositInput = {
        amount: 75.25,
        method: 'e_wallet'
      };

      const result = await createDeposit(user[0].id, input);

      const deposits = await db.select()
        .from(depositsTable)
        .where(eq(depositsTable.id, result.id))
        .execute();

      expect(deposits).toHaveLength(1);
      expect(parseFloat(deposits[0].amount)).toEqual(75.25);
      expect(deposits[0].method).toEqual('e_wallet');
    });

    it('should throw error for non-existent user', async () => {
      const input: CreateDepositInput = {
        amount: 100,
        method: 'bank_transfer'
      };

      await expect(createDeposit(999, input)).rejects.toThrow(/user not found/i);
    });
  });

  describe('getUserDeposits', () => {
    it('should return user deposits in descending order', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          referral_code: 'REF123'
        })
        .returning()
        .execute();

      // Create first deposit
      const firstDeposit = await db.insert(depositsTable)
        .values({
          user_id: user[0].id,
          amount: '100.00',
          method: 'bank_transfer',
          status: 'completed'
        })
        .returning()
        .execute();

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create second deposit (more recent)
      const secondDeposit = await db.insert(depositsTable)
        .values({
          user_id: user[0].id,
          amount: '50.00',
          method: 'e_wallet',
          status: 'pending'
        })
        .returning()
        .execute();

      const results = await getUserDeposits(user[0].id);

      expect(results).toHaveLength(2);
      // Most recent first (by ID since they may have same timestamp)
      expect(results[0].id).toEqual(secondDeposit[0].id);
      expect(results[0].amount).toEqual(50.00);
      expect(results[1].id).toEqual(firstDeposit[0].id);
      expect(results[1].amount).toEqual(100.00);
    });

    it('should return empty array for user with no deposits', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          referral_code: 'REF123'
        })
        .returning()
        .execute();

      const results = await getUserDeposits(user[0].id);
      expect(results).toHaveLength(0);
    });
  });

  describe('createTransfer', () => {
    it('should create transfer between verified users', async () => {
      // Create sender with KYC verified and sufficient balance
      const sender = await db.insert(usersTable)
        .values({
          name: 'Sender User',
          email: 'sender@example.com',
          password_hash: 'hash123',
          wallet_balance: '200.00',
          kyc_status: 'verified',
          referral_code: 'SEND123'
        })
        .returning()
        .execute();

      // Create recipient
      const recipient = await db.insert(usersTable)
        .values({
          name: 'Recipient User',
          email: 'recipient@example.com',
          password_hash: 'hash456',
          referral_code: 'RECV123'
        })
        .returning()
        .execute();

      const input: CreateTransferInput = {
        to_user_email: 'recipient@example.com',
        amount: 50.00
      };

      const result = await createTransfer(sender[0].id, input);

      expect(result.from_user_id).toEqual(sender[0].id);
      expect(result.to_user_id).toEqual(recipient[0].id);
      expect(result.amount).toEqual(50.00);
      expect(result.status).toEqual('pending');
    });

    it('should throw error if sender not KYC verified', async () => {
      const sender = await db.insert(usersTable)
        .values({
          name: 'Sender User',
          email: 'sender@example.com',
          password_hash: 'hash123',
          wallet_balance: '200.00',
          kyc_status: 'pending', // Not verified
          referral_code: 'SEND123'
        })
        .returning()
        .execute();

      const recipient = await db.insert(usersTable)
        .values({
          name: 'Recipient User',
          email: 'recipient@example.com',
          password_hash: 'hash456',
          referral_code: 'RECV123'
        })
        .returning()
        .execute();

      const input: CreateTransferInput = {
        to_user_email: 'recipient@example.com',
        amount: 50.00
      };

      await expect(createTransfer(sender[0].id, input)).rejects.toThrow(/kyc verification required/i);
    });

    it('should throw error for insufficient balance', async () => {
      const sender = await db.insert(usersTable)
        .values({
          name: 'Sender User',
          email: 'sender@example.com',
          password_hash: 'hash123',
          wallet_balance: '30.00', // Less than transfer amount
          kyc_status: 'verified',
          referral_code: 'SEND123'
        })
        .returning()
        .execute();

      const recipient = await db.insert(usersTable)
        .values({
          name: 'Recipient User',
          email: 'recipient@example.com',
          password_hash: 'hash456',
          referral_code: 'RECV123'
        })
        .returning()
        .execute();

      const input: CreateTransferInput = {
        to_user_email: 'recipient@example.com',
        amount: 50.00
      };

      await expect(createTransfer(sender[0].id, input)).rejects.toThrow(/insufficient balance/i);
    });

    it('should throw error if recipient not found', async () => {
      const sender = await db.insert(usersTable)
        .values({
          name: 'Sender User',
          email: 'sender@example.com',
          password_hash: 'hash123',
          wallet_balance: '200.00',
          kyc_status: 'verified',
          referral_code: 'SEND123'
        })
        .returning()
        .execute();

      const input: CreateTransferInput = {
        to_user_email: 'nonexistent@example.com',
        amount: 50.00
      };

      await expect(createTransfer(sender[0].id, input)).rejects.toThrow(/recipient not found/i);
    });

    it('should throw error for self transfer', async () => {
      const sender = await db.insert(usersTable)
        .values({
          name: 'Sender User',
          email: 'sender@example.com',
          password_hash: 'hash123',
          wallet_balance: '200.00',
          kyc_status: 'verified',
          referral_code: 'SEND123'
        })
        .returning()
        .execute();

      const input: CreateTransferInput = {
        to_user_email: 'sender@example.com', // Same user
        amount: 50.00
      };

      await expect(createTransfer(sender[0].id, input)).rejects.toThrow(/cannot transfer to yourself/i);
    });
  });

  describe('getUserTransfers', () => {
    it('should return sent and received transfers', async () => {
      const user1 = await db.insert(usersTable)
        .values({
          name: 'User 1',
          email: 'user1@example.com',
          password_hash: 'hash123',
          referral_code: 'USER1'
        })
        .returning()
        .execute();

      const user2 = await db.insert(usersTable)
        .values({
          name: 'User 2',
          email: 'user2@example.com',
          password_hash: 'hash456',
          referral_code: 'USER2'
        })
        .returning()
        .execute();

      // Create transfers
      await db.insert(transfersTable)
        .values([
          {
            from_user_id: user1[0].id,
            to_user_id: user2[0].id,
            amount: '100.00',
            status: 'completed'
          },
          {
            from_user_id: user2[0].id,
            to_user_id: user1[0].id,
            amount: '50.00',
            status: 'pending'
          }
        ])
        .execute();

      const result = await getUserTransfers(user1[0].id);

      expect(result.sent).toHaveLength(1);
      expect(result.received).toHaveLength(1);
      expect(result.sent[0].amount).toEqual(100.00);
      expect(result.received[0].amount).toEqual(50.00);
    });

    it('should return empty arrays for user with no transfers', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      const result = await getUserTransfers(user[0].id);
      expect(result.sent).toHaveLength(0);
      expect(result.received).toHaveLength(0);
    });
  });

  describe('createWithdrawal', () => {
    it('should create withdrawal for verified user with sufficient balance', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          wallet_balance: '500.00',
          kyc_status: 'verified',
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      const input: CreateWithdrawalInput = {
        amount: 200.00,
        bank_name: 'Test Bank',
        account_number: '1234567890',
        account_name: 'Test User'
      };

      const result = await createWithdrawal(user[0].id, input);

      expect(result.user_id).toEqual(user[0].id);
      expect(result.amount).toEqual(200.00);
      expect(result.bank_name).toEqual('Test Bank');
      expect(result.account_number).toEqual('1234567890');
      expect(result.account_name).toEqual('Test User');
      expect(result.status).toEqual('pending');
    });

    it('should throw error if user not KYC verified', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          wallet_balance: '500.00',
          kyc_status: 'pending', // Not verified
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      const input: CreateWithdrawalInput = {
        amount: 200.00,
        bank_name: 'Test Bank',
        account_number: '1234567890',
        account_name: 'Test User'
      };

      await expect(createWithdrawal(user[0].id, input)).rejects.toThrow(/kyc verification required/i);
    });

    it('should throw error for insufficient balance', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          wallet_balance: '100.00', // Less than withdrawal amount
          kyc_status: 'verified',
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      const input: CreateWithdrawalInput = {
        amount: 200.00,
        bank_name: 'Test Bank',
        account_number: '1234567890',
        account_name: 'Test User'
      };

      await expect(createWithdrawal(user[0].id, input)).rejects.toThrow(/insufficient balance/i);
    });
  });

  describe('getUserWithdrawals', () => {
    it('should return user withdrawals in descending order', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      // Create first withdrawal
      const firstWithdrawal = await db.insert(withdrawalsTable)
        .values({
          user_id: user[0].id,
          amount: '200.00',
          bank_name: 'Test Bank 1',
          account_number: '1111111111',
          account_name: 'Test User',
          status: 'completed'
        })
        .returning()
        .execute();

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create second withdrawal (more recent)
      const secondWithdrawal = await db.insert(withdrawalsTable)
        .values({
          user_id: user[0].id,
          amount: '100.00',
          bank_name: 'Test Bank 2',
          account_number: '2222222222',
          account_name: 'Test User',
          status: 'pending'
        })
        .returning()
        .execute();

      const results = await getUserWithdrawals(user[0].id);

      expect(results).toHaveLength(2);
      // Most recent first (by ID since they may have same timestamp)
      expect(results[0].id).toEqual(secondWithdrawal[0].id);
      expect(results[0].amount).toEqual(100.00);
      expect(results[1].id).toEqual(firstWithdrawal[0].id);
      expect(results[1].amount).toEqual(200.00);
    });
  });

  describe('processDepositCallback', () => {
    it('should update deposit status and user balance on success', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          wallet_balance: '100.00',
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      const deposit = await db.insert(depositsTable)
        .values({
          user_id: user[0].id,
          amount: '50.00',
          method: 'bank_transfer',
          status: 'pending',
          payment_reference: 'PAY_TEST_123'
        })
        .returning()
        .execute();

      const result = await processDepositCallback('PAY_TEST_123', 'success');

      expect(result.success).toBe(true);

      // Check deposit status updated
      const updatedDeposit = await db.select()
        .from(depositsTable)
        .where(eq(depositsTable.id, deposit[0].id))
        .execute();

      expect(updatedDeposit[0].status).toEqual('completed');

      // Check user balance updated
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user[0].id))
        .execute();

      expect(parseFloat(updatedUser[0].wallet_balance)).toEqual(150.00);
    });

    it('should update deposit status to failed without updating balance', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          wallet_balance: '100.00',
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      const deposit = await db.insert(depositsTable)
        .values({
          user_id: user[0].id,
          amount: '50.00',
          method: 'bank_transfer',
          status: 'pending',
          payment_reference: 'PAY_TEST_456'
        })
        .returning()
        .execute();

      const result = await processDepositCallback('PAY_TEST_456', 'failed');

      expect(result.success).toBe(true);

      // Check deposit status updated
      const updatedDeposit = await db.select()
        .from(depositsTable)
        .where(eq(depositsTable.id, deposit[0].id))
        .execute();

      expect(updatedDeposit[0].status).toEqual('failed');

      // Check user balance unchanged
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user[0].id))
        .execute();

      expect(parseFloat(updatedUser[0].wallet_balance)).toEqual(100.00);
    });

    it('should throw error for non-existent deposit', async () => {
      await expect(processDepositCallback('NONEXISTENT', 'success')).rejects.toThrow(/deposit not found/i);
    });

    it('should throw error for already processed deposit', async () => {
      const user = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hash123',
          referral_code: 'TEST123'
        })
        .returning()
        .execute();

      await db.insert(depositsTable)
        .values({
          user_id: user[0].id,
          amount: '50.00',
          method: 'bank_transfer',
          status: 'completed', // Already processed
          payment_reference: 'PAY_TEST_789'
        })
        .execute();

      await expect(processDepositCallback('PAY_TEST_789', 'success')).rejects.toThrow(/deposit already processed/i);
    });
  });
});