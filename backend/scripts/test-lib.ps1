# Shared helpers for china-orders PowerShell tests. ASCII only: PowerShell 5 reads files without BOM as ANSI.
$script:ok = 0; $script:fail = 0; $script:failed = @(); $script:lines = @()

function Section($title) {
  $script:lines += ""; $script:lines += "== $title"
  Write-Host ""; Write-Host "== $title" -ForegroundColor Cyan
}

function Check($name, $cond) {
  if ($cond) { $line = "OK    $name"; $script:ok++; Write-Host $line }
  else { $line = "FAIL  $name"; $script:fail++; $script:failed += $name; Write-Host $line -ForegroundColor Red }
  $script:lines += $line
}

function Invoke-Api($method, $path, $token, $body, $sess) {
  $p = @{ Method = $method; Uri = "$base$path"; UseBasicParsing = $true; TimeoutSec = 30; ContentType = "application/json" }
  if ($token) { $p.Headers = @{ Authorization = "Bearer $token" } }
  if ($null -ne $body) { $p.Body = ($body | ConvertTo-Json -Depth 6) }
  if ($null -ne $sess) { $p.WebSession = $sess }
  $hdr = $null; $code = 0; $txt = ""
  try { $r = Invoke-WebRequest @p; $code = [int]$r.StatusCode; $txt = $r.Content; $hdr = $r.Headers }
  catch {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode; $txt = $_.ErrorDetails.Message }
  }
  $json = $null
  try { $json = $txt | ConvertFrom-Json } catch {}
  [pscustomobject]@{ Status = $code; Json = $json; Headers = $hdr; Data = $json.data }
}

function Get-Tok($email) { (Invoke-Api Post "/auth/login" $null @{ email = $email; password = "Test1234!" }).Data.accessToken }
function New-Session { New-Object Microsoft.PowerShell.Commands.WebRequestSession }
function Sql($q) { ((docker compose -f docker-compose.dev.yml exec -T postgres psql -U app_user -d china_orders -t -A -c $q) -join "`n").Trim() }
function Redis-Cli { docker compose -f docker-compose.dev.yml exec -T redis redis-cli @args }
function Clear-RateLimits { Redis-Cli EVAL "for _,k in ipairs(redis.call('keys','ratelimit:*')) do redis.call('del',k) end return 1" 0 | Out-Null }

# Sends the same request N times at once; returns the list of HTTP status codes
function Run-Parallel($count, $method, $path, $token, $body) {
  $json = ($body | ConvertTo-Json -Depth 5)
  $jobs = 1..$count | ForEach-Object {
    Start-Job -ScriptBlock {
      param($u, $m, $t, $b)
      try { [int](Invoke-WebRequest -Method $m -Uri $u -Headers @{ Authorization = "Bearer $t" } -ContentType "application/json" -Body $b -UseBasicParsing -TimeoutSec 30).StatusCode }
      catch { [int]$_.Exception.Response.StatusCode }
    } -ArgumentList "$base$path", $method, $token, $json
  }
  $res = $jobs | Wait-Job | Receive-Job
  $jobs | Remove-Job
  , @($res)
}