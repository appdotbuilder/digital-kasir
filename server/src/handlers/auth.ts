import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type LoginInput, type ResetPasswordInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

// Helper function to hash password using Node.js built-in crypto
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Helper function to verify password
function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Helper function to generate unique referral code
function generateReferralCode(): string {
  return 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Helper function to generate JWT-like token (simple implementation)
function generateToken(userId: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { userId, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) }; // 7 days
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const secret = process.env['JWT_SECRET'] || 'fallback-secret-for-development';
  const signature = createHash('sha256')
    .update(`${encodedHeader}.${encodedPayload}.${secret}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = hashPassword(input.password);

    // Generate unique referral code
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      referralCode = generateReferralCode();
      const existing = await db.select()
        .from(usersTable)
        .where(eq(usersTable.referral_code, referralCode))
        .execute();
      
      isUnique = existing.length === 0;
      attempts++;
    } while (!isUnique && attempts < maxAttempts);

    if (!isUnique) {
      throw new Error('Failed to generate unique referral code');
    }

    // Validate referral code if provided
    let referredBy: string | null = null;
    if (input.referral_code) {
      const referrer = await db.select()
        .from(usersTable)
        .where(eq(usersTable.referral_code, input.referral_code))
        .execute();
      
      if (referrer.length > 0) {
        referredBy = input.referral_code;
      }
    }

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        password_hash: passwordHash,
        role: 'user',
        kyc_status: 'not_submitted',
        wallet_balance: '0',
        coins: 0,
        referral_code: referralCode,
        referred_by: referredBy,
        is_blocked: false
      })
      .returning()
      .execute();

    const newUser = result[0];

    // Generate JWT token
    const token = generateToken(newUser.id);

    // Return user data with converted numeric fields
    return {
      user: {
        ...newUser,
        wallet_balance: parseFloat(newUser.wallet_balance)
      },
      token
    };
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check if user is blocked
    if (user.is_blocked) {
      throw new Error('Account has been blocked');
    }

    // Verify password
    const isPasswordValid = verifyPassword(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data with converted numeric fields
    return {
      user: {
        ...user,
        wallet_balance: parseFloat(user.wallet_balance)
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ success: boolean; message: string }> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      // Return success even if user doesn't exist for security reasons
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      };
    }

    const user = users[0];

    // Check if user is blocked
    if (user.is_blocked) {
      throw new Error('Account has been blocked');
    }

    // In a real implementation, you would:
    // 1. Generate a secure reset token
    // 2. Store the token with expiration in database
    // 3. Send email with reset link
    
    // For now, we'll just return success
    return {
      success: true,
      message: 'Password reset link has been sent to your email'
    };
  } catch (error) {
    console.error('Password reset failed:', error);
    throw error;
  }
}

export async function logout(): Promise<{ success: boolean }> {
  try {
    // In a real implementation, you would:
    // 1. Add the JWT token to a blacklist
    // 2. Or invalidate the token in some other way
    
    // For now, we'll just return success
    // The client should remove the token from storage
    return {
      success: true
    };
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
}