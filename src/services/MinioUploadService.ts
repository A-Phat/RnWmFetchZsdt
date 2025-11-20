import ZstdModule from '../modules/ZstdModule';
import { database } from '../db';
import Product from '../db/models/Product';
import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js';

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
   * Generate AWS Signature V4 for MinIO
   */
  private static getAwsSignature(
    method: string,
    path: string,
    query: string,
    headers: Record<string, string>,
    payload: Buffer,
    accessKey: string,
    secretKey: string,
    region: string = 'us-east-1',
    service: string = 's3'
  ): { authorization: string; headers: Record<string, string> } {
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

    // Calculate payload hash - convert Buffer to hex string first
    const payloadHex = payload.toString('hex');
    const payloadWordArray = CryptoJS.enc.Hex.parse(payloadHex);
    const payloadHash = CryptoJS.SHA256(payloadWordArray).toString();

    console.log('[AWS] Payload hash:', payloadHash);

    // Set required headers
    headers['x-amz-date'] = amzDate;
    headers['x-amz-content-sha256'] = payloadHash;

    // Build canonical headers (must be sorted and lowercase)
    const sortedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaders
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n') + '\n';

    const signedHeaders = sortedHeaders
      .map(key => key.toLowerCase())
      .join(';');

    // Build canonical request
    const canonicalRequest = [
      method,
      path,
      query,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    console.log('[AWS] Canonical Request:\n', canonicalRequest);

    // Create string to sign
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = CryptoJS.SHA256(canonicalRequest).toString();
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n');

    console.log('[AWS] String to Sign:\n', stringToSign);

    // Calculate signing key
    const kDate = CryptoJS.HmacSHA256(dateStamp, 'AWS4' + secretKey);
    const kRegion = CryptoJS.HmacSHA256(region, kDate);
    const kService = CryptoJS.HmacSHA256(service, kRegion);
    const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);

    // Calculate signature
    const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString();

    console.log('[AWS] Signature:', signature);

    // Build authorization header
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { authorization, headers };
  }

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
      console.log('[MinIO] Starting upload...', {
        endpoint: config.endpoint,
        bucket: config.bucket,
        fileName,
      });

      // Convert base64 to binary
      const binaryData = Buffer.from(compressedData, 'base64');
      console.log('[MinIO] Binary length:', binaryData.length);

      // Parse endpoint to get host
      const host = config.endpoint.replace(/^https?:\/\//, '').split('/')[0];
      const path = `/${config.bucket}/${fileName}`;
      const uploadUrl = `${config.endpoint}${path}`;

      console.log('[MinIO] Upload URL:', uploadUrl);

      // Prepare headers for signing
      const headers: Record<string, string> = {
        'Host': host,
        'Content-Type': 'application/zstd',
      };

      // Generate AWS Signature V4
      const { authorization, headers: signedHeaders } = this.getAwsSignature(
        'PUT',
        path,
        '',
        headers,
        binaryData,
        config.accessKey,
        config.secretKey
      );

      console.log('[MinIO] Uploading with AWS4 signature...');

      // Upload using PUT request with AWS Signature V4
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          ...signedHeaders,
          'Authorization': authorization,
        },
        body: binaryData as any,
      });

      console.log('[MinIO] Response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[MinIO] Upload failed:', errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}\n${errorText}`);
      }

      console.log('[MinIO] Upload successful!');

      return {
        success: true,
        url: uploadUrl,
        fileName,
        size: binaryData.length,
      };
    } catch (error) {
      console.error('[MinIO] Upload error:', error);
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
