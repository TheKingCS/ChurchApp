const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  id_token: string;
  access_token: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || "Google token exchange failed");
  }
  return data;
}

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
};

/**
 * Reads the claims out of the ID token's payload segment without verifying
 * its signature. Safe here specifically because the token was just
 * retrieved directly from Google's token endpoint over a server-to-server
 * HTTPS call authenticated with our client secret — it never passed through
 * the browser — so the transport itself is the trust boundary. `aud`/`iss`
 * are still checked as a sanity check against a misconfigured client id.
 */
export function decodeGoogleIdToken(idToken: string): GoogleIdTokenClaims {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed Google ID token");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Google ID token audience mismatch");
  }
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") {
    throw new Error("Google ID token issuer mismatch");
  }
  return claims;
}
