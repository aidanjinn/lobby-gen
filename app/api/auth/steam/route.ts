import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const returnTo = `${origin}/api/auth/steam/callback`;
  const state = randomBytes(24).toString("hex");
  const next = request.nextUrl.searchParams.get("next");
  const openid = new URL("https://steamcommunity.com/openid/login");
  openid.search = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${returnTo}?state=${state}`,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  }).toString();
  const result = NextResponse.redirect(openid);
  result.cookies.set("steam_oauth_state", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/" });
  if (next?.startsWith("/") && !next.startsWith("//")) result.cookies.set("steam_auth_next", next, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/" });
  return result;
}
