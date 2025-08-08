import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq, count, desc } from 'drizzle-orm';
import { type User } from '../schema';

export async function generateReferralCode(userId: number): Promise<string> {
  try {
    // First verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    let isUnique = false;
    let code = '';
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique referral code with retry logic
    while (!isUnique && attempts < maxAttempts) {
      // Generate random 8-character code with user ID prefix for uniqueness
      const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
      code = `REF${userId}${randomPart}`;

      // Check if code already exists
      const existingUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.referral_code, code))
        .limit(1)
        .execute();

      if (existingUser.length === 0) {
        isUnique = true;
        
        // Update user with new referral code
        const updateResult = await db.update(usersTable)
          .set({ referral_code: code })
          .where(eq(usersTable.id, userId))
          .returning()
          .execute();

        if (updateResult.length === 0) {
          throw new Error('Failed to update user referral code');
        }
      }

      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique referral code after multiple attempts');
    }

    return code;
  } catch (error) {
    console.error('Referral code generation failed:', error);
    throw error;
  }
}

export async function getReferralStats(userId: number): Promise<{
  referral_code: string;
  total_referrals: number;
  coins_earned_from_referrals: number;
  recent_referrals: User[];
}> {
  try {
    // Get user's referral code
    const user = await db.select({ referral_code: usersTable.referral_code })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const referralCode = user[0].referral_code;

    // Count total referrals
    const totalReferralsResult = await db.select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.referred_by, referralCode))
      .execute();

    const totalReferrals = totalReferralsResult[0].count;

    // Calculate coins earned from referrals (50 coins per referral)
    const coinsEarned = totalReferrals * 50;

    // Get recent referrals (last 5)
    const recentReferralsResults = await db.select()
      .from(usersTable)
      .where(eq(usersTable.referred_by, referralCode))
      .orderBy(desc(usersTable.created_at))
      .limit(5)
      .execute();

    // Convert numeric fields back to numbers
    const recentReferrals = recentReferralsResults.map(user => ({
      ...user,
      wallet_balance: parseFloat(user.wallet_balance)
    }));

    return {
      referral_code: referralCode,
      total_referrals: totalReferrals,
      coins_earned_from_referrals: coinsEarned,
      recent_referrals: recentReferrals
    };
  } catch (error) {
    console.error('Get referral stats failed:', error);
    throw error;
  }
}

export async function processReferralReward(referrerCode: string, newUserId: number): Promise<{ success: boolean; coins_awarded: number }> {
  try {
    // Find referrer by referral code
    const referrer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.referral_code, referrerCode))
      .limit(1)
      .execute();

    if (referrer.length === 0) {
      return { success: false, coins_awarded: 0 };
    }

    const referrerUser = referrer[0];

    // Check if referrer is not blocked
    if (referrerUser.is_blocked) {
      return { success: false, coins_awarded: 0 };
    }

    const coinsToAward = 50; // Standard referral reward

    // Award coins to referrer
    await db.update(usersTable)
      .set({ 
        coins: referrerUser.coins + coinsToAward,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, referrerUser.id))
      .execute();

    // Update new user with referrer code
    await db.update(usersTable)
      .set({ 
        referred_by: referrerCode,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, newUserId))
      .execute();

    return {
      success: true,
      coins_awarded: coinsToAward
    };
  } catch (error) {
    console.error('Process referral reward failed:', error);
    throw error;
  }
}

export async function validateReferralCode(code: string): Promise<{ valid: boolean; referrer?: User }> {
  try {
    // Find user by referral code
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.referral_code, code))
      .limit(1)
      .execute();

    if (result.length === 0) {
      return { valid: false };
    }

    const referrer = result[0];

    // Check if user is not blocked
    if (referrer.is_blocked) {
      return { valid: false };
    }

    // Convert numeric fields back to numbers
    const referrerWithNumbers = {
      ...referrer,
      wallet_balance: parseFloat(referrer.wallet_balance)
    };

    return {
      valid: true,
      referrer: referrerWithNumbers
    };
  } catch (error) {
    console.error('Validate referral code failed:', error);
    throw error;
  }
}