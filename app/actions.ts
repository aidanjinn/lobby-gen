"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { syncSteamLibrary } from "@/lib/steam-sync";

async function authed(next = "/dashboard") {
  const db = await createServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/api/auth/steam?next=${encodeURIComponent(next)}`);
  return { db, user };
}

export async function createSession(formData: FormData) {
  const { db } = await authed();
  const { data, error } = await db.rpc("create_game_session", {
    session_name: String(formData.get("name") || ""),
    session_frequency: String(formData.get("frequency") || "weekly"),
    session_password: String(formData.get("password") || "") || null,
    member_timezone: String(formData.get("timezone") || "UTC"),
  });
  if (error || !data) redirect(`/sessions/new?error=${encodeURIComponent(error?.message || "Unable to create lobby")}`);
  redirect(`/sessions/${data}`);
}

export async function joinSession(formData: FormData) {
  const { db } = await authed("/join");
  const { data, error } = await db.rpc("join_game_session", {
    code: String(formData.get("code") || ""),
    supplied_password: String(formData.get("password") || "") || null,
  });
  if (error || !data) redirect(`/join?error=${encodeURIComponent(error?.message || "Unable to join")}`);
  redirect(`/sessions/${data}`);
}

export async function saveSchedule(formData: FormData) {
  const { db, user } = await authed();
  const sessionId = String(formData.get("session_id"));
  const rows: { session_id: string; user_id: string; day_of_week: number; start_time: string; end_time: string; kind: string }[] = [];

  for (let day = 0; day < 7; day++) {
    if (formData.get(`work_enabled_${day}`) === "on") {
      const start = String(formData.get(`work_start_${day}`) || "");
      const end = String(formData.get(`work_end_${day}`) || "");
      if (start && end && start < end) rows.push({ session_id: sessionId, user_id: user.id, day_of_week: day, start_time: start, end_time: end, kind: "work" });
    }
    if (formData.get(`play_enabled_${day}`) === "on") {
      const start = String(formData.get(`play_start_${day}`) || "");
      const end = String(formData.get(`play_end_${day}`) || "");
      if (start && end && start < end) rows.push({ session_id: sessionId, user_id: user.id, day_of_week: day, start_time: start, end_time: end, kind: "available" });
    }
  }

  const { error: deleteError } = await db.from("availability").delete().eq("session_id", sessionId).eq("user_id", user.id);
  if (deleteError) redirect(`/sessions/${sessionId}?error=${encodeURIComponent(deleteError.message)}`);
  if (rows.length) {
    const { error } = await db.from("availability").insert(rows);
    if (error) redirect(`/sessions/${sessionId}?error=${encodeURIComponent(error.message)}`);
  }
  await db.from("session_members").update({
    preferred_day: formData.get("preferred_day") === "" ? null : Number(formData.get("preferred_day")),
    preferred_start: String(formData.get("preferred_start") || "") || null,
    timezone: String(formData.get("timezone") || "UTC"),
  }).eq("session_id", sessionId).eq("user_id", user.id);
  if (formData.get("save_to_profile") === "on") {
    await db.from("profile_schedule").delete().eq("user_id", user.id);
    if (rows.length) await db.from("profile_schedule").insert(rows.map(({ day_of_week, start_time, end_time, kind }) => ({ user_id: user.id, day_of_week, start_time, end_time, kind })));
    await db.from("profiles").update({ default_preferred_day: formData.get("preferred_day") === "" ? null : Number(formData.get("preferred_day")), default_preferred_start: String(formData.get("preferred_start") || "") || null, timezone: String(formData.get("timezone") || "UTC") }).eq("id", user.id);
  }
  redirect(`/sessions/${sessionId}`);
}

export async function kickMember(formData: FormData) {
  const { db } = await authed(); const sessionId = String(formData.get("session_id"));
  const { error } = await db.rpc("remove_session_member", { target_session: sessionId, target_user: String(formData.get("user_id")) });
  if (error) redirect(`/sessions/${sessionId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/sessions/${sessionId}`);
}

export async function deleteSession(formData: FormData) {
  const { db, user } = await authed(); const sessionId = String(formData.get("session_id"));
  const { error } = await db.from("game_sessions").delete().eq("id", sessionId).eq("host_id", user.id);
  if (error) redirect(`/sessions/${sessionId}?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function refreshLibrary() {
  const { db, user } = await authed("/profile");
  const { data: profile } = await db.from("profiles").select("steam_id").eq("id", user.id).single();
  if (profile?.steam_id) await syncSteamLibrary(createAdminSupabase(), user.id, profile.steam_id);
  redirect("/profile");
}

export async function signOut() {
  const db = await createServerSupabase(); await db.auth.signOut(); redirect("/");
}
