/**
 * US-001 — Autenticação técnica por ambiente.
 * Executa os dois fluxos OAuth2 suportados pela API Core:
 * `oauth2ClientCredentials` (grant_type=client_credentials) e
 * `oauth2Password` (grant_type=password).
 *
 * Autenticação do cliente OAuth via HTTP Basic Auth
 * (`Authorization: Basic base64(client_id:client_secret)`), conforme RFC
 * 6749 §2.3.1 e confirmado contra um exemplo real de chamada ao endpoint de
 * token da Getrak API Core (`/newkoauth/oauth/token`) — client_id/secret não
 * vão no corpo do form, só no header. `username`/`password` (grant
 * password) continuam no corpo, pois são credenciais do resource owner, não
 * do client OAuth.
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
  readonly status: number;

  constructor(status: number) {
    super(`Token request to the Getrak API Core failed with status ${status}.`);
    this.name = "TokenRequestFailedError";
    this.status = status;
  }
}

function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  const credentials = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

export class HttpOAuth2Client implements OAuth2Client {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchToken(secret: AuthSecret): Promise<TokenResponse> {
    const body = new URLSearchParams();

    if (secret.auth_scheme === "oauth2ClientCredentials") {
      body.set("grant_type", "client_credentials");
    } else {
      body.set("grant_type", "password");
      body.set("username", secret.username);
      body.set("password", secret.password);
    }

    const response = await fetchWithTimeout(
      {
        method: "POST",
        url: secret.token_url,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: buildBasicAuthHeader(secret.client_id, secret.client_secret),
        },
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
