/**
 * CETAK, PDF, DAN KIRIM WHATSAPP (khusus browser)
 *
 * Kertas dokumen (#ppi-paper) disalin ke iframe tersembunyi selebar halaman A4 (794px)
 * lengkap dengan stylesheet aplikasi. Alasannya: tata letak kertas dipengaruhi lebar
 * layar; dengan iframe selebar A4, hasil cetak/PDF SELALU berbentuk kertas lebar
 * meski dibuka dari HP. Elemen bertanda .ppi-screen-only (bar customer, tombol salin,
 * dsb.) tidak ikut.
 */

export const PAPER_ID = "ppi-paper";
const PAGE_W = 794; // A4 pada 96 dpi
const PAGE_H = 1123;
/** Dokumen yang kelebihan tinggi sampai batas ini DIKECILKAN agar tetap satu halaman (bukan terpotong ke halaman 2). */
const FIT_TOLERANCE = 1.2;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type PaperFrame = { frame: HTMLIFrameElement; doc: Document; win: Window; paper: HTMLElement; dispose: () => void };

async function buildFrame(): Promise<PaperFrame> {
  const src = document.getElementById(PAPER_ID);
  if (!src) throw new Error("Kertas dokumen tidak ditemukan di halaman ini.");

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: `${PAGE_W}px`,
    height: "1200px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error("Browser tidak mengizinkan membuat lembar cetak.");
  }
  doc.open();
  doc.write('<!doctype html><html lang="id"><head><meta charset="utf-8"></head><body></body></html>');
  doc.close();

  const loads: Promise<void>[] = [];
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    const copy = node.cloneNode(true) as HTMLElement;
    doc.head.appendChild(copy);
    if (copy.tagName === "LINK") {
      loads.push(
        new Promise<void>((resolve) => {
          copy.addEventListener("load", () => resolve());
          copy.addEventListener("error", () => resolve());
        }),
      );
    }
  });
  const extra = doc.createElement("style");
  extra.textContent = `
    @page { size: A4; margin: 0; }
    html, body { margin: 0; background: #fff; }
    #${PAPER_ID} { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; padding: 10mm 11mm 10mm !important; width: 100% !important; }
    #${PAPER_ID} .mt-6 { margin-top: 14px !important; }
    #${PAPER_ID} .mt-5 { margin-top: 12px !important; }
    #${PAPER_ID} .mt-4 { margin-top: 10px !important; }
    #${PAPER_ID} .ppi-rowwrap { padding-top: 0 !important; padding-bottom: 0 !important; }
    .ppi-screen-only { display: none !important; }
  `;
  doc.head.appendChild(extra);

  const clone = doc.importNode(src, true) as HTMLElement;
  clone.querySelectorAll(".ppi-screen-only").forEach((el) => el.remove());
  doc.body.appendChild(clone);

  await Promise.race([Promise.all(loads), sleep(5000)]);
  try {
    await Promise.race([doc.fonts?.ready ?? Promise.resolve(), sleep(3000)]);
  } catch {
    /* abaikan */
  }
  await Promise.race([
    Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); }),
      ),
    ),
    sleep(5000),
  ]);
  frame.style.height = `${Math.max(clone.scrollHeight, PAGE_H)}px`;
  return { frame, doc, win, paper: clone, dispose: () => frame.remove() };
}

/** Cetak: hanya kertas dokumen (tanpa menu, sidebar, dan bar layar). */
export async function printPaper(): Promise<void> {
  const f = await buildFrame();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    f.dispose();
  };
  // Sedikit kelebihan tinggi: kecilkan agar muat satu halaman A4.
  const h = f.paper.scrollHeight;
  if (h > PAGE_H && h <= PAGE_H * FIT_TOLERANCE) {
    f.doc.documentElement.style.setProperty("zoom", String((PAGE_H - 4) / h));
    await sleep(150);
  }
  f.win.addEventListener("afterprint", finish);
  setTimeout(finish, 120_000);
  f.win.focus();
  f.win.print();
}

/** Cari baris kosong (putih) di dekat batas halaman supaya teks tidak terpotong di tengah. */
function findBreak(canvas: HTMLCanvasElement, target: number, window: number): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return target;
  const top = Math.max(0, Math.floor(target - window));
  const h = Math.max(1, Math.floor(target) - top);
  const data = ctx.getImageData(0, top, canvas.width, h).data;
  for (let row = h - 1; row >= 0; row -= 1) {
    let blank = true;
    const base = row * canvas.width * 4;
    // Periksa SETIAP piksel: garis tepi kotak sangat tipis, kalau diloncati kotak bisa terbelah.
    for (let x = 0; x < canvas.width; x += 1) {
      const i = base + x * 4;
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
        blank = false;
        break;
      }
    }
    if (blank) return top + row;
  }
  return target;
}

/** Buat PDF A4 dari kertas dokumen. Halaman panjang dipotong di celah antar baris. */
export async function paperToPdf(): Promise<Blob> {
  const f = await buildFrame();
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const canvas = await html2canvas(f.doc.body, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: PAGE_W,
      windowWidth: PAGE_W,
      windowHeight: Math.max(f.paper.scrollHeight, PAGE_H),
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageWmm = 210;
    const pageHmm = 297;
    const pxPerMm = canvas.width / pageWmm;
    const pageHpx = Math.floor(pageHmm * pxPerMm);
    // Muat satu halaman bila hanya kelebihan sedikit.
    if (canvas.height > pageHpx && canvas.height <= pageHpx * FIT_TOLERANCE) {
      const scale = pageHpx / canvas.height;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pageWmm - pageWmm * scale) / 2, 0, pageWmm * scale, pageHmm);
      return pdf.output("blob");
    }
    let y = 0;
    let page = 0;
    while (y < canvas.height - 2) {
      let end = Math.min(canvas.height, y + pageHpx);
      if (end < canvas.height) end = Math.max(y + Math.floor(pageHpx * 0.6), findBreak(canvas, end, pageHpx * 0.18));
      const sliceH = end - y;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("Browser tidak mendukung pembuatan PDF.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageWmm, sliceH / pxPerMm);
      y = end;
      page += 1;
      if (page > 30) break;
    }
    return pdf.output("blob");
  } finally {
    f.dispose();
  }
}

export function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "dokumen";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Kirim lewat WhatsApp (sama dengan app lama): bila perangkat mendukung berbagi file,
 * PDF dibagikan langsung (pilih kontak di WhatsApp). Kalau tidak, PDF diunduh dan
 * WhatsApp dibuka berisi teks pesan.
 */
export async function shareViaWhatsApp(args: { filename: string; text: string; phone: string }): Promise<"shared" | "fallback" | "cancelled"> {
  const blob = await paperToPdf();
  const file = new File([blob], args.filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: args.text, title: args.filename });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, args.filename);
  const target = args.phone ? `https://wa.me/${args.phone}` : "https://wa.me/";
  window.open(`${target}?text=${encodeURIComponent(args.text)}`, "_blank", "noopener");
  return "fallback";
}
