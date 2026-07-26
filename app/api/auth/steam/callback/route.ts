import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncSteamLibrary } from "@/lib/steam-sync";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  if (!state || state !== request.cookies.get("steam_oauth_state")?.value) return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete("state");
  params.set("openid.mode", "check_authentication");
  const response = await fetch("https://steamcommunity.com/openid/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const verification = await response.text();
  const valid = verification.split(/\r?\n/).includes("is_valid:true");
  const claimed = request.nextUrl.searchParams.get("openid.claimed_id") || "";
  const steamId = claimed.match(/id\/(\d+)$/)?.[1];
  if (!valid || !steamId) return NextResponse.redirect(new URL("/?error=steam_auth", request.url));
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return NextResponse.redirect(new URL("/?error=steam_not_configured", request.url));
  const playerResponse = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${steamId}`, { cache: "no-store" });
  const player = (await playerResponse.json())?.response?.players?.[0];
  if (!player) return NextResponse.redirect(new URL("/?error=steam_profile", request.url));

  const admin = createAdminSupabase();
  const email = `steam_${steamId}@auth.lobbynight.internal`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { steam_id: steamId } });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) return NextResponse.redirect(new URL("/?error=session_creation", request.url));
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { data: { steam_id: steamId } } });
  if (error || !link.properties?.hashed_token) return NextResponse.redirect(new URL("/?error=session_creation", request.url));
  const supabase = await createServerSupabase();
  const { data: auth, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (verifyError || !auth.user) return NextResponse.redirect(new URL("/?error=session_creation", request.url));
  await admin.from("profiles").upsert({ id: auth.user.id, steam_id: steamId, display_name: String(player.personaname).slice(0, 80), avatar_url: player.avatarfull }, { onConflict: "id" });
  await syncSteamLibrary(admin, auth.user.id, steamId);
  const next = request.cookies.get("steam_auth_next")?.value;
  const destination = NextResponse.redirect(new URL(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard", request.url));
  destination.cookies.delete("steam_oauth_state");
  destination.cookies.delete("steam_auth_next");
  return destination;
}
