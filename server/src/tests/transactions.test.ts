import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, transactionsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import {
  createTransaction,
  getUserTransactions,
  getTransactionById,
  updateTransactionStatus,
  getAllTransactions,
  getTransactionStats
} from '../handlers/transactions';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '081234567890',
  password_hash: 'hashedpassword123',
  role: 'user' as const,
  kyc_status: 'verified' as const,
  wallet_balance: '100000',
  coins: 50,
  referral_code: 'REF123',
  referred_by: null,
  is_blocked: false
};

const testProduct = {
  name: 'Pulsa Telkomsel 20K',
  description: 'Pulsa Telkomsel 20 ribu',
  type: 'pulsa' as const,
  price: '20000',
  provider_code: 'TSEL20',
  is_active: true
};

const testTransactionInput: CreateTransactionInput = {
  product_id: 1,
  target_number: '081234567890'
};

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a transaction successfully', async () => {
    // Create test user and product
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    const userId = userResult[0].id;
    const productId = productResult[0].id;

    const transactionInput = {
      ...testTransactionInput,
      product_id: productId
    };

    const result = await createTransaction(userId, transactionInput);

    // Verify transaction fields
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.product_id).toEqual(productId);
    expect(result.target_number).toEqual('081234567890');
    expect(result.amount).toEqual(20000);
    expect(result.coins_earned).toEqual(200); // 1% of 20000
    expect(result.status).toEqual('pending');
    expect(result.provider_transaction_id).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify user balance was deducted
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(parseFloat(updatedUser[0].wallet_balance)).toEqual(80000); // 100000 - 20000
  });

  it('should throw error for non-existent user', async () => {
    await db.insert(productsTable).values(testProduct).returning().execute();

    await expect(createTransaction(999, testTransactionInput))
      .rejects.toThrow(/user not found/i);
  });

  it('should throw error for blocked user', async () => {
    const blockedUser = { ...testUser, is_blocked: true };
    const userResult = await db.insert(usersTable).values(blockedUser).returning().execute();
    await db.insert(productsTable).values(testProduct).returning().execute();

    await expect(createTransaction(userResult[0].id, testTransactionInput))
      .rejects.toThrow(/account is blocked/i);
  });

  it('should throw error for non-existent product', async () => {
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();

    await expect(createTransaction(userResult[0].id, { ...testTransactionInput, product_id: 999 }))
      .rejects.toThrow(/product not found/i);
  });

  it('should throw error for inactive product', async () => {
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const inactiveProduct = { ...testProduct, is_active: false };
    const productResult = await db.insert(productsTable).values(inactiveProduct).returning().execute();

    const transactionInput = {
      ...testTransactionInput,
      product_id: productResult[0].id
    };

    await expect(createTransaction(userResult[0].id, transactionInput))
      .rejects.toThrow(/product is not active/i);
  });

  it('should throw error for insufficient balance', async () => {
    const poorUser = { ...testUser, wallet_balance: '5000' };
    const userResult = await db.insert(usersTable).values(poorUser).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();

    const transactionInput = {
      ...testTransactionInput,
      product_id: productResult[0].id
    };

    await expect(createTransaction(userResult[0].id, transactionInput))
      .rejects.toThrow(/insufficient wallet balance/i);
  });
});

describe('getUserTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get user transactions with pagination', async () => {
    // Create test user and product
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    const userId = userResult[0].id;
    const productId = productResult[0].id;

    // Create multiple transactions
    await db.insert(transactionsTable).values([
      {
        user_id: userId,
        product_id: productId,
        target_number: '081234567890',
        amount: '20000',
        coins_earned: 200,
        status: 'completed'
      },
      {
        user_id: userId,
        product_id: productId,
        target_number: '081234567891',
        amount: '15000',
        coins_earned: 150,
        status: 'pending'
      }
    ]).execute();

    const result = await getUserTransactions(userId, 10);

    expect(result).toHaveLength(2);
    expect(result[0].user_id).toEqual(userId);
    expect(typeof result[0].amount).toEqual('number');
    expect(result[0].amount).toBeOneOf([20000, 15000]);
    
    // Verify ordering (latest first)
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should return empty array for user with no transactions', async () => {
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    
    const result = await getUserTransactions(userResult[0].id);

    expect(result).toHaveLength(0);
  });
});

describe('getTransactionById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get transaction by ID for user', async () => {
    // Create test user and product
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    const userId = userResult[0].id;
    const productId = productResult[0].id;

    // Create transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: userId,
      product_id: productId,
      target_number: '081234567890',
      amount: '20000',
      coins_earned: 200,
      status: 'completed'
    }).returning().execute();

    const transactionId = transactionResult[0].id;

    const result = await getTransactionById(transactionId, userId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(transactionId);
    expect(result!.user_id).toEqual(userId);
    expect(result!.product_id).toEqual(productId);
    expect(typeof result!.amount).toEqual('number');
    expect(result!.amount).toEqual(20000);
  });

  it('should return null for non-existent transaction', async () => {
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    
    const result = await getTransactionById(999, userResult[0].id);

    expect(result).toBeNull();
  });

  it('should return null for transaction belonging to different user', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable).values(testUser).returning().execute();
    const user2 = { ...testUser, email: 'user2@example.com', referral_code: 'REF456' };
    const user2Result = await db.insert(usersTable).values(user2).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    // Create transaction for user1
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: user1Result[0].id,
      product_id: productResult[0].id,
      target_number: '081234567890',
      amount: '20000',
      coins_earned: 200,
      status: 'completed'
    }).returning().execute();

    // Try to get transaction with user2's ID
    const result = await getTransactionById(transactionResult[0].id, user2Result[0].id);

    expect(result).toBeNull();
  });
});

describe('updateTransactionStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update transaction status to completed and award coins', async () => {
    // Create test user and product
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    const userId = userResult[0].id;

    // Create pending transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: userId,
      product_id: productResult[0].id,
      target_number: '081234567890',
      amount: '20000',
      coins_earned: 200,
      status: 'pending'
    }).returning().execute();

    const transactionId = transactionResult[0].id;

    const result = await updateTransactionStatus(transactionId, 'completed', 'PROVIDER123');

    expect(result.id).toEqual(transactionId);
    expect(result.status).toEqual('completed');
    expect(result.provider_transaction_id).toEqual('PROVIDER123');
    expect(typeof result.amount).toEqual('number');

    // Verify user coins were awarded
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(updatedUser[0].coins).toEqual(250); // 50 + 200
  });

  it('should update transaction status to failed and refund balance', async () => {
    // Create test user and product
    const userResult = await db.insert(usersTable).values({ ...testUser, wallet_balance: '80000' }).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    const userId = userResult[0].id;

    // Create pending transaction
    const transactionResult = await db.insert(transactionsTable).values({
      user_id: userId,
      product_id: productResult[0].id,
      target_number: '081234567890',
      amount: '20000',
      coins_earned: 200,
      status: 'pending'
    }).returning().execute();

    const transactionId = transactionResult[0].id;

    const result = await updateTransactionStatus(transactionId, 'failed');

    expect(result.status).toEqual('failed');

    // Verify user balance was refunded
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(parseFloat(updatedUser[0].wallet_balance)).toEqual(100000); // 80000 + 20000
  });

  it('should throw error for non-existent transaction', async () => {
    await expect(updateTransactionStatus(999, 'completed'))
      .rejects.toThrow(/transaction not found/i);
  });
});

describe('getAllTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get all transactions with pagination', async () => {
    // Create test users and products
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    const userId = userResult[0].id;
    const productId = productResult[0].id;

    // Create transactions
    await db.insert(transactionsTable).values([
      {
        user_id: userId,
        product_id: productId,
        target_number: '081234567890',
        amount: '20000',
        coins_earned: 200,
        status: 'completed'
      },
      {
        user_id: userId,
        product_id: productId,
        target_number: '081234567891',
        amount: '15000',
        coins_earned: 150,
        status: 'pending'
      }
    ]).execute();

    const result = await getAllTransactions(10);

    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0].amount).toEqual('number');
    
    // Verify ordering (latest first)
    if (result.length > 1) {
      expect(result[0].created_at >= result[1].created_at).toBe(true);
    }
  });
});

describe('getTransactionStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get transaction statistics correctly', async () => {
    // Create test user and product
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const productResult = await db.insert(productsTable).values(testProduct).returning().execute();
    
    const userId = userResult[0].id;
    const productId = productResult[0].id;

    // Create transactions with different statuses
    await db.insert(transactionsTable).values([
      {
        user_id: userId,
        product_id: productId,
        target_number: '081234567890',
        amount: '20000',
        coins_earned: 200,
        status: 'completed'
      },
      {
        user_id: userId,
        product_id: productId,
        target_number: '081234567891',
        amount: '15000',
        coins_earned: 150,
        status: 'pending'
      },
      {
        user_id: userId,
        product_id: productId,
        target_number: '081234567892',
        amount: '10000',
        coins_earned: 100,
        status: 'failed'
      }
    ]).execute();

    const result = await getTransactionStats();

    expect(typeof result.total_transactions).toEqual('number');
    expect(typeof result.total_revenue).toEqual('number');
    expect(typeof result.pending_transactions).toEqual('number');
    expect(typeof result.completed_transactions).toEqual('number');
    expect(typeof result.failed_transactions).toEqual('number');

    expect(result.total_transactions).toEqual(3);
    expect(result.total_revenue).toEqual(45000); // 20000 + 15000 + 10000
    expect(result.pending_transactions).toEqual(1);
    expect(result.completed_transactions).toEqual(1);
    expect(result.failed_transactions).toEqual(1);
  });

  it('should return zero stats when no transactions exist', async () => {
    const result = await getTransactionStats();

    expect(result.total_transactions).toEqual(0);
    expect(result.total_revenue).toEqual(0);
    expect(result.pending_transactions).toEqual(0);
    expect(result.completed_transactions).toEqual(0);
    expect(result.failed_transactions).toEqual(0);
  });
});