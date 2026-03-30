# sf-preflight.ps1
# SequenceForge session pre-flight check
# Run: .\sf-preflight.ps1

$base = "http://localhost:3799"
$pass = 0
$fail = 0

function Separator { Write-Host "------------------------" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  OK    $msg" -ForegroundColor Green;  $script:pass++ }
function Fail($msg) { Write-Host "  FAIL  $msg" -ForegroundColor Red;    $script:fail++ }
function Info($msg) { Write-Host "        $msg" -ForegroundColor DarkCyan }
function Warn($msg) { Write-Host "  WARN  $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "SequenceForge Pre-flight" -ForegroundColor Cyan
Separator

# 1. Status (JSON)
try {
    $status = Invoke-RestMethod -Uri "$base/status" -TimeoutSec 5
    Ok "GET /status -- server alive"
    Info "version : $($status.version)"
    Info "clean   : $($status.git.clean)"
    Info "commit  : $($status.git.lastCommit)"
    if (-not $status.git.clean) {
        Warn "working tree is dirty -- uncommitted changes present"
    }
} catch {
    Fail "GET /status -- $($_.Exception.Message)"
}

# 2. Store gate (HTML -- parse summary line)
try {
    $html = Invoke-WebRequest -Uri "$base/test" -TimeoutSec 30 -UseBasicParsing
    $text = $html.Content
    # Summary line looks like: "120 passed | 0 failed | 120 total"
    if ($text -match '(\d+) passed \| (\d+) failed \| (\d+) total') {
        $p = [int]$Matches[1]
        $f = [int]$Matches[2]
        if ($p -eq 120 -and $f -eq 0) {
            Ok "GET /test -- store gate"
            Info "passed  : $p / 120"
        } else {
            Fail "GET /test -- store gate"
            Info "passed  : $p / 120  failed: $f"
        }
    } else {
        Fail "GET /test -- could not parse summary line"
    }
} catch {
    Fail "GET /test -- $($_.Exception.Message)"
}

# 3. Render gate (JSON)
try {
    $render = Invoke-RestMethod -Uri "$base/test-render" -TimeoutSec 60
    if ($render.ok -eq $false) {
        Fail "GET /test-render -- $($render.error)"
        Write-Host ""
        Warn "Playwright not installed. Run:"
        Write-Host "          npm install"                                               -ForegroundColor Yellow
        Write-Host "          npx playwright install chromium"                          -ForegroundColor Yellow
        Warn "Restart launcher.js, then seed once:"
        Write-Host "          Invoke-RestMethod http://localhost:3799/test-render?update=1" -ForegroundColor Yellow
    } elseif ($render.passed -eq 15 -and $render.failed -eq 0) {
        Ok "GET /test-render -- render gate"
        Info "passed  : $($render.passed) / 15"
    } else {
        Fail "GET /test-render -- render gate"
        Info "passed  : $($render.passed)  failed: $($render.failed)"
    }
} catch {
    Fail "GET /test-render -- $($_.Exception.Message)"
}

# Summary
Write-Host ""
Separator
if ($fail -eq 0) {
    Write-Host "  ALL CHECKS PASSED ($pass/$($pass+$fail)) -- session is go" -ForegroundColor Green
} else {
    Write-Host "  $fail CHECK(S) FAILED -- resolve before starting work" -ForegroundColor Red
}
Write-Host ""
