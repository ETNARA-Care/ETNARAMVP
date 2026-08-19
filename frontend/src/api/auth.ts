import { apiFetch, setToken } from "./client";

export interface MeOrganization {
  id: string;
  name: string;
  type: string;
  membershipStatus: string;
  roles: string[];
}
export interface MeResult {
  user: { id: string; email: string | null; phone: string | null };
  organizations: MeOrganization[];
}

export async function login(identifier: string, password: string): Promise<void> {
  const isEmail = identifier.includes("@");
  const body = isEmail ? { email: identifier, password } : { phone: identifier, password };
  const result = await apiFetch<{ token: string; expiresAt: string }>("/auth/login", {
    method: "POST",
    body,
  });
  setToken(result.token);
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}

export async function getMe(): Promise<MeResult> {
  return apiFetch<MeResult>("/me");
}
