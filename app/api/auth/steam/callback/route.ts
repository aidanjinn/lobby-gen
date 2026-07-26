import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncSteamLibrary } from "@/lib/steam-sync";

const fail = (request: NextRequest, code: string) => NextResponse.redirect(new URL(`/?error=${encodeURIComponent(code)}`, request.url));

export async function GET(request: NextRequest) {
  try {
    const state = request.nextUrl.searchParams.get("state");
    const configuredOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).origin;
    const returnedTo = request.nextUrl.searchParams.get("openid.return_to");
    let validReturnTo = false;
    if (returnedTo && state) {
      try {
        const returnUrl = new URL(returnedTo);
        validReturnTo = returnUrl.origin === configuredOrigin
          && returnUrl.pathname.replace(/\/+$/, "") === "/api/auth/steam/callback"
          && returnUrl.searchParams.get("state") === state
          && Array.from(returnUrl.searchParams.keys()).every((key) => key === "state");
      } catch {
        validReturnTo = false;
      }
    }
    const claimed = request.nextUrl.searchParams.get("openid.claimed_id") || "";
    const identity = request.nextUrl.searchParams.get("openid.identity") || "";
    const steamId = claimed.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)?.[1];
    if (!state || state !== request.cookies.get("steam_oauth_state")?.value ||
      request.nextUrl.searchParams.get("openid.ns") !== "http://specs.openid.net/auth/2.0" ||
      request.nextUrl.searchParams.get("openid.mode") !== "id_res" ||
      request.nextUrl.searchParams.get("openid.op_endpoint") !== "https://steamcommunity.com/openid/login" ||
      !validReturnTo || identity !== claimed || !steamId) return fail(request, "steam_auth_invalid");

    const params = new URLSearchParams(request.nextUrl.searchParams); params.delete("state"); params.set("openid.mode", "check_authentication");
    const verificationResponse = await fetch("https://steamcommunity.com/openid/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!verificationResponse.ok || !(await verificationResponse.text()).split(/\r?\n/).includes("is_valid:true")) return fail(request, "steam_auth_invalid");
    const apiKey = process.env.STEAM_API_KEY; if (!apiKey) return fail(request, "steam_not_configured");
    const playerResponse = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${steamId}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!playerResponse.ok) return fail(request, "steam_profile_error");
    const player = (await playerResponse.json())?.response?.players?.[0]; if (!player) return fail(request, "steam_profile_private");

    const admin = createAdminSupabase(), email = `steam_${steamId}@auth.lobbynight.internal`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { steam_id: steamId } });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) return fail(request, "session_creation");
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { data: { steam_id: steamId } } });
    if (error || !link.properties?.hashed_token) return fail(request, "session_creation");
    const supabase = await createServerSupabase(); const { data: auth, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
    if (verifyError || !auth.user) return fail(request, "session_creation");
    await admin.from("profiles").upsert({ id: auth.user.id, steam_id: steamId, display_name: String(player.personaname).slice(0,80), avatar_url: String(player.avatarfull || "").slice(0,500) }, { onConflict: "id" });
    await syncSteamLibrary(admin, auth.user.id, steamId);
    const next = request.cookies.get("steam_auth_next")?.value; const destination = NextResponse.redirect(new URL(next?.startsWith("/")&&!next.startsWith("//")?next:"/dashboard",request.url));
    destination.cookies.delete("steam_oauth_state"); destination.cookies.delete("steam_auth_next"); return destination;
  } catch (error) { console.error("Steam authentication callback failed", error); return fail(request, "authentication_failed"); }
}
