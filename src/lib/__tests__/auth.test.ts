import { test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockJwtVerify = vi.fn();
vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
  SignJWT: vi.fn(),
}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(mockCookieStore),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const validPayload = {
  userId: "user-123",
  email: "test@example.com",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

test("getSession returns null when no cookie exists", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const { getSession } = await import("@/lib/auth");
  const result = await getSession();

  expect(result).toBeNull();
  expect(mockJwtVerify).not.toHaveBeenCalled();
});

test("getSession returns session payload for a valid token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "valid.jwt.token" });
  mockJwtVerify.mockResolvedValue({ payload: validPayload });

  const { getSession } = await import("@/lib/auth");
  const result = await getSession();

  expect(result?.userId).toBe("user-123");
  expect(result?.email).toBe("test@example.com");
});

test("getSession returns null for a malformed token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "bad.token" });
  mockJwtVerify.mockRejectedValue(new Error("JWTMalformed"));

  const { getSession } = await import("@/lib/auth");
  const result = await getSession();

  expect(result).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "expired.jwt.token" });
  mockJwtVerify.mockRejectedValue(new Error("JWTExpired"));

  const { getSession } = await import("@/lib/auth");
  const result = await getSession();

  expect(result).toBeNull();
});

test("getSession returns null for a token signed with a different secret", async () => {
  mockCookieStore.get.mockReturnValue({ value: "wrong.secret.token" });
  mockJwtVerify.mockRejectedValue(new Error("JWSSignatureVerificationFailed"));

  const { getSession } = await import("@/lib/auth");
  const result = await getSession();

  expect(result).toBeNull();
});

test("getSession passes the auth-token cookie value to jwtVerify", async () => {
  mockCookieStore.get.mockReturnValue({ value: "some.token.value" });
  mockJwtVerify.mockResolvedValue({ payload: validPayload });

  const { getSession } = await import("@/lib/auth");
  await getSession();

  expect(mockJwtVerify).toHaveBeenCalledWith(
    "some.token.value",
    expect.anything()
  );
});
