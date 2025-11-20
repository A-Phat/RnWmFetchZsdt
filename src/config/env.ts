// Fallback to defaults if react-native-config is not available
let Config: any = {};
try {
  Config = require('react-native-config').default;
} catch {
  console.warn('react-native-config not available, using defaults');
}

export const ENV = {
  // API Configuration
  API_URL: Config.API_URL || 'https://your-api.com/upload',

  // MinIO Configuration
  // For Android Emulator: use 10.0.2.2 to access host machine's localhost
  // For real device: use actual IP (e.g., 192.168.1.100)
  MINIO_ENDPOINT: Config.MINIO_ENDPOINT || 'http://10.0.2.2:9000',
  MINIO_BUCKET: Config.MINIO_BUCKET || 'demo-images',
  MINIO_ACCESS_KEY: Config.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: Config.MINIO_SECRET_KEY || 'minioadmin123',

  // Background Sync Configuration
  BG_SYNC_INTERVAL: parseInt(Config.BG_SYNC_INTERVAL || '15', 10),
  BG_COMPRESSION_LEVEL: parseInt(Config.BG_COMPRESSION_LEVEL || '3', 10),
};

export const getMinioConfig = () => ({
  endpoint: ENV.MINIO_ENDPOINT,
  bucket: ENV.MINIO_BUCKET,
  accessKey: ENV.MINIO_ACCESS_KEY,
  secretKey: ENV.MINIO_SECRET_KEY,
});
