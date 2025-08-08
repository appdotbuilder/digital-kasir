import { db } from '../db';
import { productsTable } from '../db/schema';
import { type Product, type CreateProductInput, type UpdateProductInput } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .orderBy(asc(productsTable.type), asc(productsTable.price))
      .execute();

    return results.map(product => ({
      ...product,
      price: parseFloat(product.price)
    }));
  } catch (error) {
    console.error('Get products failed:', error);
    throw error;
  }
}

export async function getProductsByType(type: string): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.type, type as any))
      .orderBy(asc(productsTable.price))
      .execute();

    return results.map(product => ({
      ...product,
      price: parseFloat(product.price)
    }));
  } catch (error) {
    console.error('Get products by type failed:', error);
    throw error;
  }
}

export async function getProductById(productId: number): Promise<Product | null> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Get product by ID failed:', error);
    throw error;
  }
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    const results = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        price: input.price.toString(),
        provider_code: input.provider_code
      })
      .returning()
      .execute();

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Create product failed:', error);
    throw error;
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  try {
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.provider_code !== undefined) updateData.provider_code = input.provider_code;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    const results = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    if (results.length === 0) {
      throw new Error('Product not found');
    }

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Update product failed:', error);
    throw error;
  }
}

export async function deleteProduct(productId: number): Promise<{ success: boolean }> {
  try {
    const results = await db.update(productsTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, productId))
      .returning()
      .execute();

    return {
      success: results.length > 0
    };
  } catch (error) {
    console.error('Delete product failed:', error);
    throw error;
  }
}