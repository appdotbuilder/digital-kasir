import { db } from '../db';
import { transactionsTable, usersTable, productsTable } from '../db/schema';
import { type Transaction, type CreateTransactionInput, type TransactionStats } from '../schema';
import { eq, desc, and, sql, count, sum } from 'drizzle-orm';

export async function createTransaction(userId: number, input: CreateTransactionInput): Promise<Transaction> {
  try {
    // 1. Validate user exists and get wallet balance
    const user = await db.select({
      id: usersTable.id,
      wallet_balance: usersTable.wallet_balance,
      is_blocked: usersTable.is_blocked
    })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!user.length) {
      throw new Error('User not found');
    }

    if (user[0].is_blocked) {
      throw new Error('Account is blocked');
    }

    // 2. Validate product exists and get price
    const product = await db.select({
      id: productsTable.id,
      price: productsTable.price,
      is_active: productsTable.is_active
    })
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();

    if (!product.length) {
      throw new Error('Product not found');
    }

    if (!product[0].is_active) {
      throw new Error('Product is not active');
    }

    const productPrice = parseFloat(product[0].price);
    const userBalance = parseFloat(user[0].wallet_balance);

    // 3. Check if user has sufficient balance
    if (userBalance < productPrice) {
      throw new Error('Insufficient wallet balance');
    }

    // 4. Calculate coins earned (1% of transaction amount as coins)
    const coinsEarned = Math.floor(productPrice / 100);

    // 5. Create transaction within a transaction block
    const result = await db.transaction(async (tx) => {
      // Create transaction record
      const transactionResult = await tx.insert(transactionsTable)
        .values({
          user_id: userId,
          product_id: input.product_id,
          target_number: input.target_number,
          amount: productPrice.toString(),
          coins_earned: coinsEarned,
          status: 'pending',
          provider_transaction_id: null
        })
        .returning()
        .execute();

      // Deduct amount from user wallet
      await tx.update(usersTable)
        .set({
          wallet_balance: (userBalance - productPrice).toString(),
          updated_at: new Date()
        })
        .where(eq(usersTable.id, userId))
        .execute();

      return transactionResult[0];
    });

    // Convert numeric fields back to numbers
    return {
      ...result,
      amount: parseFloat(result.amount)
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
}

export async function getUserTransactions(userId: number, limit: number = 50): Promise<Transaction[]> {
  try {
    const results = await db.select({
      id: transactionsTable.id,
      user_id: transactionsTable.user_id,
      product_id: transactionsTable.product_id,
      target_number: transactionsTable.target_number,
      amount: transactionsTable.amount,
      coins_earned: transactionsTable.coins_earned,
      status: transactionsTable.status,
      provider_transaction_id: transactionsTable.provider_transaction_id,
      created_at: transactionsTable.created_at,
      updated_at: transactionsTable.updated_at
    })
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId))
      .orderBy(desc(transactionsTable.created_at))
      .limit(limit)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount)
    }));
  } catch (error) {
    console.error('Get user transactions failed:', error);
    throw error;
  }
}

export async function getTransactionById(transactionId: number, userId: number): Promise<Transaction | null> {
  try {
    const results = await db.select({
      id: transactionsTable.id,
      user_id: transactionsTable.user_id,
      product_id: transactionsTable.product_id,
      target_number: transactionsTable.target_number,
      amount: transactionsTable.amount,
      coins_earned: transactionsTable.coins_earned,
      status: transactionsTable.status,
      provider_transaction_id: transactionsTable.provider_transaction_id,
      created_at: transactionsTable.created_at,
      updated_at: transactionsTable.updated_at
    })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.id, transactionId),
        eq(transactionsTable.user_id, userId)
      ))
      .execute();

    if (!results.length) {
      return null;
    }

    // Convert numeric fields back to numbers
    return {
      ...results[0],
      amount: parseFloat(results[0].amount)
    };
  } catch (error) {
    console.error('Get transaction by ID failed:', error);
    throw error;
  }
}

export async function updateTransactionStatus(transactionId: number, status: string, providerTransactionId?: string): Promise<Transaction> {
  try {
    // Validate transaction exists
    const existingTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    if (!existingTransaction.length) {
      throw new Error('Transaction not found');
    }

    const updateData: any = {
      status: status as any,
      updated_at: new Date()
    };

    if (providerTransactionId) {
      updateData.provider_transaction_id = providerTransactionId;
    }

    // Update transaction within a database transaction
    const result = await db.transaction(async (tx) => {
      const transactionResult = await tx.update(transactionsTable)
        .set(updateData)
        .where(eq(transactionsTable.id, transactionId))
        .returning()
        .execute();

      // If transaction completed, award coins to user
      if (status === 'completed') {
        const transaction = transactionResult[0];
        await tx.update(usersTable)
          .set({
            coins: sql`${usersTable.coins} + ${transaction.coins_earned}`,
            updated_at: new Date()
          })
          .where(eq(usersTable.id, transaction.user_id))
          .execute();
      }

      // If transaction failed, refund the amount
      if (status === 'failed' || status === 'cancelled') {
        const transaction = transactionResult[0];
        await tx.update(usersTable)
          .set({
            wallet_balance: sql`${usersTable.wallet_balance} + ${transaction.amount}`,
            updated_at: new Date()
          })
          .where(eq(usersTable.id, transaction.user_id))
          .execute();
      }

      return transactionResult[0];
    });

    // Convert numeric fields back to numbers
    return {
      ...result,
      amount: parseFloat(result.amount)
    };
  } catch (error) {
    console.error('Update transaction status failed:', error);
    throw error;
  }
}

export async function getAllTransactions(limit: number = 100): Promise<Transaction[]> {
  try {
    const results = await db.select({
      id: transactionsTable.id,
      user_id: transactionsTable.user_id,
      product_id: transactionsTable.product_id,
      target_number: transactionsTable.target_number,
      amount: transactionsTable.amount,
      coins_earned: transactionsTable.coins_earned,
      status: transactionsTable.status,
      provider_transaction_id: transactionsTable.provider_transaction_id,
      created_at: transactionsTable.created_at,
      updated_at: transactionsTable.updated_at
    })
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.created_at))
      .limit(limit)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount)
    }));
  } catch (error) {
    console.error('Get all transactions failed:', error);
    throw error;
  }
}

export async function getTransactionStats(): Promise<TransactionStats> {
  try {
    // Get transaction counts by status
    const statsResult = await db.select({
      total_transactions: count(transactionsTable.id),
      total_revenue: sum(transactionsTable.amount),
      pending_count: sql<number>`COUNT(CASE WHEN ${transactionsTable.status} = 'pending' THEN 1 END)`,
      completed_count: sql<number>`COUNT(CASE WHEN ${transactionsTable.status} = 'completed' THEN 1 END)`,
      failed_count: sql<number>`COUNT(CASE WHEN ${transactionsTable.status} = 'failed' THEN 1 END)`
    })
      .from(transactionsTable)
      .execute();

    const stats = statsResult[0];

    return {
      total_transactions: Number(stats.total_transactions) || 0,
      total_revenue: stats.total_revenue ? parseFloat(stats.total_revenue.toString()) : 0,
      pending_transactions: Number(stats.pending_count) || 0,
      completed_transactions: Number(stats.completed_count) || 0,
      failed_transactions: Number(stats.failed_count) || 0
    };
  } catch (error) {
    console.error('Get transaction stats failed:', error);
    throw error;
  }
}