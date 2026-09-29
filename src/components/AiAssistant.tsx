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

  /* Tampilan diselaraskan dengan panel dashboard lain (Perlu tindakan,
     Sebaran risiko): header polos bergaris bawah, kotak ikon teal,
     tombol netral. Logika tanya-jawab di atas tidak diubah. */
  return (
    <section className="pf-surface overflow-hidden">
      <header className="pf-panel-head">
        <span className="icon-tile h-8 w-8">
          <Bot size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="pf-panel-title truncate">Tanya AI</h3>
          <p className="pf-panel-sub truncate">Tanya kondisi produksi pakai bahasa sehari-hari</p>
        </div>
        <button
          type="button"
          onClick={() => send("Ringkasan produksi hari ini")}
          disabled={loading}
          className="pf-btn pf-btn-quiet h-8 min-h-0 shrink-0 px-2.5 text-xs"
        >
          <Sparkles size={13} /> Ringkas
        </button>
      </header>

      <div className="max-h-80 space-y-2.5 overflow-y-auto p-3.5" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="pf-tag cursor-pointer px-2.5 py-1 transition-colors hover:border-[color:var(--pf-accent-line)] hover:text-[color:var(--pf-accent-strong)]"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
              m.role === "user"
                ? "ml-auto rounded-br-md bg-[color:var(--pf-accent)] text-white dark:text-[#05242c]"
                : "rounded-bl-md bg-[color:var(--pf-surface-3)] text-[color:var(--pf-ink)]"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[color:var(--pf-ink-3)]">
            <span className="pf-skel h-2 w-16" /> AI sedang menganalisa
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2 border-t border-[color:var(--pf-line-soft)] p-3"
      >
        <label htmlFor="ai-question" className="sr-only">
          Pertanyaan untuk AI
        </label>
        <input
          id="ai-question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Contoh: kerjaan siapa paling mepet?"
          className="input"
        />
        <button type="submit" disabled={loading} className="btn-secondary shrink-0 px-3.5" aria-label="Kirim pertanyaan">
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
