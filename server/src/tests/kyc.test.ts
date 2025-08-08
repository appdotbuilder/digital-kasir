import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, kycDocumentsTable } from '../db/schema';
import { type SubmitKycInput, type ReviewKycInput } from '../schema';
import { submitKyc, getKycStatus, getPendingKycRequests, reviewKyc } from '../handlers/kyc';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '1234567890',
  password_hash: 'hashed_password',
  referral_code: 'TEST123'
};

const testAdmin = {
  name: 'Admin User',
  email: 'admin@example.com',
  password_hash: 'admin_password',
  role: 'admin' as const,
  referral_code: 'ADMIN123'
};

const testKycInput: SubmitKycInput = {
  id_card_url: 'https://example.com/id-card.jpg',
  selfie_url: 'https://example.com/selfie.jpg'
};

describe('KYC Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('submitKyc', () => {
    it('should submit KYC documents successfully', async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const result = await submitKyc(userId, testKycInput);

      // Verify KYC document creation
      expect(result.user_id).toBe(userId);
      expect(result.id_card_url).toBe(testKycInput.id_card_url);
      expect(result.selfie_url).toBe(testKycInput.selfie_url);
      expect(result.status).toBe('pending');
      expect(result.rejection_reason).toBeNull();
      expect(result.submitted_at).toBeInstanceOf(Date);
      expect(result.reviewed_at).toBeNull();
      expect(result.reviewed_by).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should update user KYC status to pending', async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      await submitKyc(userId, testKycInput);

      // Verify user's KYC status was updated
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      expect(updatedUser[0].kyc_status).toBe('pending');
    });

    it('should save KYC document to database', async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const result = await submitKyc(userId, testKycInput);

      // Verify database record
      const kycDocs = await db.select()
        .from(kycDocumentsTable)
        .where(eq(kycDocumentsTable.id, result.id))
        .execute();

      expect(kycDocs).toHaveLength(1);
      expect(kycDocs[0].user_id).toBe(userId);
      expect(kycDocs[0].id_card_url).toBe(testKycInput.id_card_url);
      expect(kycDocs[0].selfie_url).toBe(testKycInput.selfie_url);
      expect(kycDocs[0].status).toBe('pending');
    });

    it('should throw error for non-existent user', async () => {
      const nonExistentUserId = 99999;

      await expect(submitKyc(nonExistentUserId, testKycInput))
        .rejects.toThrow(/user not found/i);
    });
  });

  describe('getKycStatus', () => {
    it('should return KYC document for existing user', async () => {
      // Create test user and submit KYC
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const submittedKyc = await submitKyc(userId, testKycInput);

      // Get KYC status
      const result = await getKycStatus(userId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(submittedKyc.id);
      expect(result!.user_id).toBe(userId);
      expect(result!.status).toBe('pending');
    });

    it('should return null for user without KYC documents', async () => {
      // Create test user without KYC
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const result = await getKycStatus(userId);

      expect(result).toBeNull();
    });

    it('should return latest KYC document when multiple exist', async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      // Submit first KYC
      await submitKyc(userId, testKycInput);

      // Wait a bit and submit second KYC
      await new Promise(resolve => setTimeout(resolve, 10));
      const secondKyc = await submitKyc(userId, {
        ...testKycInput,
        id_card_url: 'https://example.com/id-card-2.jpg'
      });

      const result = await getKycStatus(userId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(secondKyc.id);
      expect(result!.id_card_url).toBe('https://example.com/id-card-2.jpg');
    });
  });

  describe('getPendingKycRequests', () => {
    it('should return all pending KYC requests', async () => {
      // Create multiple users with pending KYC
      const user1 = await db.insert(usersTable)
        .values({ ...testUser, email: 'user1@test.com', referral_code: 'USER1' })
        .returning()
        .execute();
      const user2 = await db.insert(usersTable)
        .values({ ...testUser, email: 'user2@test.com', referral_code: 'USER2' })
        .returning()
        .execute();

      await submitKyc(user1[0].id, testKycInput);
      await submitKyc(user2[0].id, testKycInput);

      const result = await getPendingKycRequests();

      expect(result).toHaveLength(2);
      expect(result.every(doc => doc.status === 'pending')).toBe(true);
    });

    it('should return empty array when no pending requests', async () => {
      const result = await getPendingKycRequests();
      expect(result).toHaveLength(0);
    });

    it('should not return reviewed KYC requests', async () => {
      // Create user, admin, and KYC
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const adminResult = await db.insert(usersTable)
        .values(testAdmin)
        .returning()
        .execute();

      const kycResult = await submitKyc(userResult[0].id, testKycInput);

      // Review the KYC
      await reviewKyc(adminResult[0].id, {
        kyc_id: kycResult.id,
        status: 'verified'
      });

      const result = await getPendingKycRequests();
      expect(result).toHaveLength(0);
    });
  });

  describe('reviewKyc', () => {
    it('should approve KYC document successfully', async () => {
      // Create user, admin, and KYC
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const adminResult = await db.insert(usersTable)
        .values(testAdmin)
        .returning()
        .execute();

      const kycResult = await submitKyc(userResult[0].id, testKycInput);

      const reviewInput: ReviewKycInput = {
        kyc_id: kycResult.id,
        status: 'verified'
      };

      const result = await reviewKyc(adminResult[0].id, reviewInput);

      expect(result.status).toBe('verified');
      expect(result.reviewed_by).toBe(adminResult[0].id);
      expect(result.reviewed_at).toBeInstanceOf(Date);
      expect(result.rejection_reason).toBeNull();
    });

    it('should reject KYC document with reason', async () => {
      // Create user, admin, and KYC
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const adminResult = await db.insert(usersTable)
        .values(testAdmin)
        .returning()
        .execute();

      const kycResult = await submitKyc(userResult[0].id, testKycInput);

      const reviewInput: ReviewKycInput = {
        kyc_id: kycResult.id,
        status: 'rejected',
        rejection_reason: 'Document quality too poor'
      };

      const result = await reviewKyc(adminResult[0].id, reviewInput);

      expect(result.status).toBe('rejected');
      expect(result.reviewed_by).toBe(adminResult[0].id);
      expect(result.reviewed_at).toBeInstanceOf(Date);
      expect(result.rejection_reason).toBe('Document quality too poor');
    });

    it('should update user KYC status after review', async () => {
      // Create user, admin, and KYC
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const adminResult = await db.insert(usersTable)
        .values(testAdmin)
        .returning()
        .execute();

      const kycResult = await submitKyc(userResult[0].id, testKycInput);

      await reviewKyc(adminResult[0].id, {
        kyc_id: kycResult.id,
        status: 'verified'
      });

      // Check user's KYC status was updated
      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userResult[0].id))
        .execute();

      expect(updatedUser[0].kyc_status).toBe('verified');
    });

    it('should throw error for non-existent admin', async () => {
      // Create user and KYC
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const kycResult = await submitKyc(userResult[0].id, testKycInput);

      const nonExistentAdminId = 99999;

      await expect(reviewKyc(nonExistentAdminId, {
        kyc_id: kycResult.id,
        status: 'verified'
      })).rejects.toThrow(/admin not found/i);
    });

    it('should throw error for non-existent KYC document', async () => {
      // Create admin
      const adminResult = await db.insert(usersTable)
        .values(testAdmin)
        .returning()
        .execute();

      const nonExistentKycId = 99999;

      await expect(reviewKyc(adminResult[0].id, {
        kyc_id: nonExistentKycId,
        status: 'verified'
      })).rejects.toThrow(/kyc document not found/i);
    });
  });
});