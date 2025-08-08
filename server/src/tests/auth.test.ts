import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type LoginInput, type ResetPasswordInput } from '../schema';
import { register, login, resetPassword, logout } from '../handlers/auth';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync, randomBytes } from 'crypto';

// Helper function to hash password (same as in handler)
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

describe('Auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('register', () => {
    const testInput: RegisterInput = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      password: 'password123',
      referral_code: 'REF12345678'
    };

    it('should register a new user successfully', async () => {
      const result = await register(testInput);

      // Verify response structure
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      // Verify user data
      expect(result.user.name).toEqual('John Doe');
      expect(result.user.email).toEqual('john@example.com');
      expect(result.user.phone).toEqual('+1234567890');
      expect(result.user.role).toEqual('user');
      expect(result.user.kyc_status).toEqual('not_submitted');
      expect(result.user.wallet_balance).toEqual(0);
      expect(typeof result.user.wallet_balance).toBe('number');
      expect(result.user.coins).toEqual(0);
      expect(result.user.is_blocked).toEqual(false);
      expect(result.user.referral_code).toBeDefined();
      expect(result.user.referral_code.startsWith('REF')).toBe(true);
      expect(result.user.id).toBeDefined();
      expect(result.user.created_at).toBeInstanceOf(Date);
      expect(result.user.updated_at).toBeInstanceOf(Date);
    });

    it('should save user to database with hashed password', async () => {
      const result = await register(testInput);

      // Query database directly
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.user.id))
        .execute();

      expect(users).toHaveLength(1);
      const dbUser = users[0];

      expect(dbUser.name).toEqual('John Doe');
      expect(dbUser.email).toEqual('john@example.com');
      expect(dbUser.phone).toEqual('+1234567890');
      expect(dbUser.password_hash).not.toEqual('password123');
      expect(dbUser.password_hash.includes(':')).toBe(true); // salt:hash format
      expect(parseFloat(dbUser.wallet_balance)).toEqual(0);
      expect(dbUser.coins).toEqual(0);
      expect(dbUser.is_blocked).toEqual(false);
    });

    it('should handle referral code correctly when referrer exists', async () => {
      // Create referrer user first
      const referrerResult = await register({
        name: 'Referrer',
        email: 'referrer@example.com',
        password: 'password123'
      });

      // Register new user with valid referral code
      const newUserResult = await register({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
        referral_code: referrerResult.user.referral_code
      });

      expect(newUserResult.user.referred_by).toEqual(referrerResult.user.referral_code);
    });

    it('should handle invalid referral code gracefully', async () => {
      const result = await register({
        ...testInput,
        referral_code: 'INVALID123'
      });

      expect(result.user.referred_by).toBeNull();
    });

    it('should register user without phone number', async () => {
      const inputWithoutPhone = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123'
      };

      const result = await register(inputWithoutPhone);

      expect(result.user.phone).toBeNull();
      expect(result.user.name).toEqual('Jane Doe');
      expect(result.user.email).toEqual('jane@example.com');
    });

    it('should throw error for duplicate email', async () => {
      await register(testInput);

      await expect(register(testInput)).rejects.toThrow(/already exists/i);
    });

    it('should generate unique referral codes', async () => {
      const result1 = await register(testInput);
      const result2 = await register({
        ...testInput,
        email: 'another@example.com'
      });

      expect(result1.user.referral_code).not.toEqual(result2.user.referral_code);
      expect(result1.user.referral_code.startsWith('REF')).toBe(true);
      expect(result2.user.referral_code.startsWith('REF')).toBe(true);
    });
  });

  describe('login', () => {
    const testUser = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123'
    };

    let registeredUser: any;

    beforeEach(async () => {
      registeredUser = await register(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const loginInput: LoginInput = {
        email: 'john@example.com',
        password: 'password123'
      };

      const result = await login(loginInput);

      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user.email).toEqual('john@example.com');
      expect(result.user.name).toEqual('John Doe');
      expect(typeof result.user.wallet_balance).toBe('number');
    });

    it('should throw error for non-existent email', async () => {
      const loginInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await expect(login(loginInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for incorrect password', async () => {
      const loginInput: LoginInput = {
        email: 'john@example.com',
        password: 'wrongpassword'
      };

      await expect(login(loginInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for blocked user', async () => {
      // Block the user
      await db.update(usersTable)
        .set({ is_blocked: true })
        .where(eq(usersTable.id, registeredUser.user.id))
        .execute();

      const loginInput: LoginInput = {
        email: 'john@example.com',
        password: 'password123'
      };

      await expect(login(loginInput)).rejects.toThrow(/blocked/i);
    });
  });

  describe('resetPassword', () => {
    const testUser = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123'
    };

    let registeredUser: any;

    beforeEach(async () => {
      registeredUser = await register(testUser);
    });

    it('should return success for existing user', async () => {
      const resetInput: ResetPasswordInput = {
        email: 'john@example.com'
      };

      const result = await resetPassword(resetInput);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });

    it('should return success for non-existent email (security)', async () => {
      const resetInput: ResetPasswordInput = {
        email: 'nonexistent@example.com'
      };

      const result = await resetPassword(resetInput);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should throw error for blocked user', async () => {
      // Block the user
      await db.update(usersTable)
        .set({ is_blocked: true })
        .where(eq(usersTable.id, registeredUser.user.id))
        .execute();

      const resetInput: ResetPasswordInput = {
        email: 'john@example.com'
      };

      await expect(resetPassword(resetInput)).rejects.toThrow(/blocked/i);
    });
  });

  describe('logout', () => {
    it('should return success', async () => {
      const result = await logout();

      expect(result.success).toBe(true);
    });
  });
});