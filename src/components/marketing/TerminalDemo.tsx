"use client";

import { useEffect, useState } from "react";

interface Line {
  text: string;
  tone?: "command" | "ok" | "muted";
}

const SCRIPT: Line[] = [
  { text: "$ cloudctl deploy --plan nano-1 --region id-jkt-1", tone: "command" },
  { text: "✓ Menyiapkan instance...", tone: "ok" },
  { text: "✓ Memasang disk 25GB SSD", tone: "ok" },
  { text: "✓ IP publik: 103.49.238.x", tone: "ok" },
  { text: "✓ Berjalan dalam 8 detik", tone: "ok" },
  { text: "", tone: "muted" },
  { text: "$ cloudctl apps deploy wordpress", tone: "command" },
  { text: "✓ Meng-clone template...", tone: "ok" },
  { text: "✓ WordPress terpasang", tone: "ok" },
  { text: "✓ Live: toko-anda.web.id", tone: "ok" },
];

const TYPE_SPEED_MS = 22;
const LINE_PAUSE_MS = 220;
const LOOP_PAUSE_MS = 2200;

export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    async function run() {
      while (!cancelled) {
        setVisibleLines([]);
        setCurrent("");

        for (const line of SCRIPT) {
          if (cancelled) return;
          for (let i = 1; i <= line.text.length; i++) {
            await sleep(TYPE_SPEED_MS);
            if (cancelled) return;
            setCurrent(line.text.slice(0, i));
          }
          await sleep(LINE_PAUSE_MS);
          if (cancelled) return;
          setVisibleLines((prev) => [...prev, line.text]);
          setCurrent("");
        }

        await sleep(LOOP_PAUSE_MS);
      }
    }

    function sleep(ms: number) {
      return new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms);
        timeouts.push(id);
      });
    }

    run();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e17] shadow-2xl shadow-black/40 overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-2 text-xs text-white/40 font-mono">console — cloudctl</span>
      </div>
      <div className="p-5 font-mono text-[13px] leading-relaxed min-h-[220px]">
        {visibleLines.map((line, i) => (
          <div key={i} className={lineClass(SCRIPT[i]?.tone)}>
            {line || "\u00A0"}
          </div>
        ))}
        <div className={lineClass(SCRIPT[visibleLines.length]?.tone)}>
          {current}
          <span className="inline-block w-2 h-3.5 bg-emerald-400/80 ml-0.5 align-middle" style={{ animation: "cursor-blink 1s step-end infinite" }} />
        </div>
      </div>
    </div>
  );
}

function lineClass(tone?: Line["tone"]) {
  if (tone === "command") return "text-white/90";
  if (tone === "ok") return "text-emerald-400/90";
  return "text-white/40";
}
