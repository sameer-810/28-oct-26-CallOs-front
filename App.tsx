import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { useFonts } from "expo-font";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { Newsreader_400Regular, Newsreader_500Medium } from "@expo-google-fonts/newsreader";

import RootNavigator from "@navigation/RootNavigator";
import type { RootParamList } from "@navigation/types";
import { queryClient } from "@api/queryClient";
import { fonts, palette } from "@shared/designSystem";
import { environment } from "@config/env";

void SplashScreen.preventAutoHideAsync();

// the landing page links to /sign-in and /sign-up; a shared join link is /join/CODE
const linking: LinkingOptions<RootParamList> = {
  prefixes: [Linking.createURL("/")],
  config: {
    screens: {
      Auth: {
        screens: {
          SignIn: "sign-in",
          SignUp: "sign-up",
          Join: "join/:code?",
        },
      },
      DeviceSetup: "setup",
      App: {
        screens: {
          Home: "",
          Calls: {
            path: "calls",
            // the after-call notification opens callos://after-call
            alias: [{ path: "after-call", exact: true, parse: { afterCall: () => String(Date.now()) } }],
          },
          Opportunities: "opportunities",
          Reports: "reports/:tab?",
          Agent: "agent",
          Inbox: "inbox",
          Playbook: "scripts/:tab?",
          Billing: "billing",
          Team: "team",
          Settings: "settings",
          Account: "account",
          More: "more",
        },
      },
    },
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    Newsreader_400Regular,
    Newsreader_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer
          linking={linking}
          documentTitle={{ formatter: (opts) => opts?.title ?? environment.appName }}
          theme={{
            dark: false,
            colors: {
              primary: palette.ink,
              background: palette.paper,
              card: palette.card,
              text: palette.ink,
              border: palette.rule,
              notification: palette.missed,
            },
            fonts: {
              regular: { fontFamily: fonts.text, fontWeight: "400" },
              medium: { fontFamily: fonts.textMedium, fontWeight: "500" },
              bold: { fontFamily: fonts.textSemi, fontWeight: "600" },
              heavy: { fontFamily: fonts.textSemi, fontWeight: "600" },
            },
          }}
        >
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
