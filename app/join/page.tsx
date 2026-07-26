import { ArrowRight, KeyRound, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { joinSession } from "@/app/actions";

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string; code?: string }> }) {
  const { error, code } = await searchParams;
  const normalizedCode = String(code || "").trim().toUpperCase();
  const inviteCode = /^[A-Z0-9]{6,24}$/.test(normalizedCode) ? normalizedCode : "";
  return <main className="centerPage">
    <Link href="/"><Logo /></Link>
    <form className="joinCard" action={joinSession}>
      <span className="featureIcon"><KeyRound /></span>
      <p className="sectionKicker">JOIN A LOBBY</p>
      <h1>Enter your invite code</h1>
      <p>Your friend’s invite link includes this automatically.</p>
      {error && <p style={{ color: "#b42318" }}>{error}</p>}
      <input
        name="code"
        required
        defaultValue={inviteCode}
        placeholder="K7M4X9QP"
        minLength={6}
        maxLength={24}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label="Eight-character lobby code"
        style={{ letterSpacing: 4, paddingInline: 14 }}
      />
      <div className="inputIcon">
        <Lock size={17} />
        <input
          name="password"
          type="password"
          placeholder="Password, if required"
          style={{ textAlign: "left", textTransform: "none", letterSpacing: "normal", fontWeight: 400, fontSize: 16 }}
        />
      </div>
      <button className="button primary submit">Join session <ArrowRight size={18} /></button>
      <small>You’ll sign in with Steam first if needed.</small>
    </form>
  </main>;
}
