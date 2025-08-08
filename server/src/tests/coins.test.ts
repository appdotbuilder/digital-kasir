import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coinExchangesTable } from '../db/schema';
import { type ExchangeCoinsInput } from '../schema';
import { 
  exchangeCoinsToBalance, 
  getUserCoinHistory, 
  getCoinExchangeRate, 
  addCoinsToUser 
} from '../handlers/coins';
import { eq } from 'drizzle-orm';

describe('Coin Handlers', () => {
  let testUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user with coins
    const userResult = await db.insert(usersTable)
      .values({
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        password_hash: 'hashedpassword',
        role: 'user',
        kyc_status: 'not_submitted',
        wallet_balance: '100.00',
        coins: 500,
        referral_code: 'TEST123',
        referred_by: null,
        is_blocked: false
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;
  });

  afterEach(resetDB);

  describe('exchangeCoinsToBalance', () => {
    const validExchangeInput: ExchangeCoinsInput = {
      coins: 200
    };

    it('should exchange coins to balance successfully', async () => {
      const result = await exchangeCoinsToBalance(testUserId, validExchangeInput);

      // Verify exchange record
      expect(result.user_id).toBe(testUserId);
      expect(result.coins_used).toBe(200);
      expect(result.balance_received).toBe(20); // 200 * 0.1 = 20
      expect(result.exchange_rate).toBe(0.1);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify user's updated coins and balance
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      expect(users[0].coins).toBe(300); // 500 - 200 = 300
      expect(parseFloat(users[0].wallet_balance)).toBe(120); // 100 + 20 = 120
    });

    it('should save exchange record to database', async () => {
      const result = await exchangeCoinsToBalance(testUserId, validExchangeInput);

      const exchanges = await db.select()
        .from(coinExchangesTable)
        .where(eq(coinExchangesTable.id, result.id))
        .execute();

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].user_id).toBe(testUserId);
      expect(exchanges[0].coins_used).toBe(200);
      expect(parseFloat(exchanges[0].balance_received)).toBe(20);
      expect(parseFloat(exchanges[0].exchange_rate)).toBe(0.1);
    });

    it('should reject exchange below minimum coins', async () => {
      const invalidInput: ExchangeCoinsInput = { coins: 50 }; // Below 100 minimum

      await expect(exchangeCoinsToBalance(testUserId, invalidInput))
        .rejects.toThrow(/minimum.*100.*coins/i);
    });

    it('should reject exchange with insufficient coins', async () => {
      const excessiveInput: ExchangeCoinsInput = { coins: 1000 }; // User only has 500

      await expect(exchangeCoinsToBalance(testUserId, excessiveInput))
        .rejects.toThrow(/insufficient coins/i);
    });

    it('should reject exchange for non-existent user', async () => {
      const nonExistentUserId = 99999;

      await expect(exchangeCoinsToBalance(nonExistentUserId, validExchangeInput))
        .rejects.toThrow(/user not found/i);
    });

    it('should handle edge case of exactly minimum coins', async () => {
      const minimumInput: ExchangeCoinsInput = { coins: 100 };
      
      const result = await exchangeCoinsToBalance(testUserId, minimumInput);

      expect(result.coins_used).toBe(100);
      expect(result.balance_received).toBe(10); // 100 * 0.1 = 10

      // Verify user balance updated correctly
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      expect(users[0].coins).toBe(400); // 500 - 100 = 400
      expect(parseFloat(users[0].wallet_balance)).toBe(110); // 100 + 10 = 110
    });
  });

  describe('getUserCoinHistory', () => {
    it('should return empty history for user with no exchanges', async () => {
      const history = await getUserCoinHistory(testUserId);

      expect(history).toHaveLength(0);
    });

    it('should return user coin exchange history ordered by date', async () => {
      // Create multiple exchanges
      await exchangeCoinsToBalance(testUserId, { coins: 100 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for different timestamps
      await exchangeCoinsToBalance(testUserId, { coins: 150 });

      const history = await getUserCoinHistory(testUserId);

      expect(history).toHaveLength(2);
      // Should be ordered by created_at DESC (newest first)
      expect(history[0].coins_used).toBe(150); // Most recent
      expect(history[1].coins_used).toBe(100); // Older
      
      // Verify all fields are properly converted
      history.forEach(exchange => {
        expect(typeof exchange.balance_received).toBe('number');
        expect(typeof exchange.exchange_rate).toBe('number');
        expect(exchange.user_id).toBe(testUserId);
        expect(exchange.created_at).toBeInstanceOf(Date);
      });
    });

    it('should only return exchanges for specified user', async () => {
      // Create another user
      const anotherUserResult = await db.insert(usersTable)
        .values({
          name: 'Another User',
          email: 'another@example.com',
          password_hash: 'hashedpassword',
          role: 'user',
          kyc_status: 'not_submitted',
          wallet_balance: '50.00',
          coins: 300,
          referral_code: 'ANOTHER123',
          is_blocked: false
        })
        .returning()
        .execute();

      const anotherUserId = anotherUserResult[0].id;

      // Create exchanges for both users
      await exchangeCoinsToBalance(testUserId, { coins: 100 });
      await exchangeCoinsToBalance(anotherUserId, { coins: 200 });

      const testUserHistory = await getUserCoinHistory(testUserId);
      const anotherUserHistory = await getUserCoinHistory(anotherUserId);

      expect(testUserHistory).toHaveLength(1);
      expect(testUserHistory[0].user_id).toBe(testUserId);
      expect(testUserHistory[0].coins_used).toBe(100);

      expect(anotherUserHistory).toHaveLength(1);
      expect(anotherUserHistory[0].user_id).toBe(anotherUserId);
      expect(anotherUserHistory[0].coins_used).toBe(200);
    });
  });

  describe('getCoinExchangeRate', () => {
    it('should return current exchange rate and minimum coins', async () => {
      const rateInfo = await getCoinExchangeRate();

      expect(rateInfo.rate).toBe(0.1);
      expect(rateInfo.minimum_coins).toBe(100);
      expect(typeof rateInfo.rate).toBe('number');
      expect(typeof rateInfo.minimum_coins).toBe('number');
    });
  });

  describe('addCoinsToUser', () => {
    it('should add coins to user successfully', async () => {
      const result = await addCoinsToUser(testUserId, 200, 'Transaction reward');

      expect(result.success).toBe(true);

      // Verify user's coins were updated
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      expect(users[0].coins).toBe(700); // 500 + 200 = 700
    });

    it('should reject adding zero or negative coins', async () => {
      await expect(addCoinsToUser(testUserId, 0, 'Invalid'))
        .rejects.toThrow(/coins must be positive/i);

      await expect(addCoinsToUser(testUserId, -50, 'Invalid'))
        .rejects.toThrow(/coins must be positive/i);
    });

    it('should reject adding coins to non-existent user', async () => {
      const nonExistentUserId = 99999;

      await expect(addCoinsToUser(nonExistentUserId, 100, 'Reward'))
        .rejects.toThrow(/user not found/i);
    });

    it('should handle large coin amounts', async () => {
      const result = await addCoinsToUser(testUserId, 10000, 'Large reward');

      expect(result.success).toBe(true);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      expect(users[0].coins).toBe(10500); // 500 + 10000 = 10500
    });

    it('should preserve other user fields when adding coins', async () => {
      // Get original user data
      const originalUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();
      
      const originalUser = originalUsers[0];
      
      await addCoinsToUser(testUserId, 150, 'Referral bonus');

      // Verify only coins and updated_at changed
      const updatedUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      const updatedUser = updatedUsers[0];

      expect(updatedUser.coins).toBe(650); // 500 + 150 = 650
      expect(updatedUser.name).toBe(originalUser.name);
      expect(updatedUser.email).toBe(originalUser.email);
      expect(updatedUser.wallet_balance).toBe(originalUser.wallet_balance);
      expect(updatedUser.role).toBe(originalUser.role);
      expect(updatedUser.updated_at.getTime()).toBeGreaterThan(originalUser.updated_at.getTime());
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple coin operations correctly', async () => {
      // Add coins first
      await addCoinsToUser(testUserId, 500, 'Bonus');
      
      // Exchange some coins
      await exchangeCoinsToBalance(testUserId, { coins: 300 });
      
      // Add more coins
      await addCoinsToUser(testUserId, 200, 'Another bonus');
      
      // Exchange again
      await exchangeCoinsToBalance(testUserId, { coins: 400 });

      // Verify final state
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      // Initial: 500, +500 = 1000, -300 = 700, +200 = 900, -400 = 500
      expect(users[0].coins).toBe(500);
      
      // Initial balance: 100, +30 (300*0.1) = 130, +40 (400*0.1) = 170
      expect(parseFloat(users[0].wallet_balance)).toBe(170);

      // Verify exchange history
      const history = await getUserCoinHistory(testUserId);
      expect(history).toHaveLength(2);
      expect(history[0].coins_used).toBe(400); // Most recent
      expect(history[1].coins_used).toBe(300); // Older
    });
  });
});