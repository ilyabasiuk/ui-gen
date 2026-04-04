import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/actions", () => ({
  signIn: mockSignIn,
  signUp: mockSignUp,
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: mockGetAnonWorkData,
  clearAnonWork: mockClearAnonWork,
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: mockGetProjects,
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: mockCreateProject,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
});

const { useAuth } = await import("@/hooks/use-auth");

describe("useAuth", () => {
  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    test("returns the result from the signIn action", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;

      await act(async () => {
        returnValue = await result.current.signIn("user@test.com", "password");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("sets isLoading to true during sign in and false after", async () => {
      let resolveSignIn!: (v: unknown) => void;
      mockSignIn.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@test.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false, error: "Invalid credentials" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns error result without redirecting when signIn fails", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@test.com", "wrong");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even if signIn action throws", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@test.com", "password").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    test("returns the result from the signUp action", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "new-proj" });

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;

      await act(async () => {
        returnValue = await result.current.signUp("new@test.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("sets isLoading during sign up and clears it after", async () => {
      let resolveSignUp!: (v: unknown) => void;
      mockSignUp.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@test.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false, error: "Email already registered" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not redirect when signUp fails", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@test.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even if signUp action throws", async () => {
      mockSignUp.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("user@test.com", "password").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("post sign-in: anonymous work exists", () => {
    const anonWork = {
      messages: [{ role: "user", content: "make a button" }],
      fileSystemData: { "/": {}, "/App.tsx": "export default () => <button />" },
    };

    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue(anonWork);
      mockCreateProject.mockResolvedValue({ id: "anon-proj-1" });
    });

    test("creates a project with the anon work on successful signIn", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
    });

    test("clears anon work after creating the project", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockClearAnonWork).toHaveBeenCalled();
    });

    test("redirects to the new project after creating it from anon work", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/anon-proj-1");
    });

    test("does not call getProjects when anon work exists", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in: no anonymous work, existing projects", () => {
    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "existing-1" }, { id: "existing-2" }]);
    });

    test("redirects to the most recent project", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-1");
    });

    test("does not create a new project when one already exists", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in: no anonymous work, no existing projects", () => {
    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-proj" });
    });

    test("creates a new blank project", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
    });

    test("redirects to the newly created blank project", async () => {
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
    });
  });

  describe("post sign-in: anon work present but no messages", () => {
    test("treats empty-messages anon work as no anon work", async () => {
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([{ id: "proj-existing" }]);
      mockSignIn.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/proj-existing");
    });
  });
});
