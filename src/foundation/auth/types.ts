/**
 * US-001 — Autenticação técnica por ambiente.
 *
 * A API Core usa dois esquemas OAuth2: `oauth2ClientCredentials` e
 * `oauth2Password`. Algumas tools aceitam ambos dependendo do escopo; a tool
 * composta `get_vehicle_operational_context` (US-029) usa os dois
 * simultaneamente (CLAUDE.md Seção 6).
 */

export const AUTH_SCHEMES = ["oauth2ClientCredentials", "oauth2Password"] as const;
export type AuthScheme = (typeof AUTH_SCHEMES)[number];

export interface ClientCredentialsSecret {
  auth_scheme: "oauth2ClientCredentials";
  client_id: string;
  client_secret: string;
  token_url: string;
}

export interface PasswordGrantSecret {
  auth_scheme: "oauth2Password";
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  token_url: string;
}

export type AuthSecret = ClientCredentialsSecret | PasswordGrantSecret;

export interface TokenResponse {
  access_token: string;
  /** Segundos até a expiração, conforme resposta OAuth2 padrão. */
  expires_in: number;
}
