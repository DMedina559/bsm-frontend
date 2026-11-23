import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPasskeyCredential,
  fromBase64Url,
  getPasskeyAssertion,
  isPasskeySupported,
  toBase64Url,
} from "../../../src/app/passkeys";

describe("passkeys helpers", () => {
  const originalPublicKey = window.PublicKeyCredential;
  const originalCredentials = navigator.credentials;

  afterEach(() => {
    window.PublicKeyCredential = originalPublicKey;
    Object.defineProperty(navigator, "credentials", {
      value: originalCredentials,
      configurable: true,
    });
  });

  it("round-trips base64url bytes", () => {
    const sample = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = toBase64Url(sample);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(Array.from(fromBase64Url(encoded))).toEqual(Array.from(sample));
  });

  it("creates and serializes a WebAuthn registration credential", async () => {
    window.PublicKeyCredential = function PublicKeyCredential() {};
    const createMock = vi.fn().mockResolvedValue({
      id: "cred-1",
      rawId: new Uint8Array([1, 2, 3, 4]).buffer,
      type: "public-key",
      authenticatorAttachment: "platform",
      response: {
        clientDataJSON: new Uint8Array([10, 20]).buffer,
        attestationObject: new Uint8Array([30, 40]).buffer,
        getTransports: () => ["internal", "hybrid"],
      },
    });
    Object.defineProperty(navigator, "credentials", {
      value: { create: createMock, get: vi.fn() },
      configurable: true,
    });

    expect(isPasskeySupported()).toBe(true);
    const result = await createPasskeyCredential({
      challenge: toBase64Url(new Uint8Array([9, 9, 9])),
      rp: { name: "BSM", id: "localhost" },
      user: {
        id: toBase64Url(new Uint8Array([7, 7])),
        name: "owner",
        displayName: "owner",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      excludeCredentials: [
        { type: "public-key", id: toBase64Url(new Uint8Array([5, 5])) },
      ],
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: "cred-1",
      rawId: toBase64Url(new Uint8Array([1, 2, 3, 4])),
      type: "public-key",
      authenticatorAttachment: "platform",
      response: {
        clientDataJSON: toBase64Url(new Uint8Array([10, 20])),
        attestationObject: toBase64Url(new Uint8Array([30, 40])),
        transports: ["internal", "hybrid"],
      },
    });
  });

  it("requests and serializes a WebAuthn assertion and maps NotAllowedError", async () => {
    window.PublicKeyCredential = function PublicKeyCredential() {};
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: "cred-1",
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        type: "public-key",
        authenticatorAttachment: "cross-platform",
        response: {
          clientDataJSON: new Uint8Array([11, 22]).buffer,
          authenticatorData: new Uint8Array([33, 44]).buffer,
          signature: new Uint8Array([55, 66]).buffer,
          userHandle: new Uint8Array([77, 88]).buffer,
        },
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("cancelled"), { name: "NotAllowedError" }),
      );
    Object.defineProperty(navigator, "credentials", {
      value: { create: vi.fn(), get: getMock },
      configurable: true,
    });

    const assertion = await getPasskeyAssertion({
      challenge: toBase64Url(new Uint8Array([1, 2, 3])),
      allowCredentials: [
        { type: "public-key", id: toBase64Url(new Uint8Array([4, 5, 6])) },
      ],
    });
    expect(assertion).toEqual({
      id: "cred-1",
      rawId: toBase64Url(new Uint8Array([1, 2, 3, 4])),
      type: "public-key",
      authenticatorAttachment: "cross-platform",
      response: {
        clientDataJSON: toBase64Url(new Uint8Array([11, 22])),
        authenticatorData: toBase64Url(new Uint8Array([33, 44])),
        signature: toBase64Url(new Uint8Array([55, 66])),
        userHandle: toBase64Url(new Uint8Array([77, 88])),
      },
    });

    await expect(
      getPasskeyAssertion({
        challenge: toBase64Url(new Uint8Array([1, 2, 3])),
      }),
    ).rejects.toThrow(/cancelled or timed out/i);
  });
});
