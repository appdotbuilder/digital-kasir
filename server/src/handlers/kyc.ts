import { db } from '../db';
import { kycDocumentsTable, usersTable } from '../db/schema';
import { type SubmitKycInput, type ReviewKycInput, type KycDocument } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function submitKyc(userId: number, input: SubmitKycInput): Promise<KycDocument> {
  try {
    // Check if user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Insert KYC document record
    const result = await db.insert(kycDocumentsTable)
      .values({
        user_id: userId,
        id_card_url: input.id_card_url,
        selfie_url: input.selfie_url,
        status: 'pending'
      })
      .returning()
      .execute();

    // Update user's KYC status to pending
    await db.update(usersTable)
      .set({ 
        kyc_status: 'pending',
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return result[0];
  } catch (error) {
    console.error('KYC submission failed:', error);
    throw error;
  }
}

export async function getKycStatus(userId: number): Promise<KycDocument | null> {
  try {
    // Get the latest KYC document for the user
    const results = await db.select()
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.user_id, userId))
      .orderBy(desc(kycDocumentsTable.submitted_at))
      .limit(1)
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to get KYC status:', error);
    throw error;
  }
}

export async function getPendingKycRequests(): Promise<KycDocument[]> {
  try {
    // Get all pending KYC requests
    const results = await db.select()
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.status, 'pending'))
      .orderBy(desc(kycDocumentsTable.submitted_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get pending KYC requests:', error);
    throw error;
  }
}

export async function reviewKyc(adminId: number, input: ReviewKycInput): Promise<KycDocument> {
  try {
    // Verify admin exists
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (admin.length === 0) {
      throw new Error('Admin not found');
    }

    // Get the KYC document to verify it exists and get user_id
    const kycDoc = await db.select()
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.id, input.kyc_id))
      .execute();

    if (kycDoc.length === 0) {
      throw new Error('KYC document not found');
    }

    const userId = kycDoc[0].user_id;

    // Update KYC document with review
    const result = await db.update(kycDocumentsTable)
      .set({
        status: input.status,
        rejection_reason: input.rejection_reason || null,
        reviewed_at: new Date(),
        reviewed_by: adminId
      })
      .where(eq(kycDocumentsTable.id, input.kyc_id))
      .returning()
      .execute();

    // Update user's KYC status
    await db.update(usersTable)
      .set({ 
        kyc_status: input.status,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return result[0];
  } catch (error) {
    console.error('KYC review failed:', error);
    throw error;
  }
}