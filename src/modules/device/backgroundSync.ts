import { Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { syncNow } from "./syncEngine";

export const SYNC_TASK = "callos-call-sync";

/**
 * Android wakes the app every 15 minutes or so (more often when charging, less
 * under battery saver) to send calls made while it was closed. Defined at
 * import time, from index.ts, because Android may start the app just to run it.
 */
if (Platform.OS === "android") {
  TaskManager.defineTask(SYNC_TASK, async () => {
    try {
      const r = await syncNow();
      return r.reason === "error" ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSync() {
  if (Platform.OS !== "android") return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (!(await TaskManager.isTaskRegisteredAsync(SYNC_TASK))) {
    await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 15 });
  }
}

export async function unregisterBackgroundSync() {
  if (Platform.OS !== "android") return;
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
}
