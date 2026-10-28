import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@shared/store/useAuthStore";
import { authApi, type JoinInput, type SignUpInput } from "../api/authApi";

export function useSignIn() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: ({ identifier, password }: { identifier: string; password: string }) =>
      authApi.signIn(identifier, password),
    onSuccess: setSession,
  });
}

export function useSignUp() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({ mutationFn: (input: SignUpInput) => authApi.signUp(input), onSuccess: setSession });
}

export function useJoin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({ mutationFn: (input: JoinInput) => authApi.join(input), onSuccess: setSession });
}

/**
 * Tokens minted before a password change stop working, so the ones the
 * server returns replace them at once — the person stays signed in here.
 */
export function useChangePassword() {
  const updateTokens = useAuthStore((s) => s.updateTokens);
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => authApi.changePassword(body),
    onSuccess: (t) => updateTokens(t.accessToken, t.refreshToken),
  });
}

export function useCodePreview() {
  return useMutation({ mutationFn: (code: string) => authApi.previewCode(code) });
}

/**
 * Re-reads who you are on launch. A role changed or a code rotated since the
 * last sign-in shows up here without signing out.
 */
export function useMe() {
  const setProfile = useAuthStore((s) => s.setProfile);
  const query = useQuery({ queryKey: ["me"], queryFn: authApi.me });
  useEffect(() => {
    if (query.data) setProfile(query.data.user, query.data.company);
  }, [query.data, setProfile]);
  return query;
}
