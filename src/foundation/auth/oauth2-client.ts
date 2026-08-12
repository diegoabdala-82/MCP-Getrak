/**
 * US-001 — Autenticação técnica por ambiente.
 * Executa os dois fluxos OAuth2 suportados pela API Core:
 * `oauth2ClientCredentials` (grant_type=client_credentials) e
 * `oauth2Password` (grant_type=password).
 */

import { fetchWithTimeout, SIMPLE_CALL_TIMEOUT_MS, type FetchLike } from "../http/http-client.js";
import type { AuthSecret, TokenResponse } from "./types.js";

export interface OAuth2Client {
  fetchToken(secret: AuthSecret): Promise<TokenResponse>;
}

interface RawTokenResponseBody {
  access_token: string;
  expires_in: number;
}

export class TokenRequestFailedError extends Error {
  constructor(status: number) {
    super(`Token request to the Getrak API Core failed with status ${status}.`);
    this.name = "TokenRequestFailedError";
  }
}

export class HttpOAuth2Client implements OAuth2Client {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchToken(secret: AuthSecret): Promise<TokenResponse> {
    const body = new URLSearchParams();

    if (secret.auth_scheme === "oauth2ClientCredentials") {
      body.set("grant_type", "client_credentials");
      body.set("client_id", secret.client_id);
      body.set("client_secret", secret.client_secret);
    } else {
      body.set("grant_type", "password");
      body.set("client_id", secret.client_id);
      body.set("client_secret", secret.client_secret);
      body.set("username", secret.username);
      body.set("password", secret.password);
    }

    const response = await fetchWithTimeout(
      {
        method: "POST",
        url: secret.token_url,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        timeoutMs: SIMPLE_CALL_TIMEOUT_MS,
      },
      this.fetchImpl,
    );

    if (!response.ok) {
      throw new TokenRequestFailedError(response.status);
    }

    const json = (await response.json()) as RawTokenResponseBody;
    return { access_token: json.access_token, expires_in: json.expires_in };
  }
}
