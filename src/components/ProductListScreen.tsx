import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { database } from '../db';
import Product from '../db/models/Product';
import { BackgroundSyncService } from '../services/BackgroundSyncService';
import { MinioUploadService } from '../services/MinioUploadService';
import BackgroundFetch from 'react-native-background-fetch';
import { ENV, getMinioConfig } from '../config/env';

export const ProductListScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [bgStatus, setBgStatus] = useState<string>('Unknown');
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    time: string;
    records?: number;
    size?: string;
    ratio?: string;
  } | null>(null);

  // Fetch products from SQLite
  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsCollection = database.get<Product>('products');
      const data = await productsCollection.query().fetch();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Check background fetch status
  const checkBgStatus = async () => {
    try {
      const status = await BackgroundFetch.status();
      const statusText = {
        [BackgroundFetch.STATUS_RESTRICTED]: 'Restricted',
        [BackgroundFetch.STATUS_DENIED]: 'Denied',
        [BackgroundFetch.STATUS_AVAILABLE]: 'Available',
      }[status] || 'Unknown';
      setBgStatus(statusText);
    } catch (error) {
      console.error('Failed to get BG status:', error);
    }
  };

  // Start background sync
  const handleStartBgSync = async () => {
    try {
      await BackgroundSyncService.configure({
        apiUrl: ENV.API_URL,
        taskId: 'product-sync',
        minimumFetchInterval: ENV.BG_SYNC_INTERVAL,
        compressionLevel: ENV.BG_COMPRESSION_LEVEL,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      await checkBgStatus();
      Alert.alert('Success', 'Background sync started!\nWill sync every 15 minutes');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start');
    }
  };

  // Stop background sync
  const handleStopBgSync = async () => {
    try {
      await BackgroundSyncService.stop();
      await checkBgStatus();
      Alert.alert('Success', 'Background sync stopped');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to stop');
    }
  };

  // Manual sync test
  const handleManualSync = async () => {
    try {
      setExporting(true);
      await BackgroundSyncService.triggerManualSync(ENV.API_URL, ENV.BG_COMPRESSION_LEVEL);
      
      setLastSyncResult({
        success: true,
        time: new Date().toLocaleTimeString(),
        records: products.length,
      });
      
      Alert.alert('Success', 'Manual sync completed!');
    } catch (error) {
      setLastSyncResult({
        success: false,
        time: new Date().toLocaleTimeString(),
      });
      Alert.alert('Error', error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setExporting(false);
    }
  };

  // Upload to MinIO
  const handleMinioUpload = async () => {
    try {
      setExporting(true);
      
      const result = await MinioUploadService.compressAndUpload(
        getMinioConfig(),
        ENV.BG_COMPRESSION_LEVEL
      );
      
      if (result.success) {
        const sizeInfo = result.size ? `${(result.size / 1024).toFixed(2)} KB` : 'N/A';
        const ratioInfo = result.compressionRatio ? `${result.compressionRatio.toFixed(1)}%` : 'N/A';
        
        setLastSyncResult({
          success: true,
          time: new Date().toLocaleTimeString(),
          records: result.recordCount,
          size: sizeInfo,
          ratio: ratioInfo,
        });
        
        Alert.alert(
          'Upload Successful',
          `File: ${result.fileName}\n` +
          `Records: ${result.recordCount}\n` +
          `Size: ${sizeInfo} (${ratioInfo})\n` +
          `URL: ${result.url}`
        );
      } else {
        setLastSyncResult({
          success: false,
          time: new Date().toLocaleTimeString(),
        });
        Alert.alert('Upload Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      setLastSyncResult({
        success: false,
        time: new Date().toLocaleTimeString(),
      });
      Alert.alert('Error', error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadProducts();
    checkBgStatus();

    // Subscribe to database changes
    const subscription = database
      .get<Product>('products')
      .query()
      .observe()
      .subscribe((data) => {
        setProducts(data);
      });

    return () => subscription.unsubscribe();
  }, []);

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <Text style={styles.productName}>{item.product_name}</Text>
      <Text style={styles.productDetail}>SKU: {item.skuid}</Text>
      <View
        style={[
          styles.statusBadge,
          item.status === 'PENDING' ? styles.statusPending : styles.statusSynced,
        ]}
      >
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Products ({products.length})</Text>
        <Text style={styles.bgStatusText}>BG: {bgStatus}</Text>
      </View>

      {/* Last Sync Info */}
      {lastSyncResult && (
        <View style={[styles.syncInfo, lastSyncResult.success ? styles.syncSuccess : styles.syncError]}>
          <Text style={styles.syncText}>
            {lastSyncResult.success ? '✓' : '✗'} Last Sync: {lastSyncResult.time}
            {lastSyncResult.records !== undefined && ` • ${lastSyncResult.records} records`}
            {lastSyncResult.size && ` • ${lastSyncResult.size}`}
            {lastSyncResult.ratio && ` (${lastSyncResult.ratio})`}
          </Text>
        </View>
      )}

      {/* Product List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      {/* Action Buttons */}
      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.bgStartButton]}
            onPress={handleStartBgSync}
            disabled={exporting}
          >
            <Text style={styles.buttonText}>🔄 Start</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.bgStopButton]}
            onPress={handleStopBgSync}
            disabled={exporting}
          >
            <Text style={styles.buttonText}>⏸ Stop</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.manualButton]}
            onPress={handleManualSync}
            disabled={exporting || products.length === 0}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>⚡ Sync</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.minioButton]}
          onPress={handleMinioUpload}
          disabled={exporting || products.length === 0}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>📦 Upload to MinIO</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  bgStatusText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  syncInfo: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 6,
  },
  syncSuccess: {
    backgroundColor: '#d4edda',
  },
  syncError: {
    backgroundColor: '#f8d7da',
  },
  syncText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  productDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FFA500',
  },
  statusSynced: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  footer: {
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bgStartButton: {
    backgroundColor: '#28a745',
  },
  bgStopButton: {
    backgroundColor: '#dc3545',
  },
  manualButton: {
    backgroundColor: '#007AFF',
  },
  minioButton: {
    backgroundColor: '#ff6600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
