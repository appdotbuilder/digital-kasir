import { db } from '../db';
import { usersTable, coinExchangesTable } from '../db/schema';
import { type CoinExchange, type ExchangeCoinsInput } from '../schema';
import { eq, desc } from 'drizzle-orm';

const EXCHANGE_RATE = 0.1; // 1 coin = 0.1 balance units
const MINIMUM_COINS = 100; // Minimum 100 coins to exchange

export async function exchangeCoinsToBalance(userId: number, input: ExchangeCoinsInput): Promise<CoinExchange> {
  try {
    // Validate minimum coins requirement
    if (input.coins < MINIMUM_COINS) {
      throw new Error(`Minimum ${MINIMUM_COINS} coins required for exchange`);
    }

    // Get user's current coins
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    if (user.coins < input.coins) {
      throw new Error('Insufficient coins');
    }

    const balanceReceived = input.coins * EXCHANGE_RATE;

    // Start transaction: update user coins/balance and create exchange record
    const newCoins = user.coins - input.coins;
    const newBalance = parseFloat(user.wallet_balance) + balanceReceived;

    // Update user's coins and wallet balance
    await db.update(usersTable)
      .set({
        coins: newCoins,
        wallet_balance: newBalance.toString(),
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    // Create coin exchange record
    const exchangeResult = await db.insert(coinExchangesTable)
      .values({
        user_id: userId,
        coins_used: input.coins,
        balance_received: balanceReceived.toString(),
        exchange_rate: EXCHANGE_RATE.toString()
      })
      .returning()
      .execute();

    const exchange = exchangeResult[0];
    return {
      ...exchange,
      balance_received: parseFloat(exchange.balance_received),
      exchange_rate: parseFloat(exchange.exchange_rate)
    };
  } catch (error) {
    console.error('Coin exchange failed:', error);
    throw error;
  }
}

export async function getUserCoinHistory(userId: number): Promise<CoinExchange[]> {
  try {
    const results = await db.select()
      .from(coinExchangesTable)
      .where(eq(coinExchangesTable.user_id, userId))
      .orderBy(desc(coinExchangesTable.created_at))
      .execute();

    return results.map(result => ({
      ...result,
      balance_received: parseFloat(result.balance_received),
      exchange_rate: parseFloat(result.exchange_rate)
    }));
  } catch (error) {
    console.error('Failed to get coin history:', error);
    throw error;
  }
}

export async function getCoinExchangeRate(): Promise<{ rate: number; minimum_coins: number }> {
  return {
    rate: EXCHANGE_RATE,
    minimum_coins: MINIMUM_COINS
  };
}

export async function addCoinsToUser(userId: number, coins: number, reason: string): Promise<{ success: boolean }> {
  try {
    if (coins <= 0) {
      throw new Error('Coins must be positive');
    }

    // Get user's current coins
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    const newCoins = user.coins + coins;

    // Update user's coins
    await db.update(usersTable)
      .set({
        coins: newCoins,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to add coins to user:', error);
    throw error;
  }
}