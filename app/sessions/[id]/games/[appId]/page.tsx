import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, Users } from "lucide-react";
import { Nav } from "@/components/nav";
import { SessionAutoRefresh } from "@/components/session-auto-refresh";
import { createServerSupabase } from "@/lib/supabase/server";
import styles from "./page.module.css";

function formatHours(minutes: number) {
  const hours = minutes / 60;
  if (hours === 0) return "0 hours";
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours).toLocaleString()} hours`;
}

export default async function GameComparison({ params }: { params: Promise<{ id: string; appId: string }> }) {
  const { id, appId } = await params;
  if (!/^\d+$/.test(appId)) notFound();
  const db = await createServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/api/auth/steam?next=${encodeURIComponent(`/sessions/${id}/games/${appId}`)}`);

  const [{ data: session }, { data: members }, { data: game }] = await Promise.all([
    db.from("game_sessions").select("id,name").eq("id", id).single(),
    db.from("session_members").select("user_id,profiles(display_name,avatar_url)").eq("session_id", id),
    db.from("steam_games").select("app_id,name,header_image,metadata").eq("app_id", Number(appId)).single(),
  ]);
  if (!session || !game || game.metadata?.is_multiplayer !== true) notFound();

  const memberRows = (members || []) as Array<{
    user_id: string;
    profiles: { display_name?: string; avatar_url?: string | null } | null;
  }>;
  const memberIds = memberRows.map((member) => member.user_id);
  if (!memberIds.length) notFound();
  const { data: ownership } = await db
    .from("user_games")
    .select("user_id,playtime_minutes")
    .eq("app_id", Number(appId))
    .in("user_id", memberIds);
  const minutesByUser = new Map((ownership || []).map((row) => [row.user_id, Number(row.playtime_minutes || 0)]));
  if (minutesByUser.size !== memberIds.length) notFound();

  const comparison = memberRows
    .map((member) => ({ ...member, minutes: minutesByUser.get(member.user_id) || 0 }))
    .sort((a, b) => b.minutes - a.minutes);
  const maxMinutes = Math.max(...comparison.map((member) => member.minutes), 1);
  const totalMinutes = comparison.reduce((sum, member) => sum + member.minutes, 0);

  return <main className={styles.page}>
    <SessionAutoRefresh />
    <Nav dashboard />
    <div className={styles.wrap}>
      <Link className={styles.back} href={`/sessions/${id}`}><ArrowLeft size={16} /> Back to {session.name}</Link>
      <section className={styles.hero}>
        <div className={styles.cover} style={{ backgroundImage: `url(${game.header_image || ""})` }} />
        <div>
          <p className="sectionKicker">GROUP PLAYTIME</p>
          <h1>{game.name}</h1>
          <p>Compare how much time each lobby member has played before choosing the next game night title.</p>
          <div className={styles.summary}>
            <span><Users size={13} /> {comparison.length} players</span>
            <span><Clock3 size={13} /> {formatHours(totalMinutes)} combined</span>
          </div>
        </div>
      </section>
      <section className={styles.chart}>
        <h2>Hours by player</h2>
        <p className={styles.chartIntro}>Bars are scaled relative to the most-played member.</p>
        {comparison.map((member) => {
          const name = member.profiles?.display_name || "Steam player";
          return <div className={styles.row} key={member.user_id}>
            <div className={styles.person}>
              {member.profiles?.avatar_url
                ? <Image className={styles.avatar} src={member.profiles.avatar_url} alt="" width={34} height={34} />
                : <span className={`${styles.avatar} ${styles.initials}`}>{name.slice(0, 2).toUpperCase()}</span>}
              <b>{name}</b>
            </div>
            <div className={styles.track} aria-label={`${name}: ${formatHours(member.minutes)}`}>
              <div className={styles.bar} style={{ width: `${member.minutes ? Math.max(2, member.minutes / maxMinutes * 100) : 0}%` }} />
            </div>
            <span className={styles.hours}>{formatHours(member.minutes)}</span>
          </div>;
        })}
      </section>
    </div>
  </main>;
}
