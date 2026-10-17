import { describe, it, expect } from "vitest";
import { parseAuthCallbackError, friendlyAuthCallbackMessage, urlWithAuthParamsCleared } from "../authCallback.js";

describe("parseAuthCallbackError", () => {
  it("parses an expired-link error from the URL hash (implicit-flow placement)", () => {
    const err = parseAuthCallbackError("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "");
    expect(err).toEqual({ code: "otp_expired", description: "Email link is invalid or has expired" });
  });

  it("parses an error from the query string when it's not in the hash (alternate flow placement)", () => {
    const err = parseAuthCallbackError("", "?error=access_denied&error_code=otp_expired&error_description=Link+expired");
    expect(err).toEqual({ code: "otp_expired", description: "Link expired" });
  });

  it("returns null when there is no error — the normal successful-callback and non-callback cases", () => {
    expect(parseAuthCallbackError("", "")).toBeNull();
    expect(parseAuthCallbackError("#access_token=abc&token_type=bearer", "")).toBeNull();
  });

  it("falls back to the raw error code as the description when Supabase doesn't send one", () => {
    const err = parseAuthCallbackError("#error=server_error", "");
    expect(err.code).toBe("server_error");
    expect(err.description).toBe("That sign-in link didn't work.");
  });
});

describe("friendlyAuthCallbackMessage", () => {
  it("gives an actionable message for an expired link", () => {
    expect(friendlyAuthCallbackMessage({ code: "otp_expired", description: "x" })).toMatch(/expired/i);
  });

  it("gives an actionable message for an already-used link", () => {
    expect(friendlyAuthCallbackMessage({ code: "access_denied", description: "x" })).toMatch(/already been used|couldn't be verified/i);
  });

  it("returns null when there is no error — never shows a phantom banner", () => {
    expect(friendlyAuthCallbackMessage(null)).toBeNull();
  });
});

describe("urlWithAuthParamsCleared", () => {
  it("strips error params from both hash and query, keeping the path", () => {
    const cleaned = urlWithAuthParamsCleared("https://app.example.com/?error=access_denied&error_code=otp_expired#error=access_denied");
    expect(cleaned).toBe("/");
  });

  it("never touches unrelated query params", () => {
    const cleaned = urlWithAuthParamsCleared("https://app.example.com/?ref=email&error=access_denied");
    expect(cleaned).toBe("/?ref=email");
  });
});
