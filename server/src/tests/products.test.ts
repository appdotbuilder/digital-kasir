import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput } from '../schema';
import { 
  getProducts, 
  getProductsByType, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} from '../handlers/products';
import { eq } from 'drizzle-orm';

// Test inputs
const testProductInput: CreateProductInput = {
  name: 'Pulsa Telkomsel 10K',
  description: 'Pulsa Telkomsel 10.000',
  type: 'pulsa',
  price: 10500,
  provider_code: 'TSEL10'
};

const testDataProductInput: CreateProductInput = {
  name: 'Data XL 1GB',
  description: 'Paket Data XL 1GB',
  type: 'data',
  price: 15000,
  provider_code: 'XL1GB'
};

const testPlnProductInput: CreateProductInput = {
  name: 'Token PLN 50K',
  description: 'Token PLN 50.000',
  type: 'pln',
  price: 51000,
  provider_code: 'PLN50K'
};

describe('Products Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createProduct', () => {
    it('should create a product', async () => {
      const result = await createProduct(testProductInput);

      expect(result.name).toEqual('Pulsa Telkomsel 10K');
      expect(result.description).toEqual('Pulsa Telkomsel 10.000');
      expect(result.type).toEqual('pulsa');
      expect(result.price).toEqual(10500);
      expect(typeof result.price).toEqual('number');
      expect(result.provider_code).toEqual('TSEL10');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save product to database', async () => {
      const result = await createProduct(testProductInput);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Pulsa Telkomsel 10K');
      expect(products[0].type).toEqual('pulsa');
      expect(parseFloat(products[0].price)).toEqual(10500);
      expect(products[0].is_active).toBe(true);
    });

    it('should handle product with null description', async () => {
      const inputWithoutDescription: CreateProductInput = {
        name: testProductInput.name,
        description: null,
        type: testProductInput.type,
        price: testProductInput.price,
        provider_code: testProductInput.provider_code
      };

      const result = await createProduct(inputWithoutDescription);
      expect(result.description).toBe(null);
    });
  });

  describe('getProducts', () => {
    it('should return empty array when no products exist', async () => {
      const result = await getProducts();
      expect(result).toHaveLength(0);
    });

    it('should return only active products', async () => {
      // Create active product
      const activeProduct = await createProduct(testProductInput);
      
      // Create inactive product manually
      await db.insert(productsTable)
        .values({
          name: 'Inactive Product',
          description: 'This is inactive',
          type: 'pulsa',
          price: '5000',
          provider_code: 'INACTIVE',
          is_active: false
        })
        .execute();

      const result = await getProducts();

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(activeProduct.id);
      expect(result[0].name).toEqual('Pulsa Telkomsel 10K');
      expect(result[0].is_active).toBe(true);
    });

    it('should return products ordered by type and price', async () => {
      await createProduct(testPlnProductInput); // pln, 51000
      await createProduct(testDataProductInput); // data, 15000
      await createProduct(testProductInput); // pulsa, 10500

      // Create another pulsa with lower price
      await createProduct({
        name: 'Pulsa Indosat 5K',
        description: 'Pulsa Indosat 5.000',
        type: 'pulsa',
        price: 5500,
        provider_code: 'ISAT5'
      });

      const result = await getProducts();

      expect(result).toHaveLength(4);
      // Should be ordered by type first (enum order: pulsa, data, pln, voucher_game), then by price
      expect(result[0].type).toEqual('pulsa'); // pulsa comes first in enum
      expect(result[0].price).toEqual(5500); // Lower price pulsa first
      expect(result[1].type).toEqual('pulsa'); // Higher price pulsa second
      expect(result[1].price).toEqual(10500);
      expect(result[2].type).toEqual('data');
      expect(result[3].type).toEqual('pln');
    });

    it('should convert price from string to number', async () => {
      await createProduct(testProductInput);
      
      const result = await getProducts();
      
      expect(result).toHaveLength(1);
      expect(typeof result[0].price).toEqual('number');
      expect(result[0].price).toEqual(10500);
    });
  });

  describe('getProductsByType', () => {
    it('should return empty array when no products of type exist', async () => {
      const result = await getProductsByType('voucher_game');
      expect(result).toHaveLength(0);
    });

    it('should return products of specific type', async () => {
      await createProduct(testProductInput); // pulsa
      await createProduct(testDataProductInput); // data
      await createProduct(testPlnProductInput); // pln

      const pulsaResult = await getProductsByType('pulsa');
      const dataResult = await getProductsByType('data');

      expect(pulsaResult).toHaveLength(1);
      expect(pulsaResult[0].type).toEqual('pulsa');
      expect(pulsaResult[0].name).toEqual('Pulsa Telkomsel 10K');

      expect(dataResult).toHaveLength(1);
      expect(dataResult[0].type).toEqual('data');
      expect(dataResult[0].name).toEqual('Data XL 1GB');
    });

    it('should return products ordered by price', async () => {
      // Create multiple pulsa products with different prices
      await createProduct({
        name: 'Pulsa 20K',
        description: 'Pulsa 20K Description',
        type: 'pulsa',
        price: 20500,
        provider_code: 'PROV20K'
      });
      await createProduct({
        name: 'Pulsa 5K',
        description: 'Pulsa 5K Description',
        type: 'pulsa',
        price: 5500,
        provider_code: 'PROV5K'
      });
      await createProduct(testProductInput); // 10500

      const result = await getProductsByType('pulsa');

      expect(result).toHaveLength(3);
      expect(result[0].price).toEqual(5500);  // Lowest price first
      expect(result[1].price).toEqual(10500);
      expect(result[2].price).toEqual(20500); // Highest price last
    });

    it('should include both active and inactive products', async () => {
      // Create active product
      await createProduct(testProductInput);
      
      // Create inactive product manually
      await db.insert(productsTable)
        .values({
          name: 'Inactive Pulsa',
          description: 'This is inactive',
          type: 'pulsa',
          price: '15000',
          provider_code: 'INACTIVE',
          is_active: false
        })
        .execute();

      const result = await getProductsByType('pulsa');

      expect(result).toHaveLength(2);
      expect(result.some(p => p.is_active === false)).toBe(true);
    });
  });

  describe('getProductById', () => {
    it('should return null when product does not exist', async () => {
      const result = await getProductById(999);
      expect(result).toBe(null);
    });

    it('should return product when it exists', async () => {
      const created = await createProduct(testProductInput);
      const result = await getProductById(created.id);

      expect(result).not.toBe(null);
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Pulsa Telkomsel 10K');
      expect(result!.type).toEqual('pulsa');
      expect(typeof result!.price).toEqual('number');
      expect(result!.price).toEqual(10500);
    });

    it('should return inactive product when queried by ID', async () => {
      const created = await createProduct(testProductInput);
      
      // Make product inactive
      await deleteProduct(created.id);
      
      const result = await getProductById(created.id);
      expect(result).not.toBe(null);
      expect(result!.is_active).toBe(false);
    });
  });

  describe('updateProduct', () => {
    it('should update product fields', async () => {
      const created = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: created.id,
        name: 'Updated Product Name',
        price: 12000,
        is_active: false
      };

      const result = await updateProduct(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Product Name');
      expect(result.price).toEqual(12000);
      expect(typeof result.price).toEqual('number');
      expect(result.is_active).toBe(false);
      expect(result.description).toEqual('Pulsa Telkomsel 10.000'); // Unchanged
      expect(result.provider_code).toEqual('TSEL10'); // Unchanged
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should update only specified fields', async () => {
      const created = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: created.id,
        name: 'New Name Only'
      };

      const result = await updateProduct(updateInput);

      expect(result.name).toEqual('New Name Only');
      expect(result.price).toEqual(10500); // Unchanged
      expect(result.is_active).toBe(true); // Unchanged
    });

    it('should save updated product to database', async () => {
      const created = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: created.id,
        name: 'Database Updated Name',
        price: 99999
      };
      
      await updateProduct(updateInput);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, created.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Database Updated Name');
      expect(parseFloat(products[0].price)).toEqual(99999);
    });

    it('should throw error when product not found', async () => {
      const updateInput: UpdateProductInput = {
        id: 999,
        name: 'Non-existent Product'
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/Product not found/i);
    });

    it('should handle description update to null', async () => {
      const created = await createProduct(testProductInput);
      
      const updateInput: UpdateProductInput = {
        id: created.id,
        description: null
      };
      
      const result = await updateProduct(updateInput);

      expect(result.description).toBe(null);
    });
  });

  describe('deleteProduct', () => {
    it('should soft delete product (set is_active to false)', async () => {
      const created = await createProduct(testProductInput);
      
      const result = await deleteProduct(created.id);
      expect(result.success).toBe(true);

      // Check product is soft deleted
      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, created.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].is_active).toBe(false);
      expect(products[0].updated_at.getTime()).toBeGreaterThan(products[0].created_at.getTime());
    });

    it('should return false when product does not exist', async () => {
      const result = await deleteProduct(999);
      expect(result.success).toBe(false);
    });

    it('should not appear in getProducts after deletion', async () => {
      const created = await createProduct(testProductInput);
      
      // Verify product exists in active products
      let activeProducts = await getProducts();
      expect(activeProducts).toHaveLength(1);

      // Delete product
      await deleteProduct(created.id);

      // Verify product no longer appears in active products
      activeProducts = await getProducts();
      expect(activeProducts).toHaveLength(0);
    });

    it('should still be accessible by ID after deletion', async () => {
      const created = await createProduct(testProductInput);
      await deleteProduct(created.id);

      const result = await getProductById(created.id);
      expect(result).not.toBe(null);
      expect(result!.is_active).toBe(false);
    });
  });
});