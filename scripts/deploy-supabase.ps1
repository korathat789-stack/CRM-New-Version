<#
.SYNOPSIS
  Apply the MatchPoint CRM database to a Supabase Postgres project.

.DESCRIPTION
  Runs the SQL migrations (0001 -> 0004) and seed.sql, in order, against your
  Supabase database using psql. Run it from your OWN machine at the repo root
  (this sandbox cannot reach *.supabase.co).

  Supabase hosts the DATABASE/AUTH — this is what "deploy to Supabase" means.
  The Next.js front end deploys separately (e.g. Vercel); see the notes at the
  bottom.

.PARAMETER DbUrl
  Postgres connection URI from:
    Supabase Dashboard -> Project Settings -> Database -> Connection string (URI)
  It contains your DB password. If you omit it, the script prompts securely.
  Tip: if the direct "db.<ref>.supabase.co" host fails (IPv6-only on some
  networks), use the "Session pooler" URI instead (port 5432, IPv4).

.PARAMETER SkipSeed
  Apply schema only (skip the sample seed data).

.EXAMPLE
  ./scripts/deploy-supabase.ps1
  # prompts for the connection URI, then applies everything

.EXAMPLE
  ./scripts/deploy-supabase.ps1 -DbUrl "postgresql://postgres:PWD@db.rxyoqfphylhuncdrjctd.supabase.co:5432/postgres" -SkipSeed
#>
param(
  [string]$DbUrl,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

# Repo root = parent of this script's folder.
$root = Split-Path -Parent $PSScriptRoot

$files = @(
  "supabase/migrations/0001_init.sql",
  "supabase/migrations/0002_mpt_crm_core.sql",
  "supabase/migrations/0003_reports.sql",
  "supabase/migrations/0004_stage_gates.sql",
  "supabase/migrations/0005_v1_fixes.sql",
  "supabase/migrations/0006_revenue_tracking.sql"
)
if (-not $SkipSeed) { $files += "supabase/seed.sql" }

# Require the PostgreSQL client (psql).
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error @"
psql (PostgreSQL client) was not found on PATH.
Install it, then re-run:
  winget install PostgreSQL.PostgreSQL      # or
  choco install postgresql
Alternatively, paste supabase/migrations/*.sql (then seed.sql) into the
Supabase Dashboard -> SQL Editor and run them in order.
"@
}

# Get the connection URI (securely if not passed).
if (-not $DbUrl) {
  $secure = Read-Host "Paste your Supabase Postgres connection URI" -AsSecureString
  $bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $DbUrl  = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if ([string]::IsNullOrWhiteSpace($DbUrl)) { Write-Error "No connection URI provided." }

Write-Host "Deploying MatchPoint CRM database..." -ForegroundColor Cyan
foreach ($f in $files) {
  $path = Join-Path $root $f
  if (-not (Test-Path $path)) { Write-Error "Missing file: $f" }
  Write-Host ("  -> {0}" -f $f) -ForegroundColor DarkCyan
  # ON_ERROR_STOP makes psql exit non-zero on the first SQL error.
  & psql $DbUrl -v ON_ERROR_STOP=1 -f $path
  if ($LASTEXITCODE -ne 0) { Write-Error "Failed while applying $f (exit $LASTEXITCODE)." }
}

Write-Host ""
Write-Host "Database deployed successfully." -ForegroundColor Green
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  1. Supabase -> Authentication -> Providers: enable Email."
Write-Host "  2. Supabase -> Authentication -> Users -> Add user (confirm it)."
Write-Host "     The first profile created becomes 'admin' automatically."
Write-Host "  3. Run the app:  npm install; npm run dev   (with .env.local set)."
