import BackgroundFetch from 'react-native-background-fetch';
import { DataExportService } from './DataExportService';

export interface BackgroundTaskConfig {
  apiUrl: string;
  taskId: string;
  minimumFetchInterval: number; // in minutes
  compressionLevel?: number;
  stopOnTerminate?: boolean;
  startOnBoot?: boolean;
}

/**
 * Service for managing background data sync using react-native-background-fetch
 */
export class BackgroundSyncService {
  private static isConfigured = false;

  /**
   * Configure and start background fetch
   */
  static async configure(config: BackgroundTaskConfig): Promise<void> {
    if (this.isConfigured) {
      console.log('Background fetch already configured');
      return;
    }

    try {
      const status = await BackgroundFetch.configure(
        {
          minimumFetchInterval: config.minimumFetchInterval,
          stopOnTerminate: config.stopOnTerminate ?? false,
          startOnBoot: config.startOnBoot ?? true,
          enableHeadless: true,
          requiresCharging: false,
          requiresDeviceIdle: false,
          requiresBatteryNotLow: false,
          requiresStorageNotLow: false,
        },
        async (taskId) => {
          console.log('[BackgroundFetch] Task started:', taskId);

          try {
            // Export and upload data
            const result = await DataExportService.exportAndUpload(
              config.apiUrl,
              config.compressionLevel ?? 3
            );

            if (result.success) {
              console.log('[BackgroundFetch] Export successful:', {
                records: result.recordCount,
                originalSize: result.originalSize,
                compressedSize: result.compressedSize,
                ratio: result.compressionRatio.toFixed(2) + '%',
              });
            } else {
              console.error('[BackgroundFetch] Export failed:', result.error);
            }
          } catch (error) {
            console.error('[BackgroundFetch] Task error:', error);
          }

          // Signal completion
          BackgroundFetch.finish(taskId);
        },
        (taskId) => {
          // Task timeout callback
          console.log('[BackgroundFetch] Task timeout:', taskId);
          BackgroundFetch.finish(taskId);
        }
      );

      console.log('[BackgroundFetch] Configured with status:', status);
      this.isConfigured = true;

      // Schedule the task
      await BackgroundFetch.scheduleTask({
        taskId: config.taskId,
        delay: 0, // Run immediately
        periodic: true,
        forceAlarmManager: false,
        stopOnTerminate: config.stopOnTerminate ?? false,
        startOnBoot: config.startOnBoot ?? true,
      });

      console.log('[BackgroundFetch] Task scheduled:', config.taskId);
    } catch (error) {
      console.error('[BackgroundFetch] Configuration error:', error);
      throw error;
    }
  }

  /**
   * Stop background fetch
   */
  static async stop(): Promise<void> {
    try {
      await BackgroundFetch.stop();
      this.isConfigured = false;
      console.log('[BackgroundFetch] Stopped');
    } catch (error) {
      console.error('[BackgroundFetch] Stop error:', error);
    }
  }

  /**
   * Get background fetch status
   */
  static async getStatus(): Promise<number> {
    return await BackgroundFetch.status();
  }

  /**
   * Manually trigger background task (for testing)
   */
  static async triggerManualSync(
    apiUrl: string,
    compressionLevel: number = 3
  ): Promise<void> {
    console.log('[BackgroundSync] Manual sync triggered');
    const result = await DataExportService.exportAndUpload(
      apiUrl,
      compressionLevel
    );

    if (result.success) {
      console.log('[BackgroundSync] Manual sync successful:', result);
    } else {
      console.error('[BackgroundSync] Manual sync failed:', result.error);
      throw new Error(result.error);
    }
  }
}
