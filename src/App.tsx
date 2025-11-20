/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { insertMockProducts } from './scripts/mockProducts';
import { ProductListScreen } from './components/ProductListScreen';
import { BackgroundSyncService } from './services/BackgroundSyncService';
import { ENV } from './config/env';

function App() {
  // Insert mock data on app startup
  useEffect(() => {
    insertMockProducts().catch(error => {
      console.error('Failed to insert mock products:', error);
    });

    // Auto-start background sync on app launch
    BackgroundSyncService.configure({
      apiUrl: ENV.API_URL,
      taskId: 'product-sync-auto',
      minimumFetchInterval: ENV.BG_SYNC_INTERVAL,
      compressionLevel: ENV.BG_COMPRESSION_LEVEL,
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch(error => {
      console.error('Failed to start background sync:', error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <ProductListScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
