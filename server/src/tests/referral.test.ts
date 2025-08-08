import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  generateReferralCode, 
  getReferralStats, 
  processReferralReward, 
  validateReferralCode 
} from '../handlers/referral';

describe('Referral Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('generateReferralCode', () => {
    it('should generate a unique referral code for user', async () => {
      // Create test user first
      const userResult = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'TEMP123' // Temporary code to be replaced
        })
        .returning()
        .execute();

      const userId = userResult[0].id;

      const referralCode = await generateReferralCode(userId);

      // Validate code format
      expect(referralCode).toMatch(/^REF\d+[A-Z0-9]{6}$/);
      expect(referralCode).toContain(`REF${userId}`);

      // Verify code was saved to database
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1)
        .execute();

      expect(updatedUser[0].referral_code).toEqual(referralCode);
    });

    it('should generate unique codes for different users', async () => {
      // Create two test users
      const user1Result = await db.insert(usersTable)
        .values({
          name: 'User One',
          email: 'user1@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'TEMP1'
        })
        .returning()
        .execute();

      const user2Result = await db.insert(usersTable)
        .values({
          name: 'User Two',
          email: 'user2@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'TEMP2'
        })
        .returning()
        .execute();

      const code1 = await generateReferralCode(user1Result[0].id);
      const code2 = await generateReferralCode(user2Result[0].id);

      expect(code1).not.toEqual(code2);
      expect(code1).toContain(`REF${user1Result[0].id}`);
      expect(code2).toContain(`REF${user2Result[0].id}`);
    });

    it('should handle non-existent user', async () => {
      await expect(generateReferralCode(999999)).rejects.toThrow();
    });
  });

  describe('getReferralStats', () => {
    it('should return referral stats for user with no referrals', async () => {
      const userResult = await db.insert(usersTable)
        .values({
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REF123456'
        })
        .returning()
        .execute();

      const stats = await getReferralStats(userResult[0].id);

      expect(stats.referral_code).toEqual('REF123456');
      expect(stats.total_referrals).toEqual(0);
      expect(stats.coins_earned_from_referrals).toEqual(0);
      expect(stats.recent_referrals).toHaveLength(0);
    });

    it('should return correct stats for user with referrals', async () => {
      // Create referrer
      const referrerResult = await db.insert(usersTable)
        .values({
          name: 'Referrer',
          email: 'referrer@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REF123456'
        })
        .returning()
        .execute();

      // Create referred users
      const referredUsers = [];
      for (let i = 1; i <= 3; i++) {
        const referred = await db.insert(usersTable)
          .values({
            name: `Referred User ${i}`,
            email: `referred${i}@example.com`,
            password_hash: 'hashedpassword',
            referral_code: `REF${i}ABCDEF`,
            referred_by: 'REF123456'
          })
          .returning()
          .execute();
        
        referredUsers.push(referred[0]);
      }

      const stats = await getReferralStats(referrerResult[0].id);

      expect(stats.referral_code).toEqual('REF123456');
      expect(stats.total_referrals).toEqual(3);
      expect(stats.coins_earned_from_referrals).toEqual(150); // 3 * 50 coins
      expect(stats.recent_referrals).toHaveLength(3);
      
      // Verify recent referrals are sorted by creation date (most recent first)
      expect(stats.recent_referrals[0].name).toEqual('Referred User 3');
      expect(stats.recent_referrals[1].name).toEqual('Referred User 2');
      expect(stats.recent_referrals[2].name).toEqual('Referred User 1');
    });

    it('should limit recent referrals to 5', async () => {
      // Create referrer
      const referrerResult = await db.insert(usersTable)
        .values({
          name: 'Referrer',
          email: 'referrer@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REF123456'
        })
        .returning()
        .execute();

      // Create 7 referred users
      for (let i = 1; i <= 7; i++) {
        await db.insert(usersTable)
          .values({
            name: `Referred User ${i}`,
            email: `referred${i}@example.com`,
            password_hash: 'hashedpassword',
            referral_code: `REF${i}ABCDEF`,
            referred_by: 'REF123456'
          })
          .execute();
      }

      const stats = await getReferralStats(referrerResult[0].id);

      expect(stats.total_referrals).toEqual(7);
      expect(stats.coins_earned_from_referrals).toEqual(350); // 7 * 50 coins
      expect(stats.recent_referrals).toHaveLength(5); // Limited to 5
    });

    it('should handle non-existent user', async () => {
      await expect(getReferralStats(999999)).rejects.toThrow(/User not found/);
    });
  });

  describe('processReferralReward', () => {
    it('should award coins to referrer and link new user', async () => {
      // Create referrer with initial coins
      const referrerResult = await db.insert(usersTable)
        .values({
          name: 'Referrer',
          email: 'referrer@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REF123456',
          coins: 100
        })
        .returning()
        .execute();

      // Create new user
      const newUserResult = await db.insert(usersTable)
        .values({
          name: 'New User',
          email: 'newuser@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REFNEW123'
        })
        .returning()
        .execute();

      const result = await processReferralReward('REF123456', newUserResult[0].id);

      expect(result.success).toBe(true);
      expect(result.coins_awarded).toEqual(50);

      // Verify referrer got coins
      const updatedReferrer = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, referrerResult[0].id))
        .limit(1)
        .execute();

      expect(updatedReferrer[0].coins).toEqual(150); // 100 + 50

      // Verify new user is linked to referrer
      const updatedNewUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, newUserResult[0].id))
        .limit(1)
        .execute();

      expect(updatedNewUser[0].referred_by).toEqual('REF123456');
    });

    it('should fail for invalid referral code', async () => {
      // Create new user
      const newUserResult = await db.insert(usersTable)
        .values({
          name: 'New User',
          email: 'newuser@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REFNEW123'
        })
        .returning()
        .execute();

      const result = await processReferralReward('INVALID_CODE', newUserResult[0].id);

      expect(result.success).toBe(false);
      expect(result.coins_awarded).toEqual(0);
    });

    it('should fail for blocked referrer', async () => {
      // Create blocked referrer
      const referrerResult = await db.insert(usersTable)
        .values({
          name: 'Blocked Referrer',
          email: 'blocked@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REF123456',
          coins: 100,
          is_blocked: true
        })
        .returning()
        .execute();

      // Create new user
      const newUserResult = await db.insert(usersTable)
        .values({
          name: 'New User',
          email: 'newuser@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REFNEW123'
        })
        .returning()
        .execute();

      const result = await processReferralReward('REF123456', newUserResult[0].id);

      expect(result.success).toBe(false);
      expect(result.coins_awarded).toEqual(0);

      // Verify referrer didn't get coins
      const updatedReferrer = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, referrerResult[0].id))
        .limit(1)
        .execute();

      expect(updatedReferrer[0].coins).toEqual(100); // No change
    });
  });

  describe('validateReferralCode', () => {
    it('should validate existing referral code', async () => {
      const referrerResult = await db.insert(usersTable)
        .values({
          name: 'Valid Referrer',
          email: 'valid@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REF123456',
          wallet_balance: '250.50'
        })
        .returning()
        .execute();

      const result = await validateReferralCode('REF123456');

      expect(result.valid).toBe(true);
      expect(result.referrer).toBeDefined();
      expect(result.referrer!.name).toEqual('Valid Referrer');
      expect(result.referrer!.email).toEqual('valid@example.com');
      expect(result.referrer!.wallet_balance).toEqual(250.50); // Numeric conversion
      expect(typeof result.referrer!.wallet_balance).toEqual('number');
    });

    it('should reject invalid referral code', async () => {
      const result = await validateReferralCode('INVALID_CODE');

      expect(result.valid).toBe(false);
      expect(result.referrer).toBeUndefined();
    });

    it('should reject referral code from blocked user', async () => {
      await db.insert(usersTable)
        .values({
          name: 'Blocked Referrer',
          email: 'blocked@example.com',
          password_hash: 'hashedpassword',
          referral_code: 'REF123456',
          is_blocked: true
        })
        .execute();

      const result = await validateReferralCode('REF123456');

      expect(result.valid).toBe(false);
      expect(result.referrer).toBeUndefined();
    });
  });
});