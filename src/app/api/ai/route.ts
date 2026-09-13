import { buildDashboardInsight, smartAnswer, smartSummary } from "@/lib/ai";
import { checkDatabase, explainDbError } from "@/lib/dbcheck";
import { listOrders, saveAiNote } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const check = await checkDatabase();
  if (!check.ok) {
    return Response.json(
      { ok: false, kode: check.code, judul: check.title, penjelasan: check.message, langkah: check.steps },
      { status: 503 },
    );
  }
  const orders = await listOrders({ scope: "semua" });
  const insight = buildDashboardInsight(orders);
  const summary = await smartSummary(orders);
  return Response.json({
    ok: true,
    source: summary.source,
    summary: summary.summary,
    highlights: insight.highlights,
    actions: insight.actions,
    stats: insight.stats,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const question = typeof body.question === "string" ? body.question.trim() : "";

  let orders;
  try {
    orders = await listOrders({ scope: "semua" });
  } catch (error) {
    const problem = explainDbError(error);
    return Response.json(
      {
        ok: false,
        kode: problem.code,
        answer: `⚠️ Saya tidak bisa membaca data produksi karena: ${problem.title}.\n\nSolusi:\n${problem.steps
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n")}`,
      },
      { status: 503 },
    );
  }

  if (!question) {
    const insight = buildDashboardInsight(orders);
    const summary = await smartSummary(orders);
    void saveAiNote({
      orderId: null,
      riskScore: insight.stats.risky,
      riskLevel: insight.stats.late > 0 ? "terlambat" : insight.stats.risky > 0 ? "risiko" : "aman",
      message: summary.summary,
      source: summary.source,
      kind: "daily",
    }).catch(() => undefined);
    return Response.json({
      ok: true,
      mode: "summary",
      source: summary.source,
      answer: [
        summary.summary,
        "",
        "Poin penting:",
        ...insight.highlights.map((h) => `• ${h}`),
        "",
        "Tindakan:",
        ...insight.actions.map((a) => `• ${a}`),
      ].join("\n"),
    });
  }

  const result = await smartAnswer(question, orders);
  void saveAiNote({
    orderId: null,
    riskScore: 0,
    riskLevel: "aman",
    message: `Q: ${question}\nA: ${result.answer}`.slice(0, 2000),
    source: result.source,
    kind: "chat",
  }).catch(() => undefined);
  return Response.json({ ok: true, mode: "ask", source: result.source, answer: result.answer });
}
