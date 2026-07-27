import type { SupabaseClient } from "@supabase/supabase-js";

type OwnedGame = { appid: number; name?: string; playtime_forever?: number; img_icon_url?: string };

export async function syncSteamLibrary(admin: SupabaseClient, userId: string, steamId: string) {
  const key = process.env.STEAM_API_KEY!;
  await admin.from("profiles").update({ library_sync_status: "syncing" }).eq("id", userId);
  try {
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`,
      { cache: "no-store", signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error(`Steam library request failed (${response.status})`);
    const payload = await response.json();
    const games: OwnedGame[] = payload?.response?.games || [];
    if (payload?.response?.game_count === undefined) {
      await admin.from("profiles").update({ library_sync_status: "private" }).eq("id", userId);
      return;
    }

    if (games.length) {
      const ids = games.map((game) => game.appid);
      const { data: existing } = await admin.from("steam_games").select("app_id,metadata").in("app_id", ids);
      const metadata = new Map((existing || []).map((game) => [Number(game.app_id), game.metadata || {}]));
      const { error: catalogError } = await admin.from("steam_games").upsert(games.map((game) => ({
        app_id: game.appid,
        name: game.name || `Steam App ${game.appid}`,
        header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
        metadata: { ...metadata.get(game.appid), icon_hash: game.img_icon_url },
      })), { onConflict: "app_id" });
      if (catalogError) throw catalogError;
      const { error: ownershipError } = await admin.from("user_games").upsert(games.map((game) => ({
        user_id: userId,
        app_id: game.appid,
        playtime_minutes: game.playtime_forever || 0,
      })), { onConflict: "user_id,app_id" });
      if (ownershipError) throw ownershipError;
    }

    const ids = games.map((game) => game.appid);
    const cleanup = ids.length
      ? admin.from("user_games").delete().eq("user_id", userId).not("app_id", "in", `(${ids.join(",")})`)
      : admin.from("user_games").delete().eq("user_id", userId);
    const { error: cleanupError } = await cleanup;
    if (cleanupError) throw cleanupError;
    await admin.from("profiles").update({ library_sync_status: "ready", library_synced_at: new Date().toISOString() }).eq("id", userId);
  } catch (error) {
    await admin.from("profiles").update({ library_sync_status: "error" }).eq("id", userId);
    console.error("Steam library sync failed", error);
  }
}
