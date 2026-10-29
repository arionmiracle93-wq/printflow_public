import { parseId, badId, readJson, invoiceFailure } from "@/lib/invoice-api";
import { requireInvoiceAccess } from "@/lib/invoice-access";
import { completeRefund, decideRefund, parseRefundCompletion, parseRefundDecision } from "@/lib/refund-queries";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string; refundId: string }> };

/**
 * Keputusan Owner atas satu pengajuan refund. HANYA OWNER — dicek di sini
 * (backend), bukan cuma disembunyikan di UI (aturan PRD).
 * Body:
 *  - { action: "approve" }                 → setujui pengajuan pending
 *  - { action: "reject", note (wajib) }    → tolak pengajuan pending, ATAU
 *                                            batalkan approval yang lalu
 *  - { action: "complete", paidOutAt? }    → tandai uang sudah terkirim/hab
 *                                            (uang keluar baru masuk hitungan)
 *
 * Setiap langkah menulis jejak aktivitas refund di invoice; baris refund
 * tidak pernah dihapus.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireInvoiceAccess({ ownerOnly: true });
    if (!auth.ok) return auth.response;
    const id = parseId((await params).id);
    if (!id) return badId();
    const refundId = parseId((await params).refundId);
    if (!refundId) return badId("Refund");

    const body = await readJson(request);
    const actor = auth.access.user.name;

    if (body.action === "complete") {
      const { paidOutAt } = parseRefundCompletion(body);
      const refund = await completeRefund(id, refundId, actor, paidOutAt);
      return Response.json({ ok: true, refund });
    }

    const decision = parseRefundDecision(body);
    const refund = await decideRefund(id, refundId, decision, actor);
    return Response.json({ ok: true, refund });
  } catch (error) {
    return invoiceFailure("POST /api/invoices/[id]/refunds/[refundId]", error);
  }
}
