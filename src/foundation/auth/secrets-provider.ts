/**
 * US-001 — Autenticação técnica por ambiente.
 *
 * Segredos armazenados em AWS Secrets Manager, criptografados com AWS KMS
 * (TD-02). Acesso via IAM Roles for Tasks — nunca credenciais AWS estáticas.
 * Credenciais técnicas são resolvidas por ambiente — nunca gerenciadas pelo
 * agente consumidor (CLAUDE.md Seção 6).
 *
 * `central` é um parâmetro de resolução da credencial, não apenas de cache:
 * verificado contra o `openapi.json` real da Getrak API Core (Fase 2,
 * pesquisa para US-008 a US-012) — nenhum dos endpoints
 * `oauth2ClientCredentials`/escopo `Integracao` usados pelas tools de
 * veículos aceita `central`/`central_id` como parâmetro de request (nem
 * query, nem path), ao contrário de várias rotas v1.0/v2.0 (webhooks,
 * installers, equipments, commands) que o fazem explicitamente. Combinado
 * com o namespace de cache de token do TD-04 já incluir central mesmo para
 * `oauth2ClientCredentials`, a explicação mais plausível é que, para o
 * escopo `Integracao`, o isolamento por central é resolvido pela própria
 * credencial técnica (uma credencial por central), não por um parâmetro de
 * chamada. Isso não está documentado explicitamente em nenhuma fonte de
 * produto — é uma inferência a partir da especificação técnica real, então
 * o provider tenta primeiro uma credencial específica da central e cai para
 * uma credencial única (central-agnostic) quando ela não existir, em vez de
 * travar nessa hipótese como definitiva.
 */

import type { Environment } from "../../config/environment.js";
import type { AuthScheme, AuthSecret } from "./types.js";

export interface SecretsProvider {
  getSecret(environment: Environment, central: string, authScheme: AuthScheme): Promise<AuthSecret>;
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
 * do servidor MCP. Tenta primeiro a convenção específica por central
 * (`GETRAK_MCP_{ENVIRONMENT}_{CENTRAL}_{AUTH_SCHEME}_{FIELD}`) e cai para a
 * convenção central-agnostic (`GETRAK_MCP_{ENVIRONMENT}_{AUTH_SCHEME}_{FIELD}`)
 * quando a específica não estiver configurada. Serve como implementação de
 * referência local/dev e como contrato para a implementação real baseada em
 * AWS Secrets Manager (TD-02), que deve implementar a mesma interface
 * `SecretsProvider` lendo do Secrets Manager em vez de `process.env`.
 */
export class EnvSecretsProvider implements SecretsProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async getSecret(environment: Environment, central: string, authScheme: AuthScheme): Promise<AuthSecret> {
    const centralSpecificPrefix = `GETRAK_MCP_${environment.toUpperCase()}_${sanitizeForEnvVar(central)}_${schemeEnvSegment(authScheme)}`;
    const fallbackPrefix = `GETRAK_MCP_${environment.toUpperCase()}_${schemeEnvSegment(authScheme)}`;
    const prefix = this.env[`${centralSpecificPrefix}_CLIENT_ID`] ? centralSpecificPrefix : fallbackPrefix;

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

/** Torna um id de central seguro para compor um nome de variável de ambiente. */
function sanitizeForEnvVar(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}
