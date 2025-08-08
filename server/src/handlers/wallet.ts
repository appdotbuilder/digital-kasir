import { db } from '../db';
import { usersTable, depositsTable, transfersTable, withdrawalsTable } from '../db/schema';
import { type Deposit, type Transfer, type Withdrawal, type CreateDepositInput, type CreateTransferInput, type CreateWithdrawalInput } from '../schema';
import { eq, desc, or, SQL } from 'drizzle-orm';

export async function getUserWalletBalance(userId: number): Promise<{ balance: number; coins: number }> {
  try {
    const users = await db.select({
      wallet_balance: usersTable.wallet_balance,
      coins: usersTable.coins
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    return {
      balance: parseFloat(user.wallet_balance),
      coins: user.coins
    };
  } catch (error) {
    console.error('Failed to get user wallet balance:', error);
    throw error;
  }
}

export async function createDeposit(userId: number, input: CreateDepositInput): Promise<Deposit> {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    // Generate payment reference
    const paymentReference = `PAY_${userId}_${Date.now()}`;

    // Create deposit record
    const result = await db.insert(depositsTable)
      .values({
        user_id: userId,
        amount: input.amount.toString(),
        method: input.method,
        status: 'pending',
        payment_reference: paymentReference
      })
      .returning()
      .execute();

    const deposit = result[0];
    return {
      ...deposit,
      amount: parseFloat(deposit.amount)
    };
  } catch (error) {
    console.error('Deposit creation failed:', error);
    throw error;
  }
}

export async function getUserDeposits(userId: number): Promise<Deposit[]> {
  try {
    const results = await db.select()
      .from(depositsTable)
      .where(eq(depositsTable.user_id, userId))
      .orderBy(desc(depositsTable.created_at))
      .execute();

    return results.map(deposit => ({
      ...deposit,
      amount: parseFloat(deposit.amount)
    }));
  } catch (error) {
    console.error('Failed to get user deposits:', error);
    throw error;
  }
}

export async function createTransfer(fromUserId: number, input: CreateTransferInput): Promise<Transfer> {
  try {
    // Validate sender exists and has KYC verified
    const senders = await db.select({
      id: usersTable.id,
      wallet_balance: usersTable.wallet_balance,
      kyc_status: usersTable.kyc_status,
      is_blocked: usersTable.is_blocked
    })
    .from(usersTable)
    .where(eq(usersTable.id, fromUserId))
    .execute();

    if (senders.length === 0) {
      throw new Error('Sender not found');
    }

    const sender = senders[0];
    
    if (sender.is_blocked) {
      throw new Error('Account is blocked');
    }

    if (sender.kyc_status !== 'verified') {
      throw new Error('KYC verification required for transfers');
    }

    const currentBalance = parseFloat(sender.wallet_balance);
    if (currentBalance < input.amount) {
      throw new Error('Insufficient balance');
    }

    // Find recipient by email
    const recipients = await db.select({
      id: usersTable.id,
      is_blocked: usersTable.is_blocked
    })
    .from(usersTable)
    .where(eq(usersTable.email, input.to_user_email))
    .execute();

    if (recipients.length === 0) {
      throw new Error('Recipient not found');
    }

    const recipient = recipients[0];
    
    if (recipient.is_blocked) {
      throw new Error('Recipient account is blocked');
    }

    if (fromUserId === recipient.id) {
      throw new Error('Cannot transfer to yourself');
    }

    // Create transfer record
    const result = await db.insert(transfersTable)
      .values({
        from_user_id: fromUserId,
        to_user_id: recipient.id,
        amount: input.amount.toString(),
        status: 'pending'
      })
      .returning()
      .execute();

    const transfer = result[0];
    return {
      ...transfer,
      amount: parseFloat(transfer.amount)
    };
  } catch (error) {
    console.error('Transfer creation failed:', error);
    throw error;
  }
}

export async function getUserTransfers(userId: number): Promise<{ sent: Transfer[]; received: Transfer[] }> {
  try {
    const conditions: SQL<unknown>[] = [
      eq(transfersTable.from_user_id, userId),
      eq(transfersTable.to_user_id, userId)
    ];

    const results = await db.select()
      .from(transfersTable)
      .where(or(...conditions))
      .orderBy(desc(transfersTable.created_at))
      .execute();

    const sent: Transfer[] = [];
    const received: Transfer[] = [];

    results.forEach(transfer => {
      const transferWithAmount = {
        ...transfer,
        amount: parseFloat(transfer.amount)
      };

      if (transfer.from_user_id === userId) {
        sent.push(transferWithAmount);
      } else {
        received.push(transferWithAmount);
      }
    });

    return { sent, received };
  } catch (error) {
    console.error('Failed to get user transfers:', error);
    throw error;
  }
}

export async function createWithdrawal(userId: number, input: CreateWithdrawalInput): Promise<Withdrawal> {
  try {
    // Validate user exists, has KYC verified, and sufficient balance
    const users = await db.select({
      id: usersTable.id,
      wallet_balance: usersTable.wallet_balance,
      kyc_status: usersTable.kyc_status,
      is_blocked: usersTable.is_blocked
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    
    if (user.is_blocked) {
      throw new Error('Account is blocked');
    }

    if (user.kyc_status !== 'verified') {
      throw new Error('KYC verification required for withdrawals');
    }

    const currentBalance = parseFloat(user.wallet_balance);
    if (currentBalance < input.amount) {
      throw new Error('Insufficient balance');
    }

    // Create withdrawal record
    const result = await db.insert(withdrawalsTable)
      .values({
        user_id: userId,
        amount: input.amount.toString(),
        bank_name: input.bank_name,
        account_number: input.account_number,
        account_name: input.account_name,
        status: 'pending'
      })
      .returning()
      .execute();

    const withdrawal = result[0];
    return {
      ...withdrawal,
      amount: parseFloat(withdrawal.amount)
    };
  } catch (error) {
    console.error('Withdrawal creation failed:', error);
    throw error;
  }
}

export async function getUserWithdrawals(userId: number): Promise<Withdrawal[]> {
  try {
    const results = await db.select()
      .from(withdrawalsTable)
      .where(eq(withdrawalsTable.user_id, userId))
      .orderBy(desc(withdrawalsTable.created_at))
      .execute();

    return results.map(withdrawal => ({
      ...withdrawal,
      amount: parseFloat(withdrawal.amount)
    }));
  } catch (error) {
    console.error('Failed to get user withdrawals:', error);
    throw error;
  }
}

export async function processDepositCallback(paymentReference: string, status: string): Promise<{ success: boolean }> {
  try {
    // Find deposit by payment reference
    const deposits = await db.select()
      .from(depositsTable)
      .where(eq(depositsTable.payment_reference, paymentReference))
      .execute();

    if (deposits.length === 0) {
      throw new Error('Deposit not found');
    }

    const deposit = deposits[0];
    
    if (deposit.status !== 'pending') {
      throw new Error('Deposit already processed');
    }

    // Map payment gateway status to our status
    let depositStatus: 'completed' | 'failed' | 'cancelled';
    if (status === 'success' || status === 'completed') {
      depositStatus = 'completed';
    } else if (status === 'failed') {
      depositStatus = 'failed';
    } else {
      depositStatus = 'cancelled';
    }

    // Update deposit status
    await db.update(depositsTable)
      .set({ 
        status: depositStatus,
        updated_at: new Date()
      })
      .where(eq(depositsTable.id, deposit.id))
      .execute();

    // If completed, update user wallet balance
    if (depositStatus === 'completed') {
      const currentBalance = await db.select({ wallet_balance: usersTable.wallet_balance })
        .from(usersTable)
        .where(eq(usersTable.id, deposit.user_id))
        .execute();

      if (currentBalance.length > 0) {
        const newBalance = parseFloat(currentBalance[0].wallet_balance) + parseFloat(deposit.amount);
        
        await db.update(usersTable)
          .set({ 
            wallet_balance: newBalance.toString(),
            updated_at: new Date()
          })
          .where(eq(usersTable.id, deposit.user_id))
          .execute();
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Deposit callback processing failed:', error);
    throw error;
  }
}