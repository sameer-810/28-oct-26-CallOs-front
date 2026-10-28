import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
    // mutations fail visibly so nobody thinks an unsaved change was saved
    mutations: { networkMode: "always" },
  },
});
