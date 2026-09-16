import { ImageResponse } from "next/og";
import React from "react";

export const dynamic = "force-static";

export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const requested = Number.parseInt((await params).size, 10);
  const size = requested === 192 ? 192 : 512;
  const scale = size / 512;
  const px = (value: number) => value * scale;

  // Varian "maskable": Android/iOS akan memotong ikon ini sendiri jadi
  // bentuk bulat/squircle. Kalau gambarnya mepet sampai ke tepi (seperti
  // ikon biasa), bagian penting bisa ikut terpotong dan splash/ikon jadi
  // kelihatan kaku/mentah. Makanya kontennya sengaja dikecilkan & ditaruh
  // di tengah "zona aman" (~66% dari kanvas), sesuai rekomendasi resmi
  // Android untuk adaptive icon.
  const isMaskable = new URL(request.url).searchParams.get("maskable") === "1";
  const contentScale = isMaskable ? 0.68 : 1;
  const cpx = (value: number) => px(value) * contentScale;

  const line = (top: number, width: number) => React.createElement("div", {
    style: {
      position: "absolute",
      top: cpx(top),
      left: cpx(40),
      width: cpx(width),
      height: cpx(9),
      borderRadius: cpx(5),
      background: "#b9ddd9",
    },
  });

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #06384d 0%, #075b68 55%, #0d9488 100%)",
          position: "relative",
          overflow: "hidden",
          // Kanvas SENGAJA dibuat kotak penuh sampai ke tepi, TANPA sudut
          // membulat sendiri di sini. Sebelumnya sudut dibulatkan manual di
          // varian non-maskable, dengan asumsi tampilan "as-is" tanpa masking
          // OS akan tetap terlihat rapi. Ternyata beberapa tempat yang
          // menampilkan ikon ini apa adanya — misalnya thumbnail pratinjau
          // tautan WhatsApp — TIDAK memotong sudutnya sendiri, jadi area di
          // luar bentuk bulat (yang transparan) malah kelihatan sebagai
          // "sudut putih" mengelilingi badge bulat. iOS tetap otomatis
          // membulatkan apple-touch-icon dengan squircle-nya sendiri, jadi
          // kotak penuh di sini tidak masalah untuk iOS — justru sesuai
          // rekomendasi resmi Apple (jangan sisipkan rounding sendiri).
          // Varian maskable juga sudah lama tidak dibulatkan sendiri di sini
          // (OS yang membentuknya) — sekarang keduanya konsisten kotak penuh.
          borderRadius: 0,
        },
      },
      React.createElement("div", {
        style: {
          position: "absolute",
          width: px(350),
          height: px(350),
          right: px(-125),
          bottom: px(-115),
          borderRadius: "50%",
          border: `${px(58)}px solid rgba(45,212,191,.16)`,
        },
      }),
      React.createElement(
        "div",
        {
          style: {
            position: "relative",
            width: cpx(344),
            height: cpx(350),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: `drop-shadow(0 ${cpx(22)}px ${cpx(24)}px rgba(0,0,0,.24))`,
          },
        },
        // Kertas masuk di bagian atas printer.
        React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              display: "flex",
              top: cpx(4),
              left: cpx(72),
              width: cpx(200),
              height: cpx(166),
              borderRadius: `${cpx(15)}px ${cpx(15)}px ${cpx(5)}px ${cpx(5)}px`,
              background: "#ffffff",
              border: `${cpx(7)}px solid #d7efec`,
              overflow: "hidden",
            },
          },
          line(42, 120),
          line(70, 96),
          line(98, 112),
        ),
        // Badan printer.
        React.createElement("div", {
          style: {
            position: "absolute",
            top: cpx(128),
            left: cpx(12),
            width: cpx(320),
            height: cpx(176),
            borderRadius: cpx(42),
            background: "linear-gradient(180deg, #ffffff 0%, #e8f7f5 100%)",
            border: `${cpx(7)}px solid rgba(255,255,255,.65)`,
          },
        }),
        // Panel teal pada printer.
        React.createElement("div", {
          style: {
            position: "absolute",
            top: cpx(162),
            left: cpx(45),
            width: cpx(254),
            height: cpx(74),
            borderRadius: cpx(22),
            background: "#075b68",
          },
        }),
        // Slot kertas.
        React.createElement("div", {
          style: {
            position: "absolute",
            top: cpx(187),
            left: cpx(85),
            width: cpx(174),
            height: cpx(18),
            borderRadius: cpx(9),
            background: "#022f43",
          },
        }),
        // Tombol kuning.
        React.createElement("div", {
          style: {
            position: "absolute",
            top: cpx(178),
            right: cpx(54),
            width: cpx(23),
            height: cpx(23),
            borderRadius: "50%",
            background: "#fbbf24",
            border: `${cpx(4)}px solid #ffffff`,
          },
        }),
        // Kertas keluar.
        React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              display: "flex",
              top: cpx(244),
              left: cpx(72),
              width: cpx(200),
              height: cpx(102),
              borderRadius: `${cpx(5)}px ${cpx(5)}px ${cpx(16)}px ${cpx(16)}px`,
              background: "#fcd34d",
              border: `${cpx(7)}px solid #fde68a`,
            },
          },
          React.createElement("div", {
            style: {
              position: "absolute",
              top: cpx(30),
              left: cpx(43),
              width: cpx(114),
              height: cpx(10),
              borderRadius: cpx(5),
              background: "rgba(7,56,79,.72)",
            },
          }),
          React.createElement("div", {
            style: {
              position: "absolute",
              top: cpx(55),
              left: cpx(43),
              width: cpx(82),
              height: cpx(10),
              borderRadius: cpx(5),
              background: "rgba(7,56,79,.48)",
            },
          }),
        ),
      ),
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
