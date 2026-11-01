/** Browser WebAuthn (Passkey) helpers with base64url conversion and cancellation support. */

export function isPasskeySupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator?.credentials?.create === "function" &&
    typeof navigator?.credentials?.get === "function"
  );
}

export function fromBase64Url(value) {
  const normalized = String(value ?? "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  const binary = atob(normalized + "=".repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function toBase64Url(buffer) {
  if (!buffer) return null;
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : ArrayBuffer.isView(buffer)
        ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeUserFriendlyError(error, fallback) {
  if (!error) return new Error(fallback);
  if (error.name === "AbortError") return error;
  if (error.name === "NotAllowedError") {
    return new Error(
      "Passkey verification was cancelled or timed out. Try again.",
    );
  }
  if (error.name === "InvalidStateError") {
    return new Error("This passkey is already registered on this account.");
  }
  if (error.name === "SecurityError") {
    return new Error(
      "Passkeys require a secure origin (HTTPS or localhost) matching the server hostname.",
    );
  }
  return error instanceof Error ? error : new Error(fallback);
}

/**
 * Run `navigator.credentials.create` using server-provided PublicKeyCredentialCreationOptions
 * and return a JSON-serializable credential object for `complete_passkey_registration`.
 */
export async function createPasskeyCredential(publicKey, signal) {
  if (!isPasskeySupported()) {
    throw new Error("This browser does not support passkeys (WebAuthn).");
  }
  const creationOptions = {
    ...publicKey,
    challenge: fromBase64Url(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: fromBase64Url(publicKey.user.id),
    },
    excludeCredentials: (publicKey.excludeCredentials ?? []).map((item) => ({
      ...item,
      id: fromBase64Url(item.id),
    })),
  };
  let credential;
  try {
    credential = /** @type {PublicKeyCredential | null} */ (
      await navigator.credentials.create({
        publicKey: creationOptions,
        ...(signal ? { signal } : {}),
      })
    );
  } catch (error) {
    throw normalizeUserFriendlyError(
      error,
      "Unable to register passkey with this device.",
    );
  }
  if (!credential) {
    throw new Error("Passkey registration was cancelled.");
  }
  const response = /** @type {AuthenticatorAttestationResponse} */ (
    credential.response
  );
  const transports =
    typeof response.getTransports === "function"
      ? response.getTransports()
      : [];
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
      transports: Array.isArray(transports) ? transports : [],
    },
  };
}

/**
 * Run `navigator.credentials.get` using server-provided PublicKeyCredentialRequestOptions
 * and return a JSON-serializable assertion object for `complete_passkey_login` or `verify_account_security_passkey`.
 */
export async function getPasskeyAssertion(publicKey, signal) {
  if (!isPasskeySupported()) {
    throw new Error("This browser does not support passkeys (WebAuthn).");
  }
  const requestOptions = {
    ...publicKey,
    challenge: fromBase64Url(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials ?? []).map((item) => ({
      ...item,
      id: fromBase64Url(item.id),
    })),
  };
  let credential;
  try {
    credential = /** @type {PublicKeyCredential | null} */ (
      await navigator.credentials.get({
        publicKey: requestOptions,
        ...(signal ? { signal } : {}),
      })
    );
  } catch (error) {
    throw normalizeUserFriendlyError(
      error,
      "Unable to verify passkey with this device.",
    );
  }
  if (!credential) {
    throw new Error("Passkey verification was cancelled.");
  }
  const response = /** @type {AuthenticatorAssertionResponse} */ (
    credential.response
  );
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    },
  };
}
