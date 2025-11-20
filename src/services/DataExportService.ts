import { database } from '../db';
import Product from '../db/models/Product';
import ZstdModule from '../modules/ZstdModule';
import NetInfo from '@react-native-community/netinfo';

export interface ExportResult {
  success: boolean;
  compressedSize: number;
  originalSize: number;
  compressionRatio: number;
  recordCount: number;
  error?: string;
}

/**
 * Service for exporting SQLite data to .zstd format
 */
export class DataExportService {
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
  static async exportProductsToZstd(
    compressionLevel: number = 3
  ): Promise<{ compressed: string; originalSize: number; compressedData: string }> {
    try {
      // Fetch all products
      const products = await this.fetchProducts();

      // Convert to plain objects for JSON serialization
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

      // Convert to JSON string
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
        compressedData: compressedBase64,
      };
    } catch (error) {
      throw new Error(`Export failed: ${error}`);
    }
  }

  /**
   * Send compressed data to external API
   */
  static async sendToExternalAPI(
    compressedData: string,
    apiUrl: string
  ): Promise<ExportResult> {
    try {
      // Check network connectivity
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        throw new Error('No network connection');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'zstd',
          'X-Compression-Format': 'zstd',
        },
        body: compressedData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`API send failed: ${error}`);
    }
  }

  /**
   * Complete export and upload workflow
   */
  static async exportAndUpload(
    apiUrl: string,
    compressionLevel: number = 3
  ): Promise<ExportResult> {
    try {
      // Export and compress
      const { compressed, originalSize, compressedData } =
        await this.exportProductsToZstd(compressionLevel);

      const compressedSize = new Blob([compressedData]).size;
      const ratio = await ZstdModule.getCompressionRatio(
        originalSize,
        compressedSize
      );

      // Send to API
      await this.sendToExternalAPI(compressed, apiUrl);

      const products = await this.fetchProducts();

      return {
        success: true,
        compressedSize,
        originalSize,
        compressionRatio: ratio,
        recordCount: products.length,
      };
    } catch (error) {
      return {
        success: false,
        compressedSize: 0,
        originalSize: 0,
        compressionRatio: 0,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
