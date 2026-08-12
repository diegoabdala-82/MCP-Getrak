/**
 * US-001 — Autenticação técnica por ambiente.
 *
 * Segredos armazenados em AWS Secrets Manager, criptografados com AWS KMS
 * (TD-02). Acesso via IAM Roles for Tasks — nunca credenciais AWS estáticas.
 * Credenciais técnicas são resolvidas por ambiente — nunca gerenciadas pelo
 * agente consumidor (CLAUDE.md Seção 6).
 */

import type { Environment } from "../../config/environment.js";
import type { AuthScheme, AuthSecret } from "./types.js";

export interface SecretsProvider {
  getSecret(environment: Environment, authScheme: AuthScheme): Promise<AuthSecret>;
}

export class MissingSecretError extends Error {
  constructor(environment: Environment, authScheme: AuthScheme, missingVar: string) {
    super(
      `Missing technical credential for environment "${environment}" / scheme "${authScheme}": ` +
        `expected environment variable "${missingVar}" to be set.`,
    );
    this.name = "MissingSecretError";
  }
}

/**
 * Resolve credenciais técnicas a partir de variáveis de ambiente do processo
 * do servidor MCP, seguindo a convenção
 * `GETRAK_MCP_{ENVIRONMENT}_{AUTH_SCHEME}_{FIELD}`. Serve como implementação
 * de referência local/dev e como contrato para a implementação real baseada
 * em AWS Secrets Manager (TD-02), que deve implementar a mesma interface
 * `SecretsProvider` lendo do Secrets Manager em vez de `process.env`.
 */
export class EnvSecretsProvider implements SecretsProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async getSecret(environment: Environment, authScheme: AuthScheme): Promise<AuthSecret> {
    const prefix = `GETRAK_MCP_${environment.toUpperCase()}_${schemeEnvSegment(authScheme)}`;

    const clientId = this.require(`${prefix}_CLIENT_ID`, environment, authScheme);
    const clientSecret = this.require(`${prefix}_CLIENT_SECRET`, environment, authScheme);
    const tokenUrl = this.require(`${prefix}_TOKEN_URL`, environment, authScheme);

    if (authScheme === "oauth2ClientCredentials") {
      return {
        auth_scheme: "oauth2ClientCredentials",
        client_id: clientId,
        client_secret: clientSecret,
        token_url: tokenUrl,
      };
    }

    const username = this.require(`${prefix}_USERNAME`, environment, authScheme);
    const password = this.require(`${prefix}_PASSWORD`, environment, authScheme);

    return {
      auth_scheme: "oauth2Password",
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
      token_url: tokenUrl,
    };
  }

  private require(varName: string, environment: Environment, authScheme: AuthScheme): string {
    const value = this.env[varName];
    if (!value) {
      throw new MissingSecretError(environment, authScheme, varName);
    }
    return value;
  }
}

function schemeEnvSegment(authScheme: AuthScheme): string {
  return authScheme === "oauth2ClientCredentials" ? "CLIENT_CREDENTIALS" : "PASSWORD";
}
