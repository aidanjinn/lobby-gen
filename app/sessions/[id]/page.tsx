import { notFound, redirect } from "next/navigation";
import { CalendarCheck, Share2, Users } from "lucide-react";
import { Nav } from "@/components/nav";
import { WeeklySchedule } from "@/components/weekly-schedule";
import { ViableGames } from "@/components/viable-games";
import { CopyCode } from "@/components/copy-code";
import { DangerSubmit } from "@/components/danger-submit";
import { SessionAutoRefresh } from "@/components/session-auto-refresh";
import { deleteSession, kickMember } from "@/app/actions";
import { getLobbyOwnership } from "@/lib/ownership";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { enrichMissingGenres } from "@/lib/steam-metadata";
import { findBestTimes } from "@/lib/scheduler";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params,
    { error } = await searchParams,
    db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/api/auth/steam");
  const { data: s } = await db
    .from("game_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (!s) notFound();
  const { data: members } = await db
      .from("session_members")
      .select(
        "user_id,preferred_day,preferred_start,timezone,profiles(display_name,library_sync_status)",
      )
      .eq("session_id", id),
    { data: rows } = await db
      .from("availability")
      .select("user_id,day_of_week,start_time,end_time,kind")
      .eq("session_id", id);
  const ms = (members || []) as any[],
    all = (rows || []) as any[],
    best = findBestTimes(ms, all),
    ids = ms.map((m) => m.user_id),
    host = s.host_id === user.id;
  let games: any[] = [];
  let gameMetadataPending = 0;
  if (ids.length) {
    const owned = await getLobbyOwnership(db, ids),
      map = new Map<string, { game: any; owners: Set<string>; playtime: number }>();
    for (const x of owned) {
      const r: any = x,
        k = String(r.app_id);
      if (!map.has(k))
        map.set(k, { game: r.steam_games, owners: new Set(), playtime: 0 });
      const entry = map.get(k)!;
      entry.owners.add(r.user_id);
      entry.playtime += r.playtime_minutes || 0;
    }
    const shared = [...map.values()].filter((x) => x.owners.size === ids.length && x.game);
    await enrichMissingGenres(createAdminSupabase(), shared.map((entry) => entry.game));
    gameMetadataPending = shared.filter((entry) => typeof entry.game.metadata?.is_multiplayer !== "boolean").length;
    games = shared
      .filter((x) => x.game.metadata?.is_multiplayer === true)
      .map((x) => ({
        app_id: x.game.app_id,
        name: x.game.name,
        header_image: x.game.header_image,
        max_players: x.game.max_players,
        genres: Array.isArray(x.game.metadata?.genres)
          ? x.game.metadata.genres
          : ["Uncategorized"],
        groupPlaytime: x.playtime,
      }));
  }
  const me = ms.find((m) => m.user_id === user.id),
    mine = all.filter((x) => x.user_id === user.id),
    { data: template } = await db
      .from("profile_schedule")
      .select("day_of_week,start_time,end_time,kind")
      .eq("user_id", user.id),
    { data: defaults } = await db
      .from("profiles")
      .select("default_preferred_day,default_preferred_start,timezone")
      .eq("id", user.id)
      .single(),
    initial = mine.length ? mine : template || [];
  return (
    <main>
      <SessionAutoRefresh />
      <Nav dashboard />
      <div className="sessionHero">
        <div className="shell">
          <div className="sessionTitle">
            <div className="sessionIcon big">
              {s.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="titleLine">
                <h1>{s.name}</h1>
                <span className="status ready">{s.frequency}</span>
              </div>
              <p>
                <Users size={15} />
                {ms.length} players · {host ? "Hosted by you" : "Member"}
              </p>
            </div>
            <div className="sessionActions">
              <CopyCode code={s.invite_code} />
              <a
                className="button primary"
                href={`mailto:?subject=${encodeURIComponent(`Join ${s.name}`)}&body=${encodeURIComponent(`Use Lobby Night code ${s.invite_code}`)}`}
              >
                <Share2 size={17} /> Invite
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="shell contentSpace">
        {error && <div className="errorBanner">{error}</div>}
        <div className="overviewGrid">
          <section className="resultCard">
            <div className="resultHead">
              <span className="featureIcon green">
                <CalendarCheck />
              </span>
              <div>
                <p className="sectionKicker">BEST GROUP TIMES</p>
                <h2>{best[0]?.label || "Waiting for schedules"}</h2>
              </div>
            </div>
            {best.map((x, i) => (
              <div className="candidate" key={i}>
                <b>{x.label}</b>
                <span>
                  {x.users.length}/{ms.length} available
                </span>
              </div>
            ))}
          </section>
          <aside className="responseCard">
            <div className="asideHead">
              <div>
                <p className="sectionKicker">GROUP STATUS</p>
                <h3>Members</h3>
              </div>
              <b>{ms.length}</b>
            </div>
            {ms.map((m: any) => (
              <div className="responsePerson" key={m.user_id}>
                <span className="person purple">
                  {String(m.profiles?.display_name || "?")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <b>{m.profiles?.display_name || "Steam player"}</b>
                  <small>
                    {all.some((x) => x.user_id === m.user_id)
                      ? "Schedule added"
                      : "Waiting"}{" "}
                    · Library {m.profiles?.library_sync_status}
                  </small>
                </div>
                {host && m.user_id !== user.id && (
                  <form action={kickMember}>
                    <input type="hidden" name="session_id" value={id} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <DangerSubmit
                      label="Kick"
                      confirmText={`Remove ${m.profiles?.display_name || "this player"}?`}
                    />
                  </form>
                )}
              </div>
            ))}
          </aside>
        </div>
        <section className="panel schedulePanel">
          <div className="sectionTitle">
            <div>
              <p className="sectionKicker">WEEKLY CALENDAR</p>
              <h2>Work & playable hours</h2>
              <p>Profile defaults load automatically for new lobbies.</p>
            </div>
          </div>
          <WeeklySchedule
            sessionId={id}
            existing={initial}
            preferredDay={
              me?.preferred_day ?? defaults?.default_preferred_day ?? null
            }
            preferredStart={
              me?.preferred_start ?? defaults?.default_preferred_start ?? null
            }
            timezone={me?.timezone || defaults?.timezone || "UTC"}
          />
        </section>
        <div className="sectionTitle">
          <div>
            <p className="sectionKicker">SHARED STEAM GAMES</p>
            <h2>
              {games.length
                ? `${games.length} multiplayer games owned by everyone`
                : gameMetadataPending
                  ? "Checking shared games with Steam"
                  : "No shared multiplayer games found"}
            </h2>
            <p>Multiplayer and co-op games the whole group owns.</p>
          </div>
        </div>
        <ViableGames games={games} metadataPending={gameMetadataPending} />
        {host && (
          <section className="dangerZone">
            <div>
              <b>Delete this session</b>
              <p>Permanently removes the lobby, schedules, and memberships.</p>
            </div>
            <form action={deleteSession}>
              <input type="hidden" name="session_id" value={id} />
              <DangerSubmit
                label="Delete session"
                confirmText="Delete this entire session? This cannot be undone."
              />
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
