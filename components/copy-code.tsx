"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function CopyCode({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      const inviteUrl = new URL("/join", window.location.origin);
      inviteUrl.searchParams.set("code", code);
      const value = inviteUrl.toString();

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement("textarea");
        area.value = value;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        if (!document.execCommand("copy")) throw new Error();
        area.remove();
      }

      setState("copied");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
    }
  }

  return <button type="button" className="button ghost" onClick={copy}>
    {state === "copied" ? <Check size={17} /> : <Link2 size={17} />}
    {state === "copied" ? "Invite link copied!" : state === "error" ? "Copy failed" : "Copy invite link"}
  </button>;
}
