import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CallTracker } from "@/modules/call-tracker";
import { useAuthStore } from "@shared/store/useAuthStore";
import { palette } from "@shared/designSystem";
import { useDeviceStore } from "@modules/device/deviceStore";
import { unregisterBackgroundSync } from "@modules/device/backgroundSync";
import DeviceSetupScreen from "@modules/device/screens/DeviceSetupScreen";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import type { RootParamList } from "./types";

const Stack = createNativeStackNavigator<RootParamList>();

function useDeviceHydrated() {
  const [ready, setReady] = useState(() => useDeviceStore.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    return useDeviceStore.persist.onFinishHydration(() => setReady(true));
  }, [ready]);
  return ready;
}

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const deviceReady = useDeviceHydrated();
  const setupDone = useDeviceStore((s) => s.setupDone);
  const setupSkipped = useDeviceStore((s) => s.setupSkipped);

  // the stored session is read asynchronously; check it only once it has loaded
  useEffect(() => {
    const run = () => void useAuthStore.getState().initializeAuth();
    if (useAuthStore.persist.hasHydrated()) run();
    else return useAuthStore.persist.onFinishHydration(run);
  }, []);

  // signing out forgets this phone's tracking setup: the next person sets up their own SIM
  useEffect(() => {
    if (isAuthChecked && !isAuthenticated && deviceReady && useDeviceStore.getState().setupDone) {
      useDeviceStore.getState().reset();
      void unregisterBackgroundSync();
    }
  }, [isAuthChecked, isAuthenticated, deviceReady]);

  if (!isAuthChecked || !deviceReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={palette.ink} />
      </View>
    );
  }

  const needsSetup = Boolean(CallTracker) && !setupDone && !setupSkipped;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : needsSetup ? (
        <Stack.Screen name="DeviceSetup" component={DeviceSetupScreen} />
      ) : (
        <Stack.Screen name="App" component={AppNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.paper },
});
