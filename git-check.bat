@echo off
setlocal
cd /d "%~dp0"
title 🔍 Git Health & Diagnostic Checker v2.0
set "BATCH_PATH=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllLines($env:BATCH_PATH); $ps=$c[12..($c.Length-1)] -join [Environment]::NewLine; Invoke-Expression $ps"
echo.
echo ===============================================================================
echo  Pemeriksaan selesai. Tekan sembarang tombol pada keyboard untuk menutup...
echo ===============================================================================
pause >nul
exit /b

# ==============================================================================
# SCRIPT DIAGNOSTIK POWERSHELL (MURNI READ-ONLY - 100% AMAN)
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Header($text) {
    Write-Host "`n═══════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
    Write-Host " $text" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
}

Clear-Host
Write-Host "╔═════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           🔍 GIT HEALTH & DIAGNOSTIC CHECKER v2.0               ║" -ForegroundColor Cyan
Write-Host "║           Mode: READ-ONLY (Tidak mengubah data apapun)          ║" -ForegroundColor Cyan
Write-Host "╚═════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host " 📂 Folder Target : $PWD" -ForegroundColor Gray
Write-Host " 🕐 Waktu Scan    : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray

# ----------------------------------------------------------------------
# 1. CEK GIT TERINSTALL
# ----------------------------------------------------------------------
Write-Header "[1/14] CEK GIT TERINSTALL"
$gitVersion = git --version 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitVersion)) {
    Write-Host "  [X] GAGAL: Git TIDAK terdeteksi di system PATH kamu!" -ForegroundColor Red
    Write-Host "  [!] Solusi: Install Git dari https://git-scm.com" -ForegroundColor Yellow
    return
}
Write-Host "  [V] OK: $gitVersion" -ForegroundColor Green
$gitPath = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
Write-Host "  [>] Lokasi: $gitPath" -ForegroundColor Gray

# ----------------------------------------------------------------------
# 2. CEK GIT REPOSITORY
# ----------------------------------------------------------------------
Write-Header "[2/14] CEK FOLDER REPOSITORY"
$isInsideRepo = git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [X] GAGAL: Folder ini BUKAN sebuah Git repository!" -ForegroundColor Red
    Write-Host "  [!] Taruh file .bat ini di root folder project kamu." -ForegroundColor Yellow
    return
}
$repoRoot = git rev-parse --show-toplevel 2>$null
Write-Host "  [V] OK: Git repository terdeteksi." -ForegroundColor Green
Write-Host "  [>] Repo Root: $repoRoot" -ForegroundColor Gray

# ----------------------------------------------------------------------
# 3. BRANCH AKTIF
# ----------------------------------------------------------------------
Write-Header "[3/14] BRANCH AKTIF"
$currentBranch = git branch --show-current 2>$null
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    Write-Host "  [!] PERINGATAN: Head terlepas (Detached HEAD)" -ForegroundColor Yellow
} else {
    Write-Host "  [V] Branch aktif saat ini: $currentBranch" -ForegroundColor Green
}
Write-Host "  Daftar branch lokal:" -ForegroundColor Gray
git branch | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }

# ----------------------------------------------------------------------
# 4. REMOTE / ORIGIN
# ----------------------------------------------------------------------
Write-Header "[4/14] REMOTE REPOSITORY (ORIGIN)"
$remotes = git remote -v 2>$null
if ([string]::IsNullOrWhiteSpace($remotes)) {
    Write-Host "  [!] Tidak ada remote repository yang terhubung." -ForegroundColor Yellow
} else {
    $remotes | ForEach-Object { Write-Host "  [>] $_" -ForegroundColor Green }
}

# ----------------------------------------------------------------------
# 5 & 6. GLOBAL CONFIG
# ----------------------------------------------------------------------
Write-Header "[5/14 & 6/14] KONFIGURASI GLOBAL"
$globalName = git config --global user.name 2>$null
$globalEmail = git config --global user.email 2>$null

if ($globalName) {
    Write-Host "  [V] Global user.name  : $globalName" -ForegroundColor Green
} else {
    Write-Host "  [!] Global user.name  : (KOSONG / Belum diset)" -ForegroundColor Yellow
}

if ($globalEmail) {
    Write-Host "  [V] Global user.email : $globalEmail" -ForegroundColor Green
} else {
    Write-Host "  [!] Global user.email : (KOSONG / Belum diset)" -ForegroundColor Yellow
}

# ----------------------------------------------------------------------
# 7 & 8. LOCAL CONFIG
# ----------------------------------------------------------------------
Write-Header "[7/14 & 8/14] KONFIGURASI LOKAL (PROJECT INI)"
$localName = git config --local user.name 2>$null
$localEmail = git config --local user.email 2>$null

if ($localName) {
    Write-Host "  [V] Local user.name   : $localName" -ForegroundColor Cyan
} else {
    Write-Host "  [i] Local user.name   : (Tidak diset - default ke Global)" -ForegroundColor Gray
}

if ($localEmail) {
    Write-Host "  [V] Local user.email  : $localEmail" -ForegroundColor Cyan
} else {
    Write-Host "  [i] Local user.email  : (Tidak diset - default ke Global)" -ForegroundColor Gray
}

# ----------------------------------------------------------------------
# 9. DETEKSI OVERRIDE (RANJAU DARAT)
# ----------------------------------------------------------------------
Write-Header "[9/14] DETEKSI OVERRIDE (POTENSI RANJAU DARAT)"
$hasOverride = $false

if ($localEmail -and $globalEmail -and ($localEmail -ne $globalEmail)) {
    Write-Host "  [!] 🚨 OVERRIDE DETECTED PADA EMAIL!" -ForegroundColor Red
    Write-Host "      Global Email : $globalEmail" -ForegroundColor Gray
    Write-Host "      Local Email  : $localEmail  <-- INI YANG DIGUNAKAN" -ForegroundColor Yellow
    Write-Host "      *Jika email ini bukan yang terdaftar di akun GitHub/Vercel," -ForegroundColor Red
    Write-Host "       deployment atau permission bisa langsung DI-BLOKIR!" -ForegroundColor Red
    $hasOverride = $true
}

if ($localName -and $globalName -and ($localName -ne $globalName)) {
    Write-Host "  [!] 🚨 OVERRIDE DETECTED PADA USERNAME!" -ForegroundColor Yellow
    Write-Host "      Global Name  : $globalName" -ForegroundColor Gray
    Write-Host "      Local Name   : $localName  <-- INI YANG DIGUNAKAN" -ForegroundColor Cyan
    $hasOverride = $true
}

if (-not $hasOverride) {
    Write-Host "  [V] AMAN: Tidak ada konflik override antara Local & Global." -ForegroundColor Green
}

# ----------------------------------------------------------------------
# 10. IDENTITAS EFEKTIF
# ----------------------------------------------------------------------
Write-Header "[10/14] IDENTITAS GIT YANG AKAN DIPAKAI SAAT COMMIT"
$effectiveName = git config user.name 2>$null
$effectiveEmail = git config user.email 2>$null

Write-Host "  👤 Author Name  : $(if($effectiveName){$effectiveName}else{'[KOSONG - ERROR]'})" -ForegroundColor Green
Write-Host "  📧 Author Email : $(if($effectiveEmail){$effectiveEmail}else{'[KOSONG - ERROR]'})" -ForegroundColor Green

# ----------------------------------------------------------------------
# 11. COMMIT TERAKHIR
# ----------------------------------------------------------------------
Write-Header "[11/14] COMMIT TERAKHIR DI LOCAL"
$lastCommit = git log -1 --pretty=format:"Hash     : %h%nAuthor   : %an <%ae>%nCommitter: %cn <%ce>%nTanggal  : %ad%nSubject  : %s" 2>$null
if ($lastCommit) {
    $lastCommit | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "  [i] Belum ada commit di repository ini." -ForegroundColor Yellow
}

# ----------------------------------------------------------------------
# 12. STATUS WORKING TREE
# ----------------------------------------------------------------------
Write-Header "[12/14] WORKING TREE (STATUS PERUBAHAN FILE)"
$status = git status --short 2>$null
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "  [V] Bersih (Clean) - Tidak ada file yang diubah atau belum di-commit." -ForegroundColor Green
} else {
    Write-Host "  [!] Ada file yang belum di-commit / staged:" -ForegroundColor Yellow
    $status | ForEach-Object { Write-Host "     $_" -ForegroundColor Yellow }
}

# ----------------------------------------------------------------------
# 13. SINKRONISASI AHEAD / BEHIND DENGAN REMOTE
# ----------------------------------------------------------------------
Write-Header "[13/14] STATUS SINKRONISASI DENGAN REMOTE"
$upstream = git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
    Write-Host "  [!] Branch '$currentBranch' belum di-set untuk melacak upstream remote." -ForegroundColor Yellow
    Write-Host "      (Contoh: git push -u origin $currentBranch)" -ForegroundColor Gray
} else {
    Write-Host "  Melacak remote branch: $upstream" -ForegroundColor Gray
    $counts = git rev-list --count --left-right "$upstream...HEAD" 2>$null
    if ($counts) {
        $behind, $ahead = $counts.Split("`t")
        if ($ahead -eq "0" -and $behind -eq "0") {
            Write-Host "  [V] SINKRON: Lokal sudah sama persis dengan remote GitHub." -ForegroundColor Green
        } else {
            if ($ahead -gt 0) {
                Write-Host "  [!] AHEAD: Ada $ahead commit lokal yang BELUM DI-PUSH ke GitHub!" -ForegroundColor Yellow
                Write-Host "      *Vercel/CI/CD belum membaca update terbaru ini!" -ForegroundColor Yellow
            }
            if ($behind -gt 0) {
                Write-Host "  [!] BEHIND: Ada $behind commit di GitHub yang BELUM DI-PULL ke lokal!" -ForegroundColor Cyan
            }
        }
    }
}

# ----------------------------------------------------------------------
# 14. DETEKSI GITHUB
# ----------------------------------------------------------------------
Write-Header "[14/14] DETEKSI REPOSITORY GITHUB"
$remoteUrl = git config --get remote.origin.url 2>$null
if ($remoteUrl) {
    Write-Host "  Origin URL: $remoteUrl" -ForegroundColor Gray
    if ($remoteUrl -match "github\.com") {
        Write-Host "  [V] Remote terverifikasi sebagai GITHUB." -ForegroundColor Green
    } else {
        Write-Host "  [i] Remote bukan GitHub (GitLab / Bitbucket / Private Server)." -ForegroundColor Gray
    }
} else {
    Write-Host "  [!] Tidak ada remote.origin.url terdaftar." -ForegroundColor Yellow
}

# ----------------------------------------------------------------------
# BONUS: ASAL KONFIGURASI (--show-origin)
# ----------------------------------------------------------------------
Write-Header "🔎 SUMBER ASAL KONFIGURASI GIT"
Write-Host "Dari file mana Git mengambil setting user kamu:" -ForegroundColor Gray
git config --show-origin --show-scope user.name 2>$null | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
git config --show-origin --show-scope user.email 2>$null | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# ----------------------------------------------------------------------
# BONUS: AUDIT .GITIGNORE (RANJAU BOCORNYA SECRET/ENV)
# ----------------------------------------------------------------------
Write-Header "📄 AUDIT KEAMANAN .gitignore"
if (Test-Path ".gitignore") {
    Write-Host "  [V] File .gitignore ditemukan." -ForegroundColor Green
    $gitignore = Get-Content ".gitignore" -ErrorAction SilentlyContinue

    if ($gitignore -match "node_modules") {
        Write-Host "  [V] 'node_modules' aman di-ignore." -ForegroundColor Green
    } else {
        Write-Host "  [!] 'node_modules' TIDAK ADA di .gitignore!" -ForegroundColor Yellow
    }

    if ($gitignore -match "\.env") {
        Write-Host "  [V] '.env' aman di-ignore (Database / Neon password tidak akan bocor)." -ForegroundColor Green
    } else {
        Write-Host "  [X] 🚨 BAHAYA BESAR: '.env' TIDAK ADA di .gitignore!" -ForegroundColor Red
        Write-Host "      Password database Neon / API Keys rentan ter-push ke GitHub!" -ForegroundColor Red
    }
} else {
    Write-Host "  [X] 🚨 BAHAYA: File .gitignore TIDAK ADA di root project!" -ForegroundColor Red
}

Write-Host "`n═══════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  ✅ DIAGNOSTIK SELESAI. (Tidak ada data yang diubah/dimodifikasi)" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray