/**
 * US-001 — Autenticação técnica por ambiente.
 *
 * Orquestra: resolução da credencial técnica por ambiente/esquema, consulta
 * ao cache de tokens (TD-04), e renovação via OAuth2 quando ausente/expirado.
 * Nunca loga o valor do token, sob nenhuma circunstância.
 */

import type { Environment } from "../../config/environment.js";
import type { OAuth2Client } from "./oauth2-client.js";
import type { SecretsProvider } from "./secrets-provider.js";
import {
  buildTokenNamespace,
  TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS,
  type TokenCache,
} from "./token-cache.js";
import type { AuthScheme, AuthSecret } from "./types.js";

export interface GetAccessTokenParams {
  environment: Environment;
  central: string;
  authScheme: AuthScheme;
}

export class AuthManager {
  constructor(
    private readonly secretsProvider: SecretsProvider,
    private readonly tokenCache: TokenCache,
    private readonly oauth2Client: OAuth2Client,
    private readonly now: () => number = Date.now,
  ) {}

  async getAccessToken(params: GetAccessTokenParams): Promise<string> {
    const secret = await this.secretsProvider.getSecret(params.environment, params.authScheme);
    const namespace = buildTokenNamespace({
      environment: params.environment,
      central: params.central,
      authScheme: params.authScheme,
      credentialId: deriveCredentialId(secret),
    });

    const cached = await this.tokenCache.get(namespace);
    const now = this.now();
    if (cached && cached.expires_at > now) {
      return cached.access_token;
    }

    const tokenResponse = await this.oauth2Client.fetchToken(secret);
    const ttlSeconds = Math.max(tokenResponse.expires_in - TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS, 0);
    const expiresAt = now + ttlSeconds * 1000;

    await this.tokenCache.set(
      namespace,
      { access_token: tokenResponse.access_token, expires_at: expiresAt },
      ttlSeconds,
    );

    return tokenResponse.access_token;
  }
}

/**
 * Identificador não sensível da credencial, usado apenas para compor o
 * namespace de cache — nunca o client_secret/password em si.
 */
function deriveCredentialId(secret: AuthSecret): string {
  return secret.client_id;
}
