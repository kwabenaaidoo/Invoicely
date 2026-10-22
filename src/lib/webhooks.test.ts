import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./env", () => ({ env: { ENCRYPTION_KEY: undefined, NODE_ENV: "test" }, isProd: false }));

import { isPrivateAddress, signPayload } from "./webhooks";
import { createHmac } from "node:crypto";

describe("webhook signing", () => {
  it("produces a verifiable t=...,v1=... header", () => {
    const header = signPayload("whsec_test", '{"a":1}', 1700000000);
    const expected = createHmac("sha256", "whsec_test").update('1700000000.{"a":1}').digest("hex");
    expect(header).toBe(`t=1700000000,v1=${expected}`);
  });
});

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.5.5", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(["8.8.8.8", "1.1.1.1", "203.0.113.9", "2606:4700:4700::1111"])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});
