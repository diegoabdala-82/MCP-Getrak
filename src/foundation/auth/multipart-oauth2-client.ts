/**
 * US-046 — Autenticação via token delegado por sessão do usuário.
 *
 * Confirmado contra uma chamada real fornecida pelo time (16/08/2026) ao
 * endpoint de emissão de token para o escopo `GetrakWeb`: diferente de
 * `HttpOAuth2Client` (usado por `AuthManager` para o modelo técnico de
 * Epic 1/3/5, não tocado por esta mudança), o fluxo delegado exige:
 *
 * - Corpo `multipart/form-data` (`--form` no curl de exemplo), não
 *   `application/x-www-form-urlencoded`.
 * - Client OAuth via HTTP Basic Auth, igual ao modelo técnico (RFC 6749
 *   §2.3.1) — `client_id`/`client_secret` continuam fora do corpo do form.
 *
 * Mantido como implementação separada de `HttpOAuth2Client` (em vez de
 * ramificar o formato dentro dela) porque não há confirmação de que o
 * modelo técnico (`oauth2Password`/`PublicoCliente`, Epic 3/5, já testado
 * contra produção real com `x-www-form-urlencoded`) aceite/precise do
 * mesmo formato — mudar o comportamento dela poderia regredir um fluxo já
 * validado que esta tarefa foi instruída a não tocar.
 */

import { buildBasicAuthHeader, TokenRequestFailedError } from "./oauth2-client.js";
import type { OAuth2Client } from "./oauth2-client.js";
import type { AuthSecret, TokenResponse } from "./types.js";
import { fetchWithTimeout, SIMPLE_CALL_TIMEOUT_MS, type FetchLike } from "../http/http-client.js";

interface RawTokenResponseBody {
  access_token: string;
  expires_in: number;
}

export class MultipartFormOAuth2Client implements OAuth2Client {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async fetchToken(secret: AuthSecret): Promise<TokenResponse> {
    const form = new FormData();

    if (secret.auth_scheme === "oauth2ClientCredentials") {
      form.set("grant_type", "client_credentials");
    } else {
      form.set("grant_type", "password");
      form.set("username", secret.username);
      form.set("password", secret.password);
    }

    const response = await fetchWithTimeout(
      {
        method: "POST",
        url: secret.token_url,
        headers: {
          Authorization: buildBasicAuthHeader(secret.client_id, secret.client_secret),
        },
        body: form,
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
