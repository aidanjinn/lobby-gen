import type { SupabaseClient } from "@supabase/supabase-js";

type CatalogGame = { app_id: number; metadata?: Record<string, unknown> | null };

export async function enrichMissingGenres(admin: SupabaseClient, games: CatalogGame[]) {
  const candidates = games
    .filter((game) => !Array.isArray(game.metadata?.genres) || typeof game.metadata?.is_multiplayer !== "boolean")
    .slice(0, 6);

  await Promise.all(candidates.map(async (game) => {
    try {
      const response = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${game.app_id}&cc=us&l=en`,
        { cache: "no-store", signal: AbortSignal.timeout(4000) },
      );
      if (!response.ok) return;
      const result = await response.json();
      const details = result?.[String(game.app_id)];
      if (!details?.success) return;
      const genres = (details.data?.genres || [])
        .map((genre: { description?: string }) => genre.description)
        .filter((genre: unknown): genre is string => typeof genre === "string" && genre.length > 0);
      const categories: string[] = (details.data?.categories || [])
        .map((category: { description?: string }) => category.description)
        .filter((category: unknown): category is string => typeof category === "string" && category.length > 0) as string[];
      const isMultiplayer = categories.some((category) =>
        /multi-?player|co-?op|cooperative|pvp/i.test(category),
      );
      const metadata = {
        ...(game.metadata || {}),
        genres: genres.length ? genres : ["Uncategorized"],
        categories,
        is_multiplayer: isMultiplayer,
        genre_synced_at: new Date().toISOString(),
      };
      const { error } = await admin.from("steam_games").update({ metadata }).eq("app_id", game.app_id);
      if (!error) game.metadata = metadata;
    } catch {
      // A later visible-page refresh will retry transient Steam Store failures.
    }
  }));
}
