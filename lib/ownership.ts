import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

export async function getLobbyOwnership(db: SupabaseClient, userIds: string[]) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("user_games")
      .select("user_id,app_id,playtime_minutes,steam_games(app_id,name,header_image,max_players,metadata)")
      .in("user_id", userIds)
      .order("user_id", { ascending: true })
      .order("app_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
