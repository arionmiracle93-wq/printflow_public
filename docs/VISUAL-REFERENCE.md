# Visual Reference — PrintFlow UI Reorganization

Gunakan mockup sebagai referensi visual arah reorganisasi, bukan sebagai source of truth business logic.

## Source of truth
- Struktur dan behavior: `UI-REORGANIZATION.md`
- Implementasi reality: source code existing
- Visual direction: screenshot/mockup

## Arah visual
Pertahankan karakter PrintFlow:
- dark UI;
- panel/card rounded;
- aksen teal/cyan;
- CTA penting tetap jelas;
- status mudah dibedakan;
- mobile-friendly;
- hierarchy lebih jelas;
- lebih ringkas daripada single-page scrolling.

Target konseptual:

```text
┌──────────────────────────────┐
│ Header Pekerjaan             │
│ Banner / ID / Status         │
└──────────────────────────────┘

[Ringkasan][Produksi][Komunikasi][Foto][•••]

          Active Content
```

Mockup tidak harus disalin pixel-for-pixel. Jika mockup bertentangan dengan data, component, atau behavior existing, source code dan specification lebih diutamakan.
