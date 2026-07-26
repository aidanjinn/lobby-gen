import type { SupabaseClient } from "@supabase/supabase-js";

type OwnedGame={appid:number;name?:string;playtime_forever?:number;img_icon_url?:string};
export async function syncSteamLibrary(admin:SupabaseClient,userId:string,steamId:string){
  const key=process.env.STEAM_API_KEY!;
  await admin.from("profiles").update({library_sync_status:"syncing"}).eq("id",userId);
  try{
    const response=await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`,{cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error(`Steam library request failed (${response.status})`);
    const payload=await response.json();const games:OwnedGame[]=payload?.response?.games||[];
    if(payload?.response?.game_count===undefined) {await admin.from("profiles").update({library_sync_status:"private"}).eq("id",userId);return}
    if(games.length){await admin.from("steam_games").upsert(games.map(g=>({app_id:g.appid,name:g.name||`Steam App ${g.appid}`,header_image:`https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,metadata:{icon_hash:g.img_icon_url}})),{onConflict:"app_id"});await admin.from("user_games").upsert(games.map(g=>({user_id:userId,app_id:g.appid,playtime_minutes:g.playtime_forever||0})),{onConflict:"user_id,app_id"})}
    const ids=games.map(g=>g.appid);if(ids.length)await admin.from("user_games").delete().eq("user_id",userId).not("app_id","in",`(${ids.join(",")})`);else await admin.from("user_games").delete().eq("user_id",userId);
    await admin.from("profiles").update({library_sync_status:"ready",library_synced_at:new Date().toISOString()}).eq("id",userId);
  }catch(error){await admin.from("profiles").update({library_sync_status:"error"}).eq("id",userId);console.error("Steam library sync failed",error)}
}
