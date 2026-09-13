"use client";

import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";

type Message = { role: "user" | "ai"; text: string };

const SUGGESTIONS = [
  "Pekerjaan mana yang berisiko telat?",
  "Apa fokus kerja hari ini?",
  "Pesanan yang sudah siap diambil",
  "Ringkasan produksi hari ini",
  "Perkiraan piutang & pembayaran",
  "Beban tiap mesin",
];

export function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as { answer?: string; error?: string };
      setMessages((prev) => [...prev, { role: "ai", text: json.answer ?? json.error ?? "Maaf, terjadi kesalahan." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Tidak bisa menghubungi server AI." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#07556a] to-teal-600 px-4 py-4 text-white">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-300/20" />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10"><Bot size={21} /></span>
            <div><p className="text-sm font-extrabold">Tanya AI</p><p className="text-[10px] text-cyan-50/75">Tanya kondisi produksi pakai bahasa sehari-hari</p></div>
          </div>
          <button type="button" onClick={() => send("Ringkasan produksi hari ini")} className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-2.5 py-2 text-[10px] font-extrabold text-[#07384f] hover:bg-amber-300">
            <Sparkles size={12} /> Ringkas
          </button>
        </div>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-teal-100 bg-teal-50/70 px-2.5 py-1.5 text-[10px] font-bold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100">
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "ml-auto rounded-br-md bg-teal-600 text-white" : "rounded-bl-md bg-slate-100 text-slate-700"}`}>
            {m.text}
          </div>
        ))}
        {loading ? <p className="flex items-center gap-2 text-xs font-semibold text-teal-700"><span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" /> AI sedang menganalisa…</p> : null}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex gap-2 border-t border-slate-100 bg-slate-50/70 p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Contoh: kerjaan siapa paling mepet?" className="input" />
        <button type="submit" disabled={loading} className="btn-secondary shrink-0 px-3.5" aria-label="Kirim pertanyaan"><Send size={16} /></button>
      </form>
    </div>
  );
}
