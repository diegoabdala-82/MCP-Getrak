import { describe, expect, it, vi } from "vitest";
import { HttpOAuth2Client, TokenRequestFailedError } from "../../src/foundation/auth/oauth2-client.js";

function fakeFetch(response: Response) {
  return vi.fn().mockResolvedValue(response);
}

describe("HttpOAuth2Client — formato real do endpoint de token da Getrak API Core", () => {
  it("autentica o client via HTTP Basic Auth (client_id:client_secret em base64), não no corpo do form", async () => {
    const fetchImpl = fakeFetch(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
    );
    const client = new HttpOAuth2Client(fetchImpl);

    await client.fetchToken({
      auth_scheme: "oauth2ClientCredentials",
      client_id: "cid",
      client_secret: "csecret",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    const [, options] = fetchImpl.mock.calls[0];
    const expectedAuth = `Basic ${Buffer.from("cid:csecret").toString("base64")}`;
    expect(options.headers.Authorization).toBe(expectedAuth);

    const sentBody = new URLSearchParams(options.body);
    expect(sentBody.get("client_id")).toBeNull();
    expect(sentBody.get("client_secret")).toBeNull();
    expect(sentBody.get("grant_type")).toBe("client_credentials");
  });

  it("envia username/password no corpo para o grant password (credenciais do resource owner, não do client)", async () => {
    const fetchImpl = fakeFetch(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
    );
    const client = new HttpOAuth2Client(fetchImpl);

    await client.fetchToken({
      auth_scheme: "oauth2Password",
      client_id: "cid",
      client_secret: "csecret",
      username: "user@example.com",
      password: "pass",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    const [, options] = fetchImpl.mock.calls[0];
    const sentBody = new URLSearchParams(options.body);
    expect(sentBody.get("grant_type")).toBe("password");
    expect(sentBody.get("username")).toBe("user@example.com");
    expect(sentBody.get("password")).toBe("pass");
  });

  it("lança TokenRequestFailedError com o status HTTP quando o token endpoint rejeita a credencial", async () => {
    const fetchImpl = fakeFetch(new Response(null, { status: 401 }));
    const client = new HttpOAuth2Client(fetchImpl);

    const promise = client.fetchToken({
      auth_scheme: "oauth2ClientCredentials",
      client_id: "cid",
      client_secret: "wrong",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });

    await expect(promise).rejects.toBeInstanceOf(TokenRequestFailedError);
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });
});
