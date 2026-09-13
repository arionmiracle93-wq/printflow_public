import { ImageResponse } from "next/og";
import React from "react";

export const dynamic = "force-static";

/**
 * Icon khusus status bar Android (notification badge).
 *
 * Android CUMA baca channel alpha dari gambar ini lalu memaksanya jadi
 * putih solid — semua warna diabaikan. Kalau kita kirim icon full-color
 * (seperti /api/pwa/icon), seluruh area yang "berisi" jadi kotak putih
 * polos karena tidak ada transparansi buat bentuk siluet.
 *
 * Jadi icon ini sengaja: HANYA putih + transparan, dan diberi padding
 * lebar karena Android akan mengecilkan/inset lagi saat menampilkannya
 * di status bar.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const requested = Number.parseInt((await params).size, 10);
  const size = requested === 192 ? 192 : 96;
  const scale = size / 512;
  const px = (value: number) => value * scale;

  const white = "#ffffff";

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          // Transparan total — jangan set warna latar apa pun di sini.
        },
      },
      // Kertas masuk (atas)
      React.createElement("div", {
        style: {
          position: "absolute",
          top: px(90),
          left: px(196),
          width: px(120),
          height: px(50),
          borderRadius: px(12),
          background: white,
        },
      }),
      // Badan printer
      React.createElement("div", {
        style: {
          position: "absolute",
          top: px(170),
          left: px(136),
          width: px(240),
          height: px(140),
          borderRadius: px(36),
          background: white,
        },
      }),
      // Kertas keluar (bawah)
      React.createElement("div", {
        style: {
          position: "absolute",
          top: px(340),
          left: px(176),
          width: px(160),
          height: px(80),
          borderRadius: px(12),
          background: white,
        },
      }),
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
