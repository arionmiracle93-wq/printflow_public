# PrintFlow — UI Reorganization

Paket dokumentasi siap pakai untuk reorganisasi UI modul **Rincian Pekerjaan**.

## Isi
- `UI-REORGANIZATION.md` — spesifikasi target UI/UX dan mapping 9 card.
- `IMPLEMENTATION-CHECKLIST.md` — checklist implementasi dan regression.
- `AI-CODING-AGENT-PROMPT.md` — prompt siap pakai untuk AI coding agent.
- `VISUAL-REFERENCE.md` — aturan penggunaan referensi visual.
- `printflow-ui-reorganization-mockup.png` — mockup visual referensi.

## Workflow
1. Letakkan folder ini sebagai `docs/ui-reorganization/` di repository PrintFlow.
2. Berikan `AI-CODING-AGENT-PROMPT.md` kepada AI coding agent.
3. Minta AI melakukan audit terlebih dahulu.
4. Review audit + implementation plan.
5. Baru izinkan implementasi.
6. Gunakan checklist untuk regression dan visual review.

**Prinsip:** ini adalah UI reorganization, bukan rewrite. Pertahankan business logic, data, API, dan fungsi existing.
