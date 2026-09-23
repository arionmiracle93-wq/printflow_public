import {
  ACTIVE_STATUSES,
  canBeLate,
  deadlineOf,
  estimateHoursForItems,
  hoursBetween,
  humanDuration,
  priorityMeta,
  statusMeta,
  type StatusKey,
} from "@/lib/domain";
import { summarizeItems, type OrderItem } from "@/lib/order-items";

export type AiOrder = {
  id: number;
  code: string;
  customerName: string;
  title: string;
  /** Rincian produk di dalam pekerjaan ini (bisa lebih dari satu). */
  items: OrderItem[];
  machine: string;
  operator: string | null;
  status: string;
  priority: string;
  price: number;
  paidAmount: number;
  dueDate: string;
  dueTime: string;
  estHours: number;
  notes: string | null;
  createdAt: string;
};

export type RiskLevel = "aman" | "waspada" | "risiko" | "terlambat";

export type OrderInsight = {
  orderId: number;
  code: string;
  title: string;
  customerName: string;
  /** Rincian produk pekerjaan ini (dipakai kartu dashboard & daftar). */
  items: OrderItem[];
  /** Ringkasan satu baris dari `items`, sudah siap ditampilkan. */
  itemsSummary: string;
  operator: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  progress: number;
  hoursLeft: number;
  workLeftHours: number;
  riskScore: number;
  riskLevel: RiskLevel;
  headline: string;
  reasons: string[];
  recommendations: string[];
};

export { estimateHours, estimateHoursForItems } from "@/lib/domain";

function riskLevelOf(score: number): RiskLevel {
  if (score >= 90) return "terlambat";
  if (score >= 65) return "risiko";
  if (score >= 35) return "waspada";
  return "aman";
}

export const RISK_META: Record<RiskLevel, { label: string; badge: string; emoji: string }> = {
  aman: {
    label: "Aman",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    emoji: "🟢",
  },
  waspada: {
    label: "Waspada",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    emoji: "🟡",
  },
  risiko: {
    label: "Berisiko Telat",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    emoji: "🟠",
  },
  terlambat: {
    label: "Terlambat",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    emoji: "🔴",
  },
};

/**
 * Analisa satu pekerjaan: hitung sisa waktu, sisa kerja, skor risiko,
 * alasan, dan rekomendasi tindakan. Semua angka dijelaskan dengan bahasa awam.
 */
export function analyzeOrder(order: AiOrder, now: Date = new Date()): OrderInsight {
  const meta = statusMeta(order.status);
  const deadline = deadlineOf(order.dueDate, order.dueTime);
  const hoursLeft = hoursBetween(now, deadline);
  const done = meta.progress;
  const totalEstimate = order.estHours > 0 ? order.estHours : estimateHoursForItems(order.items);
  const workLeftHours = Math.max(0, (totalEstimate * (100 - done)) / 100);
  const priorityBoost = { rendah: -6, normal: 0, tinggi: 8, urgent: 15 }[order.priority] ?? 0;

  let riskScore: number;
  if (order.status === "selesai") {
    riskScore = 0;
  } else if (order.status === "batal") {
    riskScore = 0;
  } else if (order.status === "siap") {
    // Barang sudah jadi & siap diambil/dikirim — tidak ada lagi risiko
    // PRODUKSI, jadi tidak dihitung "terlambat" walau deadline sudah lewat.
    // Sisa waktunya cuma soal jadwal pelanggan datang mengambil, lihat
    // canBeLate() di lib/domain.ts.
    riskScore = 0;
  } else if (hoursLeft <= 0) {
    riskScore = Math.min(100, 92 + Math.min(8, Math.abs(hoursLeft) / 6));
  } else {
    // Kapasitas kerja nyata diasumsikan ~35% dari waktu kalender (ada jam istirahat/malam).
    const capacityHours = hoursLeft * 0.35;
    const ratio = workLeftHours / Math.max(capacityHours, 0.4);
    riskScore = Math.round(Math.min(100, Math.max(0, ratio * 52 + priorityBoost + (hoursLeft < 24 ? 8 : 0))));
  }

  const level = riskLevelOf(riskScore);
  const reasons: string[] = [];
  const recommendations: string[] = [];

  if (order.status === "selesai") {
    reasons.push("Pekerjaan sudah selesai dan diserahkan.");
  } else if (order.status === "batal") {
    reasons.push("Pekerjaan dibatalkan, tidak dihitung dalam beban produksi.");
  } else if (order.status === "siap") {
    reasons.push(
      hoursLeft < 0
        ? `Barang sudah jadi dan siap diambil/dikirim — sudah menunggu ${humanDuration(hoursLeft)} sejak jadwal serah terima. Ini BUKAN keterlambatan produksi, tinggal menunggu pelanggan datang.`
        : `Barang sudah jadi dan siap diambil/dikirim, ${humanDuration(hoursLeft)} lebih awal dari jadwal serah terima.`,
    );
    recommendations.push('Kirim pesan "Sudah bisa diambil" ke pelanggan agar rak/gudang cepat kosong.');
  } else {
    reasons.push(
      `Progres ${done}% (${meta.short}) • sisa kerja ±${humanDuration(workLeftHours)} • sisa waktu ${humanDuration(hoursLeft)}${
        hoursLeft < 0 ? " (lewat deadline)" : " lagi"
      }.`,
    );
    if (hoursLeft < 0) {
      reasons.push("Deadline sudah terlewati namun status belum selesai.");
      recommendations.push("Hubungi pelanggan hari ini, beri opsi: percepat produksi atau revisi jadwal serah terima.");
      if (order.status === "antrian" || order.status === "desain") {
        recommendations.push("Prioritaskan pekerjaan ini di mesin yang paling sedikit antriannya.");
      }
    } else if (workLeftHours > hoursLeft * 0.35) {
      reasons.push(
        `Beban sisa kerja (${humanDuration(workLeftHours)}) melebihi kapasitas waktu yang tersisa (±${humanDuration(
          hoursLeft * 0.35,
        )} jam kerja efektif).`,
      );
      recommendations.push("Tambah shift/operator atau pecah pekerjaan ke mesin lain.");
      recommendations.push("Kirim update progres ke pelanggan supaya tidak kaget kalau jam serah terima bergeser.");
    } else if (workLeftHours > hoursLeft * 0.2) {
      reasons.push("Waktu masih cukup, tapi marginnya tipis bila ada revisi desain atau kerusakan mesin.");
      recommendations.push("Kunci approval desain sekarang supaya tidak bolak-balik revisi.");
    } else {
      reasons.push("Kapasitas waktu masih cukup untuk menyelesaikan pekerjaan ini.");
    }
  }
  if (order.status !== "selesai" && order.status !== "batal") {
    if (order.items.length > 1) {
      reasons.push(
        `Pekerjaan ini berisi ${order.items.length} jenis produk: ${summarizeItems(order.items, 4)}. Semuanya harus siap sebelum diserahkan.`,
      );
      if (order.status === "siap" || order.status === "qc") {
        recommendations.push(
          `Cek ulang kelengkapan ${order.items.length} item sebelum diserahkan — jangan sampai ada satu produk yang tertinggal.`,
        );
      }
    }
    if (order.priority === "urgent") {
      reasons.push("Ditandai URGENT oleh pemilik, jadi dipantau lebih ketat.");
    }
    if (!order.operator) {
      recommendations.push("Belum ada penanggung jawab operator — tetapkan satu orang agar jelas siapa yang menggerakkan.");
    }
    if (order.status === "antrian" && hoursLeft < 48) {
      recommendations.push("Pindahkan dari antrian ke proses cetak hari ini (jangan menunggu besok).");
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Tidak ada tindakan khusus. Lanjutkan monitoring rutin.");
  }

  const headline =
    order.status === "selesai"
      ? "Selesai tepat dipantau ✅"
      : order.status === "batal"
        ? "Dibatalkan ⛔"
        : order.status === "siap"
          ? hoursLeft < 0
            ? `📦 Siap diambil — menunggu pelanggan ${humanDuration(hoursLeft)}`
            : `📦 Siap diambil — ${humanDuration(hoursLeft)} lebih awal dari jadwal`
          : hoursLeft < 0
            ? `Terlambat ${humanDuration(hoursLeft)} dari deadline 🔴`
            : `${RISK_META[level].emoji} ${RISK_META[level].label} — target selesai dalam ${humanDuration(hoursLeft)}`;

  return {
    orderId: order.id,
    code: order.code,
    title: order.title,
    customerName: order.customerName,
    items: order.items,
    itemsSummary: summarizeItems(order.items),
    operator: order.operator,
    status: order.status,
    statusLabel: meta.label,
    priority: order.priority,
    progress: done,
    hoursLeft,
    workLeftHours,
    riskScore: riskScore,
    riskLevel: level,
    headline,
    reasons,
    recommendations,
  };
}

export type DashboardInsight = {
  generatedAt: string;
  source: "engine" | "llm";
  summary: string;
  highlights: string[];
  actions: string[];
  insights: OrderInsight[];
  stats: {
    totalActive: number;
    late: number;
    risky: number;
    readyToPickup: number;
    revenueActive: number;
    paidAmount: number;
    finishingToday: number;
  };
};

export function buildDashboardInsight(
  orders: AiOrder[],
  now: Date = new Date(),
): DashboardInsight {
  const insights = orders.map((o) => analyzeOrder(o, now));
  const active = insights.filter((i) => i.status !== "selesai" && i.status !== "batal");
  const late = active.filter((i) => i.hoursLeft < 0 && canBeLate(i.status));
  const risky = active.filter((i) => i.riskLevel === "risiko");
  const warn = active.filter((i) => i.riskLevel === "waspada");
  const ready = orders.filter((o) => o.status === "siap");
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const finishingToday = active.filter((i) => {
    const order = orders.find((o) => o.id === i.orderId)!;
    const deadline = deadlineOf(order.dueDate, order.dueTime);
    return deadline >= now && deadline <= todayEnd;
  });

  const revenueActive = orders
    .filter((o) => (ACTIVE_STATUSES as string[]).includes(o.status))
    .reduce((sum, o) => sum + (o.price || 0), 0);
  const paidAmount = orders
    .filter((o) => o.status !== "batal")
    .reduce((sum, o) => sum + (o.paidAmount || 0), 0);

  const highlights: string[] = [];
  highlights.push(`Ada ${active.length} pekerjaan aktif sedang dipantau.`);
  if (late.length) {
    highlights.push(
      `${late.length} pekerjaan sudah lewat deadline: ${late.slice(0, 3).map((i) => i.code).join(", ")}.`,
    );
  } else {
    highlights.push("Tidak ada pekerjaan yang melewati deadline. 🎉");
  }
  if (risky.length) {
    highlights.push(`${risky.length} pekerjaan berisiko telat: ${risky.slice(0, 3).map((i) => i.code).join(", ")}.`);
  }
  if (warn.length) {
    highlights.push(`${warn.length} pekerjaan perlu waspada (margin waktu tipis).`);
  }
  if (ready.length) {
    highlights.push(`${ready.length} pekerjaan sudah SIAP DIAMBIL dan menunggu pelanggan.`);
  }
  if (finishingToday.length) {
    highlights.push(`${finishingToday.length} pekerjaan berdeadline hari ini.`);
  }

  const actions: string[] = [];
  for (const i of [...late, ...risky].slice(0, 4)) {
    actions.push(`${i.code} (${i.customerName}): ${i.recommendations[0]}`);
  }
  if (ready.length) {
    actions.push(`Kirim notifikasi "siap diambil" untuk ${ready.length} pesanan.`);
  }
  if (!actions.length) {
    actions.push("Semua terkendali. Cek kembali besok pagi atau tambah order baru.");
  }

  const summary =
    active.length === 0
      ? "Belum ada pekerjaan aktif. Tambahkan order baru untuk mulai dipantau AI."
      : `Dari ${active.length} pekerjaan aktif, ${late.length} terlambat, ${risky.length} berisiko telat, dan ${ready.length} siap diambil. ` +
        `Fokus utama: ${[...late, ...risky]
          .slice(0, 2)
          .map((i) => i.code)
          .join(" dan ") || "menjaga ritme produksi"}.`;

  return {
    generatedAt: now.toISOString(),
    source: "engine",
    summary,
    highlights,
    actions,
    insights: insights
      .filter((i) => i.status !== "selesai" && i.status !== "batal")
      .sort((a, b) => b.riskScore - a.riskScore),
    stats: {
      totalActive: active.length,
      late: late.length,
      risky: risky.length + warn.length,
      readyToPickup: ready.length,
      revenueActive,
      paidAmount,
      finishingToday: finishingToday.length,
    },
  };
}

/** Jawaban tanya-jawab berbasis aturan (tanpa API eksternal). */
export function ruleAnswer(question: string, orders: AiOrder[], now: Date = new Date()): string {
  const q = question.toLowerCase();
  const insight = buildDashboardInsight(orders, now);
  const lines: string[] = [];

  const matchByCode = orders.find((o) => o.code.toLowerCase() === q.replace(/[^a-z0-9-]/g, ""));
  const keywordOrder = matchByCode
    ? matchByCode
    : orders.find((o) => q.length > 3 && `${o.title} ${o.customerName}`.toLowerCase().includes(q.slice(0, 12)));

  if (keywordOrder) {
    const a = analyzeOrder(keywordOrder, now);
    return [
      `*${a.code}* — ${a.title} (${a.customerName})`,
      `Status: ${a.statusLabel} • progres ${a.progress}% • deadline ${keywordOrder.dueDate} ${keywordOrder.dueTime}.`,
      a.headline,
      "",
      "Saran AI:",
      ...a.recommendations.slice(0, 3).map((r) => `• ${r}`),
    ].join("\n");
  }

  if (/(telat|terlambat|lewat|deadline lewat|overdue)/.test(q)) {
    const late = insight.insights.filter((i) => i.hoursLeft < 0 && canBeLate(i.status));
    lines.push(late.length ? `Ada ${late.length} pekerjaan terlambat:` : "Tidak ada pekerjaan yang terlambat. 🎉");
    for (const i of late.slice(0, 8)) {
      lines.push(`• ${i.code} — ${i.title} (${i.customerName}) terlambat ${humanDuration(i.hoursLeft)}`);
    }
    return lines.join("\n");
  }

  if (/(hari ini|segera|urg|prioritas|fokus|dahulu)/.test(q)) {
    lines.push("Prioritas kerja yang disarankan AI:");
    for (const i of insight.insights.slice(0, 5)) {
      lines.push(`• ${i.code} — ${i.title} (${i.statusLabel}, ${i.headline})`);
    }
    return lines.join("\n");
  }

  if (/(siap|diambil|ambil|dikirim|kirim)/.test(q)) {
    const ready = orders.filter((o) => o.status === "siap");
    lines.push(ready.length ? `${ready.length} pekerjaan siap diambil/dikirim:` : "Belum ada yang siap diambil.");
    for (const o of ready) lines.push(`• ${o.code} — ${o.title} (${o.customerName})`);
    return lines.join("\n");
  }

  if (/(antrian|belum mulai|menunggu)/.test(q)) {
    const queue = orders.filter((o) => o.status === "antrian");
    lines.push(queue.length ? `${queue.length} pekerjaan masih di antrian:` : "Antrian kosong. Semua pekerjaan sudah jalan.");
    for (const o of queue) lines.push(`• ${o.code} — ${o.title} (deadline ${o.dueDate} ${o.dueTime})`);
    return lines.join("\n");
  }

  if (/(omzet|uang|pendapatan|dp|bayar|tagihan|piutang)/.test(q)) {
    lines.push(`Nilai pekerjaan aktif: Rp ${insight.stats.revenueActive.toLocaleString("id-ID")}`);
    lines.push(`Total pembayaran masuk (DP/lunas): Rp ${insight.stats.paidAmount.toLocaleString("id-ID")}`);
    lines.push(`Perkiraan piutang: Rp ${Math.max(0, insight.stats.revenueActive - insight.stats.paidAmount).toLocaleString("id-ID")}`);
    return lines.join("\n");
  }

  if (/(mesin|operator|beban|kapasitas|beban kerja)/.test(q)) {
    const byMachine = new Map<string, number>();
    for (const o of orders) {
      if ((ACTIVE_STATUSES as string[]).includes(o.status as StatusKey)) {
        byMachine.set(o.machine, (byMachine.get(o.machine) ?? 0) + 1);
      }
    }
    lines.push("Beban pekerjaan per mesin:");
    for (const [machine, count] of [...byMachine.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`• ${machine}: ${count} pekerjaan aktif`);
    }
    return lines.join("\n");
  }

  if (/(ringkas|ringkasan|laporan|status|kondisi|semua)/.test(q)) {
    return [insight.summary, "", "Poin penting:", ...insight.highlights.map((h) => `• ${h}`)].join("\n");
  }

  if (/(prioritas|urgent)/.test(q)) {
    const urgent = orders.filter((o) => priorityMeta(o.priority).label === "Urgent");
    return urgent.length
      ? `Pekerjaan berlabel URGENT: ${urgent.map((o) => o.code).join(", ")}`
      : "Tidak ada pekerjaan berlabel urgent.";
  }

  return [
    "Saya bisa membantu menjawab soal:",
    "• pekerjaan yang terlambat / berisiko telat",
    "• prioritas kerja hari ini",
    "• daftar pesanan siap diambil",
    "• beban tiap mesin",
    "• ringkasan produksi & perkiraan piutang",
    "• status satu pekerjaan (tuliskan kode, contoh: PJ-2026-0001)",
  ].join("\n");
}

type LlmConfig = { provider: "openai" | "anthropic"; key: string };

function llmConfig(): LlmConfig | null {
  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (openai) return { provider: "openai", key: openai };
  if (anthropic) return { provider: "anthropic", key: anthropic };
  return null;
}

export function aiProviderName(): string {
  const cfg = llmConfig();
  if (!cfg) return "engine";
  return cfg.provider;
}

async function askLlm(prompt: string, context: string): Promise<string | null> {
  const cfg = llmConfig();
  if (!cfg) return null;
  const system =
    "Kamu adalah asisten monitoring produksi percetakan. Jawab dalam Bahasa Indonesia yang sederhana, " +
    "singkat, pakai poin-poin, dan selalu beri saran tindakan konkret untuk pemilik percetakan non-programmer. " +
    "Jangan menyebut istilah teknis pemrograman.";
  try {
    if (cfg.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 600,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `DATA PRODUKSI:\n${context}\n\nPERTANYAAN:\n${prompt}` },
          ],
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content?.trim() ?? null;
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 600,
        system,
        messages: [
          {
            role: "user",
            content: `DATA PRODUKSI:\n${context}\n\nPERTANYAAN:\n${prompt}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { text?: string }[] };
    return json.content?.map((c) => c.text ?? "").join("").trim() || null;
  } catch {
    return null;
  }
}

function contextOf(orders: AiOrder[]): string {
  if (!orders.length) return "Belum ada pekerjaan aktif.";
  const rows = orders.slice(0, 40).map((o) => {
    const a = analyzeOrder(o);
    const isi = o.items.length ? summarizeItems(o.items, 6) : "belum ada rincian produk";
    return `${a.code} | ${o.title} | pelanggan ${o.customerName} | isi (${o.items.length} produk): ${isi} | status ${a.statusLabel} | prioritas ${o.priority} | mesin ${o.machine} | deadline ${o.dueDate} ${o.dueTime} | progres ${a.progress}% | risiko ${a.riskScore}/100 (${a.riskLevel})`;
  });
  return rows.join("\n");
}

/** Gabungan: coba LLM bila ada API key, jika tidak pakai mesin aturan lokal. */
export async function smartAnswer(question: string, orders: AiOrder[]): Promise<{ answer: string; source: string }> {
  const fallback = ruleAnswer(question, orders);
  const cfg = llmConfig();
  if (!cfg) return { answer: fallback, source: "engine" };
  const llm = await askLlm(question, contextOf(orders));
  if (!llm) return { answer: fallback, source: "engine (LLM gagal, fallback)" };
  return { answer: llm, source: cfg.provider };
}

export async function smartSummary(orders: AiOrder[]): Promise<{ summary: string; source: string }> {
  const base = buildDashboardInsight(orders);
  const cfg = llmConfig();
  if (!cfg) return { summary: base.summary, source: "engine" };
  const llm = await askLlm(
    "Buat ringkasan kondisi produksi hari ini dalam 3-5 poin untuk pemilik percetakan, sertakan 3 tindakan paling penting hari ini.",
    contextOf(orders),
  );
  if (!llm) return { summary: base.summary, source: "engine" };
  return { summary: llm, source: cfg.provider };
}
