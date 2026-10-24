$Base = 'http://localhost:3000/api/v1'
$Pass = if ($env:SEED_PASSWORD) { $env:SEED_PASSWORD } else { 'Test1234!' }
$Customer = @{ email = 'customer@test.local'; password = $Pass }
$Manager  = @{ email = 'manager@test.local';  password = $Pass }
$NextStatus = 'processing'   # допустимый переход из paid по 007

function Get-Token($cred) {
  $r = Invoke-RestMethod "$Base/auth/login" -Method Post -ContentType 'application/json' `
    -Body ($cred | ConvertTo-Json)
  if ($r.data) { $r.data.accessToken } else { $r.accessToken }
}
function New-AuthHeader($t) { @{ Authorization = "Bearer $t" } }
function Get-StatusCodeOf([scriptblock]$req) {
  try { & $req | Out-Null; 200 } catch { [int]$_.Exception.Response.StatusCode.value__ }
}
$script:fail = 0
function Check($name, $ok) {
  if ($ok) { Write-Host "OK   $name" -ForegroundColor Green }
  else { Write-Host "FAIL $name" -ForegroundColor Red; $script:fail++ }
}
function Patch($id, $hdr, $body) {
  Get-StatusCodeOf { Invoke-RestMethod "$Base/manager/orders/$id/status" -Method Patch `
    -Headers $hdr -ContentType 'application/json' -Body ($body | ConvertTo-Json) }
}
function Unwrap($r) { if ($r.data) { $r.data } else { $r } }

try {
  $ch = New-AuthHeader (Get-Token $Customer)
  $mh = New-AuthHeader (Get-Token $Manager)
} catch { Write-Host 'Логин не прошёл: проверь пароль (SEED_PASSWORD в .env)'; return }

# маршрут должен существовать, иначе все 404 ложные
$probe = Get-StatusCodeOf { Invoke-RestMethod "$Base/manager/orders" }
if ($probe -ne 401) { Write-Host "Ожидали 401 на /manager/orders, получили $probe (модуль не подключён?)"; return }

# --- GET /manager/orders ---
Check 'без токена 401' ($probe -eq 401)
Check 'customer 403' ((Get-StatusCodeOf { Invoke-RestMethod "$Base/manager/orders" -Headers $ch }) -eq 403)
$d = Unwrap (Invoke-RestMethod "$Base/manager/orders" -Headers $mh)
Check 'manager 200, items есть' ($d.items.Count -gt 0)
$i = $d.items[0]
Check 'поля items' ($i.id -is [string] -and $i.orderNumber -and $i.customer.name -and $i.status.code -and $i.status.nameRu -and ($i.totalRub -is [ValueType]) -and ($i.itemsCount -is [ValueType]) -and $i.createdAt)
Check 'page/limit/total/totalPages' ($d.page -eq 1 -and $d.limit -eq 20 -and $d.total -ge $d.items.Count -and $d.totalPages -ge 1)
Check 'limit=51 → 400' ((Get-StatusCodeOf { Invoke-RestMethod "$Base/manager/orders?limit=51" -Headers $mh }) -eq 400)
Check 'status=zzz → 400' ((Get-StatusCodeOf { Invoke-RestMethod "$Base/manager/orders?status=zzz" -Headers $mh }) -eq 400)
$pd = Unwrap (Invoke-RestMethod "$Base/manager/orders?status=paid&limit=50" -Headers $mh)
Check 'фильтр status=paid' ($pd.items.Count -gt 0 -and -not ($pd.items | Where-Object { $_.status.code -ne 'paid' }))
if (-not $pd.items.Count) { Write-Host 'Нет заказов paid, PATCH-проверки пропущены'; return }

# --- PATCH status ---
$id = $pd.items[0].id
Check 'customer PATCH 403' ((Patch $id $ch @{ status = $NextStatus }) -eq 403)
Check 'id=abc → 400' ((Patch 'abc' $mh @{ status = $NextStatus }) -eq 400)
try {
  Invoke-RestMethod "$Base/manager/orders/999999999/status" -Method Patch -Headers $mh `
    -ContentType 'application/json' -Body (@{ status = $NextStatus } | ConvertTo-Json) | Out-Null
  Check '404 про заказ' $false
} catch {
  $e = $_.ErrorDetails.Message | ConvertFrom-Json
  Check '404 про заказ' ($_.Exception.Response.StatusCode.value__ -eq 404 -and $e.error.message -eq 'Заказ не найден')
}
Check 'без status → 400' ((Patch $id $mh @{ comment = 'x' }) -eq 400)
Check 'неизвестный статус → 400' ((Patch $id $mh @{ status = 'zzz' }) -eq 400)
Check 'status=paid → 409' ((Patch $id $mh @{ status = 'paid' }) -eq 409)
Check 'status=new → 409' ((Patch $id $mh @{ status = 'new' }) -eq 409)
Check 'cancelled без comment → 400' ((Patch $id $mh @{ status = 'cancelled' }) -eq 400)
Check 'comment >1000 → 400' ((Patch $id $mh @{ status = $NextStatus; comment = ('x' * 1001) }) -eq 400)
Check 'недопустимый переход → 409' ((Patch $id $mh @{ status = 'delivered' }) -eq 409)

$o = Unwrap (Invoke-RestMethod "$Base/manager/orders/$id/status" -Method Patch -Headers $mh `
  -ContentType 'application/json' -Body (@{ status = $NextStatus; comment = 'check 4.6b' } | ConvertTo-Json))
Check "paid → $NextStatus, 200" ($o.status.code -eq $NextStatus -or $o.status -eq $NextStatus)
$last = $o.history | Select-Object -Last 1
if (-not $last) { $last = $o.statusHistory | Select-Object -Last 1 }
Check 'в истории comment' ($last.comment -eq 'check 4.6b')
Check 'в истории changedBy не пустой' ($last.changedBy -and ($last.changedBy.PSObject.Properties.Count -gt 0))
Check 'повтор того же статуса → 409' ((Patch $id $mh @{ status = $NextStatus }) -eq 409)

Write-Host "`nFAIL: $script:fail"
