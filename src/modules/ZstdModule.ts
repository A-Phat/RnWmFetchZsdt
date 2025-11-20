import { NativeModules } from 'react-native';

interface ZstdModuleInterface {
  /**
   * Compress data using Zstandard compression
   * @param data Base64 encoded string to compress
   * @param compressionLevel Compression level (1-22, default 3)
   * @returns Promise<string> Base64 encoded compressed data
   */
  compress(data: string, compressionLevel?: number): Promise<string>;

  /**
   * Compress string data using Zstandard compression
   * @param data String to compress
   * @param compressionLevel Compression level (1-22, default 3)
   * @returns Promise<string> Base64 encoded compressed data
   */
  compressString(data: string, compressionLevel?: number): Promise<string>;

  /**
   * Decompress Zstandard compressed data
   * @param data Base64 encoded compressed data
   * @param originalSize Original size of uncompressed data
   * @returns Promise<string> Base64 encoded decompressed data
   */
  decompress(data: string, originalSize: number): Promise<string>;

  /**
   * Decompress Zstandard compressed data to string
   * @param data Base64 encoded compressed data
   * @param originalSize Original size of uncompressed data
   * @returns Promise<string> Decompressed string
   */
  decompressToString(data: string, originalSize: number): Promise<string>;

  /**
   * Get the compression ratio as a percentage
   * @param originalSize Original size in bytes
   * @param compressedSize Compressed size in bytes
   * @returns Promise<number> Compression ratio
   */
  getCompressionRatio(originalSize: number, compressedSize: number): Promise<number>;
}

const { ZstdModule } = NativeModules;

export default ZstdModule as ZstdModuleInterface;
