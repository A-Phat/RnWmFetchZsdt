import ZstdModule from '../modules/ZstdModule';
import { database } from '../db';
import Product from '../db/models/Product';
import { Buffer } from 'buffer';

export interface MinioUploadConfig {
  endpoint: string; // e.g., 'http://192.168.1.100:9000'
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  fileName?: string;
  size?: number;
  error?: string;
}

/**
 * Service for uploading .zstd compressed data to MinIO
 */
export class MinioUploadService {
  /**
   * Fetch all products from SQLite
   */
  static async fetchProducts(): Promise<Product[]> {
    const products = database.get<Product>('products');
    return await products.query().fetch();
  }

  /**
   * Convert products to JSON and compress to .zstd format
   */
  static async compressProductsToZstd(
    compressionLevel: number = 3
  ): Promise<{ compressed: string; originalSize: number }> {
    try {
      const products = await this.fetchProducts();

      // Convert to plain objects
      const productsData = products.map(p => ({
        id: p.id,
        skuid: p.skuid,
        barcode_pos: p.barcode_pos,
        product_name: p.product_name,
        merchant_id: p.merchant_id,
        status: p.status,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
      }));

      const jsonString = JSON.stringify(productsData);
      const originalSize = new Blob([jsonString]).size;

      // Compress using zstd
      const compressedBase64 = await ZstdModule.compressString(
        jsonString,
        compressionLevel
      );

      return {
        compressed: compressedBase64,
        originalSize,
      };
    } catch (error) {
      throw new Error(`Compression failed: ${error}`);
    }
  }

  /**
   * Generate a unique filename for the upload
   */
  static generateFileName(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `products-${timestamp}.zstd`;
  }

  /**
   * Upload compressed .zstd file to MinIO
   */
  static async uploadToMinio(
    config: MinioUploadConfig,
    compressedData: string,
    fileName: string
  ): Promise<UploadResult> {
    try {
      // Convert base64 to binary using react-native-fs or fetch API
      // For React Native, we'll use fetch with base64 data URI
      const base64Data = `data:application/zstd;base64,${compressedData}`;
      
      // Fetch the base64 data as blob
      const response = await fetch(base64Data);
      const blob = await response.blob();

      // MinIO upload endpoint
      const uploadUrl = `${config.endpoint}/${config.bucket}/${fileName}`;

      // Create auth header
      const credentials = Buffer.from(`${config.accessKey}:${config.secretKey}`).toString('base64');

      // Upload using PUT request
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zstd',
          'x-amz-acl': 'public-read',
          'Authorization': `Basic ${credentials}`,
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      return {
        success: true,
        url: uploadUrl,
        fileName,
        size: blob.size,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Complete workflow: Compress and upload to MinIO
   */
  static async compressAndUpload(
    config: MinioUploadConfig,
    compressionLevel: number = 3
  ): Promise<UploadResult & { recordCount?: number; compressionRatio?: number }> {
    try {
      // Compress data
      const { compressed, originalSize } = await this.compressProductsToZstd(
        compressionLevel
      );

      // Generate filename
      const fileName = this.generateFileName();

      // Upload to MinIO
      const uploadResult = await this.uploadToMinio(config, compressed, fileName);

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Calculate compression ratio
      const compressedSize = uploadResult.size || 0;
      const ratio = (compressedSize / originalSize) * 100;

      const products = await this.fetchProducts();

      return {
        ...uploadResult,
        recordCount: products.length,
        compressionRatio: ratio,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upload using presigned URL (recommended for production)
   */
  static async uploadWithPresignedUrl(
    presignedUrl: string,
    compressedData: string,
    fileName: string
  ): Promise<UploadResult> {
    try {
      // Convert base64 to blob using data URI
      const base64Data = `data:application/zstd;base64,${compressedData}`;
      const response = await fetch(base64Data);
      const blob = await response.blob();

      // Upload using presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zstd',
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      return {
        success: true,
        url: presignedUrl.split('?')[0], // Remove query params
        fileName,
        size: blob.size,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }
}
