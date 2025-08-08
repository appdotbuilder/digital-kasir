import { db } from '../db';
import { usersTable, transactionsTable, productsTable, kycDocumentsTable } from '../db/schema';
import { type User, type UpdateUserInput, type TransactionStats, type UserStats } from '../schema';
import { eq, count, sql, desc } from 'drizzle-orm';

export async function getAllUsers(page: number = 1, limit: number = 50): Promise<{ users: User[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    // Get total count of users
    const totalResult = await db.select({ count: count() }).from(usersTable).execute();
    const total = totalResult[0].count;

    // Get paginated users
    const userResults = await db.select()
      .from(usersTable)
      .orderBy(desc(usersTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    // Convert numeric fields back to numbers
    const users = userResults.map(user => ({
      ...user,
      wallet_balance: parseFloat(user.wallet_balance)
    }));

    return { users, total };
  } catch (error) {
    console.error('Get all users failed:', error);
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.is_blocked !== undefined) {
      updateData.is_blocked = input.is_blocked;
    }

    if (input.wallet_balance !== undefined) {
      updateData.wallet_balance = input.wallet_balance.toString(); // Convert number to string for numeric column
    }

    // Update user record
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.user_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    // Convert numeric fields back to numbers before returning
    const user = result[0];
    return {
      ...user,
      wallet_balance: parseFloat(user.wallet_balance)
    };
  } catch (error) {
    console.error('Update user failed:', error);
    throw error;
  }
}

export async function getUserStats(): Promise<UserStats> {
  try {
    // Get total users count
    const totalUsersResult = await db.select({ count: count() })
      .from(usersTable)
      .execute();
    const total_users = totalUsersResult[0].count;

    // Get KYC verified users count
    const kycVerifiedResult = await db.select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.kyc_status, 'verified'))
      .execute();
    const kyc_verified_users = kycVerifiedResult[0].count;

    // Get KYC pending users count
    const kycPendingResult = await db.select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.kyc_status, 'pending'))
      .execute();
    const kyc_pending_users = kycPendingResult[0].count;

    // Get blocked users count
    const blockedUsersResult = await db.select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.is_blocked, true))
      .execute();
    const blocked_users = blockedUsersResult[0].count;

    return {
      total_users,
      kyc_verified_users,
      kyc_pending_users,
      blocked_users
    };
  } catch (error) {
    console.error('Get user stats failed:', error);
    throw error;
  }
}

export async function getTransactionStats(): Promise<TransactionStats> {
  try {
    // Get total transactions count
    const totalTransactionsResult = await db.select({ count: count() })
      .from(transactionsTable)
      .execute();
    const total_transactions = totalTransactionsResult[0].count;

    // Get total revenue (sum of completed transaction amounts)
    const totalRevenueResult = await db.select({ 
      total: sql<string>`sum(${transactionsTable.amount})` 
    })
      .from(transactionsTable)
      .where(eq(transactionsTable.status, 'completed'))
      .execute();
    const total_revenue = totalRevenueResult[0].total ? parseFloat(totalRevenueResult[0].total) : 0;

    // Get pending transactions count
    const pendingTransactionsResult = await db.select({ count: count() })
      .from(transactionsTable)
      .where(eq(transactionsTable.status, 'pending'))
      .execute();
    const pending_transactions = pendingTransactionsResult[0].count;

    // Get completed transactions count
    const completedTransactionsResult = await db.select({ count: count() })
      .from(transactionsTable)
      .where(eq(transactionsTable.status, 'completed'))
      .execute();
    const completed_transactions = completedTransactionsResult[0].count;

    // Get failed transactions count
    const failedTransactionsResult = await db.select({ count: count() })
      .from(transactionsTable)
      .where(eq(transactionsTable.status, 'failed'))
      .execute();
    const failed_transactions = failedTransactionsResult[0].count;

    return {
      total_transactions,
      total_revenue,
      pending_transactions,
      completed_transactions,
      failed_transactions
    };
  } catch (error) {
    console.error('Get transaction stats failed:', error);
    throw error;
  }
}

export async function getDashboardSummary(): Promise<{
  userStats: UserStats;
  transactionStats: TransactionStats;
  recentTransactions: any[];
  pendingKyc: number;
}> {
  try {
    // Get user stats
    const userStats = await getUserStats();

    // Get transaction stats
    const transactionStats = await getTransactionStats();

    // Get recent transactions with user and product info
    const recentTransactionResults = await db.select({
      id: transactionsTable.id,
      amount: transactionsTable.amount,
      status: transactionsTable.status,
      created_at: transactionsTable.created_at,
      user_name: usersTable.name,
      user_email: usersTable.email,
      product_name: productsTable.name
    })
      .from(transactionsTable)
      .innerJoin(usersTable, eq(transactionsTable.user_id, usersTable.id))
      .innerJoin(productsTable, eq(transactionsTable.product_id, productsTable.id))
      .orderBy(desc(transactionsTable.created_at))
      .limit(10)
      .execute();

    // Convert numeric fields for recent transactions
    const recentTransactions = recentTransactionResults.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount)
    }));

    // Get pending KYC count
    const pendingKycResult = await db.select({ count: count() })
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.status, 'pending'))
      .execute();
    const pendingKyc = pendingKycResult[0].count;

    return {
      userStats,
      transactionStats,
      recentTransactions,
      pendingKyc
    };
  } catch (error) {
    console.error('Get dashboard summary failed:', error);
    throw error;
  }
}