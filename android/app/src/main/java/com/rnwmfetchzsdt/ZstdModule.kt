package com.rnwmfetchzsdt

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.github.luben.zstd.Zstd
import android.util.Base64

class ZstdModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ZstdModule"
    }

    /**
     * Compress data using Zstandard compression
     * @param data Base64 encoded string to compress
     * @param compressionLevel Compression level (1-22, default 3)
     * @param promise Promise that returns base64 encoded compressed data
     */
    @ReactMethod
    fun compress(data: String, compressionLevel: Int, promise: Promise) {
        try {
            // Decode base64 input
            val inputBytes = Base64.decode(data, Base64.DEFAULT)
            
            // Compress using zstd
            val level = if (compressionLevel in 1..22) compressionLevel else 3
            val compressedBytes = Zstd.compress(inputBytes, level)
            
            // Encode result to base64
            val result = Base64.encodeToString(compressedBytes, Base64.NO_WRAP)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("COMPRESSION_ERROR", "Failed to compress data: ${e.message}", e)
        }
    }

    /**
     * Compress string data using Zstandard compression
     * @param data String to compress
     * @param compressionLevel Compression level (1-22, default 3)
     * @param promise Promise that returns base64 encoded compressed data
     */
    @ReactMethod
    fun compressString(data: String, compressionLevel: Int, promise: Promise) {
        try {
            val inputBytes = data.toByteArray(Charsets.UTF_8)
            val level = if (compressionLevel in 1..22) compressionLevel else 3
            val compressedBytes = Zstd.compress(inputBytes, level)
            val result = Base64.encodeToString(compressedBytes, Base64.NO_WRAP)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("COMPRESSION_ERROR", "Failed to compress string: ${e.message}", e)
        }
    }

    /**
     * Decompress Zstandard compressed data
     * @param data Base64 encoded compressed data
     * @param originalSize Original size of uncompressed data (required for zstd)
     * @param promise Promise that returns base64 encoded decompressed data
     */
    @ReactMethod
    fun decompress(data: String, originalSize: Int, promise: Promise) {
        try {
            val compressedBytes = Base64.decode(data, Base64.DEFAULT)
            val decompressedBytes = Zstd.decompress(compressedBytes, originalSize)
            val result = Base64.encodeToString(decompressedBytes, Base64.NO_WRAP)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DECOMPRESSION_ERROR", "Failed to decompress data: ${e.message}", e)
        }
    }

    /**
     * Decompress Zstandard compressed data to string
     * @param data Base64 encoded compressed data
     * @param originalSize Original size of uncompressed data
     * @param promise Promise that returns decompressed string
     */
    @ReactMethod
    fun decompressToString(data: String, originalSize: Int, promise: Promise) {
        try {
            val compressedBytes = Base64.decode(data, Base64.DEFAULT)
            val decompressedBytes = Zstd.decompress(compressedBytes, originalSize)
            val result = String(decompressedBytes, Charsets.UTF_8)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DECOMPRESSION_ERROR", "Failed to decompress to string: ${e.message}", e)
        }
    }

    /**
     * Get the compression ratio as a percentage
     * @param originalSize Original size in bytes
     * @param compressedSize Compressed size in bytes
     * @param promise Promise that returns compression ratio
     */
    @ReactMethod
    fun getCompressionRatio(originalSize: Int, compressedSize: Int, promise: Promise) {
        try {
            val ratio = (compressedSize.toDouble() / originalSize.toDouble()) * 100
            promise.resolve(ratio)
        } catch (e: Exception) {
            promise.reject("CALCULATION_ERROR", "Failed to calculate ratio: ${e.message}", e)
        }
    }
}
