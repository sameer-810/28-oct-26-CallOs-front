import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SignInScreen from "@modules/auth/screens/SignInScreen";
import SignUpScreen from "@modules/auth/screens/SignUpScreen";
import JoinScreen from "@modules/auth/screens/JoinScreen";
import { environment } from "@config/env";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: `Sign in · ${environment.appName}` }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: `Create account · ${environment.appName}` }} />
      <Stack.Screen name="Join" component={JoinScreen} options={{ title: `Join your team · ${environment.appName}` }} />
    </Stack.Navigator>
  );
}
