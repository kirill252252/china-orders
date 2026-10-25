# china-orders regression test. ASCII only: PowerShell 5 reads files without BOM as ANSI.
# Run:  powershell -ExecutionPolicy Bypass -File backend\scripts\regression.ps1
# The script restores rate, commission, tariffs, roles and personal lists, and deletes the data it creates.
$ErrorActionPreference = "Continue"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
$base = "http://localhost:3000/api/v1"
. (Join-Path $PSScriptRoot "test-lib.ps1")
$tarAg = Get-Random -Minimum 100000 -Maximum 999999
$started = Get-Date

function Refresh-Tokens {
  $script:t2 = Get-Tok "customer2@test.local"; $script:t3 = Get-Tok "customer3@test.local"
  $script:tm = Get-Tok "manager@test.local"; $script:ta = Get-Tok "admin@test.local"
}
function Make-Cart($tok, $qty) {
  Invoke-Api Delete "/cart" $tok $null | Out-Null
  Invoke-Api Post "/cart/items" $tok @{ productId = "1048"; quantity = $qty } | Out-Null
}
function New-Order($tok, $addr, $qty) {
  Make-Cart $tok $qty
  (Invoke-Api Post "/orders" $tok @{ addressId = $addr; customerComment = "reg-$tarAg" }).Data
}
function New-PaidOrder($tok, $addr) {
  $o = New-Order $tok $addr 1
  if ($o.id) { Invoke-Api Post "/orders/$($o.id)/pay" $tok @{} | Out-Null }
  $o.id
}
function Set-Status($tok, $id, $status, $comment) {
  $b = @{ status = $status }
  if ($comment) { $b.comment = $comment }
  Invoke-Api Patch "/manager/orders/$id/status" $tok $b
}
function New-Tariff($name, $min, $max, $active) {
  Invoke-Api Post "/admin/tariffs" $script:ta @{ name = $name; minWeightKg = $min; maxWeightKg = $max; baseCostRub = 10; perKgCostRub = 1; minDays = 1; maxDays = 2; isActive = $active }
}
function Role-Of($id) { Sql "SELECT r.name || '/' || u.is_active FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$id" }

# ---------------------------------------------------------------- preflight
Section "preflight"
$health = Invoke-Api Get "/health" $null $null
Check "health 200" ($health.Status -eq 200)
if ($health.Status -ne 200) { Write-Host "Backend is not available. Start the stack and retry." -ForegroundColor Red; exit 2 }
Clear-RateLimits
Refresh-Tokens
Check "tokens for four users" ($t2 -and $t3 -and $tm -and $ta)
if (-not ($t2 -and $t3 -and $tm -and $ta)) { exit 2 }
$uid2 = Sql "SELECT id FROM users WHERE email='customer2@test.local'"
$uid3 = Sql "SELECT id FROM users WHERE email='customer3@test.local'"
$uidM = Sql "SELECT id FROM users WHERE email='manager@test.local'"
$uidA = Sql "SELECT id FROM users WHERE email='admin@test.local'"
$addr2 = Sql "SELECT id FROM addresses WHERE user_id=$uid2 AND type='delivery' ORDER BY id LIMIT 1"
$addr3 = Sql "SELECT id FROM addresses WHERE user_id=$uid3 AND type='delivery' ORDER BY id LIMIT 1"
$def3 = Sql "SELECT COALESCE(string_agg(id::text, ','), '') FROM addresses WHERE user_id=$uid3 AND is_default"
$rate0 = [double](Sql "SELECT rate FROM exchange_rates WHERE is_active ORDER BY valid_from DESC LIMIT 1")
$comm0 = [double](Sql "SELECT value FROM settings WHERE key='default_commission_percent'")
Sql "DROP TABLE IF EXISTS zz_up_backup" | Out-Null
Sql "CREATE TABLE zz_up_backup AS SELECT * FROM user_products" | Out-Null
$links0 = Sql "SELECT count(*) FROM user_products"
$had1048 = Sql "SELECT count(*) FROM user_products WHERE user_id=$uid2 AND product_id=1048"
Check "baseline: seed tariffs 1..3 active" ((Sql "SELECT count(*) FROM delivery_tariffs WHERE id IN (1,2,3) AND is_active") -eq "3")
Check "baseline: no extra active tariffs" ((Sql "SELECT count(*) FROM delivery_tariffs WHERE id NOT IN (1,2,3) AND is_active") -eq "0")
if ([math]::Abs($rate0 - 12.5) -gt 0.0000001) { Invoke-Api Post "/admin/rates" $ta @{ rate = 12.5 } | Out-Null }
Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = 5 } | Out-Null
Check "baseline: rate 12.5 and commission 5" ((Invoke-Api Get "/admin/rates/current" $ta $null).Data.rate -eq 12.5 -and (Invoke-Api Get "/admin/settings/commission" $ta $null).Data.commissionPercent -eq 5)

# ---------------------------------------------------------------- auth
Section "auth"
Check "me: no token 401" ((Invoke-Api Get "/auth/me" $null $null).Status -eq 401)
$me = Invoke-Api Get "/auth/me" $t2 $null
Check "me: customer2 data" ($me.Status -eq 200 -and $me.Data.user.email -eq "customer2@test.local" -and $me.Data.user.role -eq "customer")
Check "login: wrong password 401" ((Invoke-Api Post "/auth/login" $null @{ email = "customer2@test.local"; password = "Wrong0000!" }).Status -eq 401)
Check "login: unknown user 401" ((Invoke-Api Post "/auth/login" $null @{ email = "nobody@test.local"; password = "Test1234!" }).Status -eq 401)
Check "login: no email 400" ((Invoke-Api Post "/auth/login" $null @{ password = "x" }).Status -eq 400)
Check "register: short password 400" ((Invoke-Api Post "/auth/register" $null @{ email = "zz-reg-short-$tarAg@test.local"; password = "short"; fullName = "ZZ" }).Status -eq 400)
Check "register: duplicate email rejected" ((Invoke-Api Post "/auth/register" $null @{ email = "customer2@test.local"; password = "Test1234!"; fullName = "ZZ" }).Status -in 400, 409)
$s = New-Session
$login = Invoke-Api Post "/auth/login" $null @{ email = "customer@test.local"; password = "Test1234!" } $s
Check "session: login returns token" ($login.Status -eq 200 -and $login.Data.accessToken)
$rf1 = Invoke-Api Post "/auth/refresh" $null $null $s
Check "session: refresh 200" ($rf1.Status -eq 200 -and $rf1.Data.accessToken)
$rf2 = Invoke-Api Post "/auth/refresh" $null $null $s
Check "session: refresh again (rotation) 200" ($rf2.Status -eq 200)
$lo = Invoke-Api Post "/auth/logout" $rf2.Data.accessToken @{} $s
Check "session: logout ok" ($lo.Status -in 200, 204)
Check "session: refresh after logout rejected" ((Invoke-Api Post "/auth/refresh" $null $null $s).Status -in 401, 403)
Check "access: customer blocked from manager and admin" ((Invoke-Api Get "/manager/orders" $t2 $null).Status -eq 403 -and (Invoke-Api Get "/admin/stats" $t2 $null).Status -eq 403)
Check "access: manager blocked from admin, orders list, addresses" ((Invoke-Api Get "/admin/stats" $tm $null).Status -eq 403 -and (Invoke-Api Get "/orders" $tm $null).Status -eq 403 -and (Invoke-Api Get "/addresses" $tm $null).Status -eq 403)

# ---------------------------------------------------------------- catalog
Section "catalog and personal list"
$g = Invoke-Api Get "/products?limit=5" $null $null
Check "list: 200 with pagination" ($g.Status -eq 200 -and $g.Data.limit -eq 5 -and $g.Data.total -ge 1 -and @($g.Data.items).Count -le 5)
$it = $g.Data.items[0]
Check "list: item fields" (($it.id -is [string]) -and $it.priceCny -gt 0 -and $it.marketplace.name)
Check "list: limit=101 gives 400" ((Invoke-Api Get "/products?limit=101" $null $null).Status -eq 400)
$pa = @((Invoke-Api Get "/products?sort=price_asc&limit=5" $null $null).Data.items | ForEach-Object { [double]$_.priceCny })
Check "list: sort price_asc" ($pa.Count -lt 2 -or $pa[0] -le $pa[1])
Check "search: % is literal" ([string](Invoke-Api Get "/products?q=%25" $null $null).Data.total -eq (Sql "SELECT count(*) FROM products WHERE is_active AND position('%' in name) > 0"))
$cq = "zzcache$tarAg"
$c1 = Invoke-Api Get "/products?q=$cq" $null $null
$c2 = Invoke-Api Get "/products?q=$cq" $null $null
Check "cache: MISS then HIT" ($c1.Headers["X-Cache"] -eq "MISS" -and $c2.Headers["X-Cache"] -eq "HIT")
$d = Invoke-Api Get "/products/1048" $null $null
Check "detail: 200, id is string, marketplace name" ($d.Status -eq 200 -and ($d.Data.id -is [string]) -and $d.Data.marketplace.name)
Check "detail: abc 400, missing 404" ((Invoke-Api Get "/products/abc" $null $null).Status -eq 400 -and (Invoke-Api Get "/products/999999" $null $null).Status -eq 404)

$urlImp = "https://detail.1688.com/offer/$tarAg.html"
Check "import: no token 401" ((Invoke-Api Post "/products/import" $null @{ url = $urlImp }).Status -eq 401)
Check "import: unknown url 400" ((Invoke-Api Post "/products/import" $t3 @{ url = "https://example.com/x" }).Status -eq 400)
Check "import: fake host 400" ((Invoke-Api Post "/products/import" $t3 @{ url = "https://detail.1688.com.evil.com/offer/123.html" }).Status -eq 400)
$n0 = (Invoke-Api Get "/products/mine" $t3 $null).Data.total
$imp = Invoke-Api Post "/products/import" $t3 @{ url = $urlImp }
$impId = $imp.Data.id
Check "import: 201 created" ($imp.Status -eq 201 -and $imp.Data.created -eq $true -and $impId)
$imp2 = Invoke-Api Post "/products/import" $t3 @{ url = $urlImp }
Check "import: repeat 200, same id, created false" ($imp2.Status -eq 200 -and $imp2.Data.id -eq $impId -and $imp2.Data.created -eq $false)
Check "import: one product row" ((Sql "SELECT count(*) FROM products WHERE external_id='$tarAg'") -eq "1")
Check "cache: dropped after import" ((Invoke-Api Get "/products?q=$cq" $null $null).Headers["X-Cache"] -eq "MISS")
Check "mine: contains imported product" ((Invoke-Api Get "/products/mine" $t3 $null).Data.total -eq ($n0 + 1))
Check "mine: no token 401" ((Invoke-Api Get "/products/mine" $null $null).Status -eq 401)
$man = Invoke-Api Post "/products/manual" $t3 @{ marketplace = "taobao"; name = "ZZ reg $tarAg"; priceCny = 50; weightKg = 0.5 }
Check "manual: 201" ($man.Status -eq 201 -and $man.Data.id)
Check "manual: unknown marketplace 400" ((Invoke-Api Post "/products/manual" $t3 @{ marketplace = "xxx"; name = "ZZ"; priceCny = 10; weightKg = 1 }).Status -eq 400)
Check "manual: price 0 gives 400" ((Invoke-Api Post "/products/manual" $t3 @{ marketplace = "taobao"; name = "ZZ"; priceCny = 0; weightKg = 1 }).Status -eq 400)
Check "mine: search finds manual product" ((Invoke-Api Get "/products/mine?q=ZZ%20reg%20$tarAg" $t3 $null).Data.total -eq 1)
Check "mine: delete id abc 400" ((Invoke-Api Delete "/products/mine/abc" $t3 $null).Status -eq 400)
Check "mine: delete foreign link 404" ((Invoke-Api Delete "/products/mine/$impId" $t2 $null).Status -eq 404)
Check "mine: delete own 200" ((Invoke-Api Delete "/products/mine/$impId" $t3 $null).Status -eq 200)
Check "mine: delete again 404" ((Invoke-Api Delete "/products/mine/$impId" $t3 $null).Status -eq 404)
Check "mine: product itself stays in catalog" ((Sql "SELECT count(*) FROM products WHERE id=$impId") -eq "1" -and (Invoke-Api Get "/products/$impId" $null $null).Status -eq 200)
Sql "DELETE FROM products WHERE external_id='$tarAg' OR name='ZZ reg $tarAg'" | Out-Null

# ---------------------------------------------------------------- calc
Section "calc"
$c = Invoke-Api Get "/calc?priceCny=688&quantity=2&weightKg=0.28" $null $null
Check "calc: 18060 + 384 = 18444" ($c.Data.itemsRub -eq 18060 -and $c.Data.deliveryRub -eq 384 -and $c.Data.totalRub -eq 18444)
Check "calc: single item 9372" ((Invoke-Api Get "/calc?priceCny=688&weightKg=0.28" $null $null).Data.totalRub -eq 9372)
Check "calc: heavy parcel uses tariff 5+ kg" ((Invoke-Api Get "/calc?priceCny=10&weightKg=6" $null $null).Data.deliveryRub -eq 1380)
Check "calc: validation 400" ((Invoke-Api Get "/calc?weightKg=1" $null $null).Status -eq 400 -and (Invoke-Api Get "/calc?priceCny=0&weightKg=1" $null $null).Status -eq 400 -and (Invoke-Api Get "/calc?priceCny=10&quantity=100&weightKg=1" $null $null).Status -eq 400 -and (Invoke-Api Get "/calc?priceCny=10&weightKg=abc" $null $null).Status -eq 400)

# ---------------------------------------------------------------- cart
Section "cart"
Invoke-Api Delete "/cart" $t3 $null | Out-Null
Invoke-Api Delete "/cart" $t2 $null | Out-Null
$cart = Invoke-Api Get "/cart" $t2 $null
Check "cart: empty at start, totals zero" (@($cart.Data.items).Count -eq 0 -and $cart.Data.totals.totalRub -eq 0)
Check "cart: no token 401" ((Invoke-Api Get "/cart" $null $null).Status -eq 401)
$a = Invoke-Api Post "/cart/items" $t2 @{ productId = "1048"; quantity = 2 }
Check "cart: add 2 pcs = 18060 + 384" ($a.Status -in 200, 201 -and $a.Data.totals.itemsRub -eq 18060 -and $a.Data.totals.deliveryRub -eq 384 -and $a.Data.totals.totalRub -eq 18444)
$a = Invoke-Api Post "/cart/items" $t2 @{ productId = "1048"; quantity = 3 }
Check "cart: repeat add makes one row, qty 5" (@($a.Data.items).Count -eq 1 -and $a.Data.items[0].quantity -eq 5)
$a = Invoke-Api Post "/cart/items" $t2 @{ productId = "1048"; quantity = 1; selectedAttributes = @{ color = "black" } }
Check "cart: other attributes make second row" (@($a.Data.items).Count -eq 2)
Check "cart: limit 99 gives 400" ((Invoke-Api Post "/cart/items" $t2 @{ productId = "1048"; quantity = 95 }).Status -eq 400)
$cart = Invoke-Api Get "/cart" $t2 $null
Check "cart: rolled back after limit error (5 + 1)" ((($cart.Data.items | Measure-Object -Property quantity -Sum).Sum) -eq 6)
Check "cart: validation 400" ((Invoke-Api Post "/cart/items" $t2 @{ productId = "1048"; quantity = 0 }).Status -eq 400 -and (Invoke-Api Post "/cart/items" $t2 @{ productId = "abc"; quantity = 1 }).Status -eq 400)
Check "cart: unknown product 404" ((Invoke-Api Post "/cart/items" $t2 @{ productId = "999999"; quantity = 1 }).Status -eq 404)
$itemId = $cart.Data.items[0].id
$pt = Invoke-Api Patch "/cart/items/$itemId" $t2 @{ quantity = 4 }
Check "cart: patch quantity" ($pt.Status -eq 200 -and (($pt.Data.items | Where-Object { $_.id -eq $itemId }).quantity -eq 4))
Check "cart: patch 0 gives 400, missing 404" ((Invoke-Api Patch "/cart/items/$itemId" $t2 @{ quantity = 0 }).Status -eq 400 -and (Invoke-Api Patch "/cart/items/999999" $t2 @{ quantity = 1 }).Status -eq 404)
Check "cart: foreign patch and delete 404" ((Invoke-Api Patch "/cart/items/$itemId" $t3 @{ quantity = 1 }).Status -eq 404 -and (Invoke-Api Delete "/cart/items/$itemId" $t3 $null).Status -eq 404)
Check "cart: other user cart stays empty" (@((Invoke-Api Get "/cart" $t3 $null).Data.items).Count -eq 0)
Check "cart: delete item" ((Invoke-Api Delete "/cart/items/$itemId" $t2 $null).Status -eq 200)
Check "cart: clear" (@((Invoke-Api Delete "/cart" $t2 $null).Data.items).Count -eq 0)
Make-Cart $t2 1
Sql "UPDATE products SET price_cny=700 WHERE id=1048" | Out-Null
$pc = (Invoke-Api Get "/cart" $t2 $null).Data
Sql "UPDATE products SET price_cny=688 WHERE id=1048" | Out-Null
Check "cart: price change flagged, total kept at old price" ($pc.items[0].priceChanged -eq $true -and $pc.totals.itemsRub -eq 9030)
Invoke-Api Delete "/cart" $t2 $null | Out-Null

# ---------------------------------------------------------------- addresses
Section "addresses"
Check "addresses: no token 401, manager 403" ((Invoke-Api Get "/addresses" $null $null).Status -eq 401 -and (Invoke-Api Get "/addresses" $tm $null).Status -eq 403)
$al = Invoke-Api Get "/addresses" $t3 $null
Check "addresses: list with one default first" ($al.Status -eq 200 -and @($al.Data.items).Count -ge 1 -and @($al.Data.items | Where-Object { $_.isDefault }).Count -eq 1)
Check "addresses: validation 400" ((Invoke-Api Post "/addresses" $t3 @{ street = "x"; building = "1" }).Status -eq 400 -and (Invoke-Api Post "/addresses" $t3 @{ city = "x"; street = "x"; building = "1"; postalCode = "12" }).Status -eq 400)
$st = "ZZ-reg-$tarAg"
$ca = Invoke-Api Post "/addresses" $t3 @{ city = "Test"; street = $st; building = "1" }
Check "addresses: create 201, not default" ($ca.Status -eq 201 -and ($ca.Data.item.id -is [string]) -and $ca.Data.item.isDefault -eq $false)
$newAddr = $ca.Data.item.id
Check "addresses: duplicate 409" ((Invoke-Api Post "/addresses" $t3 @{ city = "Test"; street = $st; building = "1" }).Status -eq 409)
$cb = Invoke-Api Post "/addresses" $t3 @{ city = "Test"; street = "$st-2"; building = "2"; isDefault = $true }
Check "addresses: create as default, still one default" ($cb.Status -eq 201 -and (Sql "SELECT count(*) FROM addresses WHERE user_id=$uid3 AND is_default") -eq "1")
Check "addresses: set default foreign 404, abc 400" ((Invoke-Api Post "/addresses/$newAddr/default" $t2 @{}).Status -eq 404 -and (Invoke-Api Post "/addresses/abc/default" $t3 @{}).Status -eq 400)
Check "addresses: set default 200" ((Invoke-Api Post "/addresses/$newAddr/default" $t3 @{}).Status -eq 200 -and (Sql "SELECT count(*) FROM addresses WHERE user_id=$uid3 AND is_default") -eq "1")
Check "addresses: delete foreign 404" ((Invoke-Api Delete "/addresses/$newAddr" $t2 $null).Status -eq 404)
Check "addresses: delete default 200, another default remains" ((Invoke-Api Delete "/addresses/$newAddr" $t3 $null).Status -eq 200 -and (Sql "SELECT count(*) FROM addresses WHERE user_id=$uid3 AND is_default") -eq "1")
Sql "DELETE FROM addresses WHERE street LIKE 'ZZ-reg-%'" | Out-Null
Sql "UPDATE addresses SET is_default=false WHERE user_id=$uid3" | Out-Null
if ($def3) { Sql "UPDATE addresses SET is_default=true WHERE id IN ($def3)" | Out-Null }

# ---------------------------------------------------------------- orders and payment
Section "orders and payment"
Clear-RateLimits
Invoke-Api Delete "/cart" $t2 $null | Out-Null
Check "order: empty cart 400" ((Invoke-Api Post "/orders" $t2 @{ addressId = $addr2 }).Status -eq 400)
Check "order: no token 401, manager 403" ((Invoke-Api Post "/orders" $null @{}).Status -eq 401 -and (Invoke-Api Post "/orders" $tm @{}).Status -eq 403)
Check "order: bad addressId 400" ((Invoke-Api Post "/orders" $t2 @{ addressId = "abc" }).Status -eq 400)
Make-Cart $t2 2
$cnt0 = [int](Sql "SELECT count(*) FROM orders")
Check "order: foreign address 404" ((Invoke-Api Post "/orders" $t2 @{ addressId = $addr3 }).Status -eq 404)
Check "order: rollback keeps cart and creates nothing" ([int](Sql "SELECT count(*) FROM orders") -eq $cnt0 -and @((Invoke-Api Get "/cart" $t2 $null).Data.items).Count -eq 1)
$res = Invoke-Api Post "/orders" $t2 @{ addressId = $addr2; customerComment = "reg-$tarAg" }
$o = $res.Data
$mainOrder = $o.id
Check "order: 201, status new" ($res.Status -eq 201 -and $o.status.code -eq "new")
Check "order: number format" ($o.orderNumber -match '^CN-\d{8}-\d{6}$')
Check "order: 1376 CNY, delivery 384, total 18444" ($o.subtotalCny -eq 1376 -and $o.deliveryCostRub -eq 384 -and $o.totalRub -eq 18444)
Check "order: snapshot rate 12.5 and commission 5" ($o.exchangeRate -eq 12.5 -and $o.commissionPercent -eq 5)
Check "order: address in response" ($o.address.city -and $o.address.id -eq $addr2)
Check "order: no managerComment for customer in POST response" ($o.PSObject.Properties.Name -notcontains "managerComment")
Check "order: cart emptied" (@((Invoke-Api Get "/cart" $t2 $null).Data.items).Count -eq 0)
Check "order: tariff and rate ids saved" ((Sql "SELECT delivery_tariff_id IS NOT NULL AND exchange_rate_id IS NOT NULL FROM orders WHERE id=$mainOrder") -eq "t")
Check "order: first history row has the owner" ((Sql "SELECT changed_by_user_id FROM order_status_history WHERE order_id=$mainOrder ORDER BY id LIMIT 1") -eq $uid2)
if ($had1048 -eq "1") { Check "order: ordered product left personal list" ((Sql "SELECT count(*) FROM user_products WHERE user_id=$uid2 AND product_id=1048") -eq "0") }
$g = Invoke-Api Get "/orders/$mainOrder" $t2 $null
Check "order get: address and one timeline row" ($g.Status -eq 200 -and $g.Data.address.city -and @($g.Data.timeline).Count -eq 1)
Check "order get: no managerComment, no staff ids" ($g.Data.PSObject.Properties.Name -notcontains "managerComment" -and @($g.Data.timeline | Where-Object { $_.changedBy -and ($_.changedBy.PSObject.Properties.Name -contains "id") }).Count -eq 0)
Check "order get: foreign customer 404" ((Invoke-Api Get "/orders/$mainOrder" $t3 $null).Status -eq 404)
Check "order get: missing 404, abc 400" ((Invoke-Api Get "/orders/999999999" $t2 $null).Status -eq 404 -and (Invoke-Api Get "/orders/abc" $t2 $null).Status -eq 400)
$gm = Invoke-Api Get "/orders/$mainOrder" $tm $null
Check "order get: manager sees customer contacts" ($gm.Status -eq 200 -and $gm.Data.customer.email -eq "customer2@test.local")
$ol = Invoke-Api Get "/orders?limit=5" $t2 $null
Check "order list: newest first, own only" ($ol.Status -eq 200 -and $ol.Data.items[0].id -eq $mainOrder)
Check "order list: status filter" (@((Invoke-Api Get "/orders?status=new&limit=50" $t2 $null).Data.items | Where-Object { $_.status.code -ne "new" }).Count -eq 0)
Check "order list: limit=100 gives 400, manager 403" ((Invoke-Api Get "/orders?limit=100" $t2 $null).Status -eq 400 -and (Invoke-Api Get "/orders" $tm $null).Status -eq 403)

Check "pay: no token 401, manager 403, abc 400" ((Invoke-Api Post "/orders/$mainOrder/pay" $null @{}).Status -eq 401 -and (Invoke-Api Post "/orders/$mainOrder/pay" $tm @{}).Status -eq 403 -and (Invoke-Api Post "/orders/abc/pay" $t2 @{}).Status -eq 400)
Check "pay: foreign order 404" ((Invoke-Api Post "/orders/$mainOrder/pay" $t3 @{}).Status -eq 404)
Check "pay: order still new after refusals" ((Sql "SELECT s.code FROM orders o JOIN order_statuses s ON s.id=o.status_id WHERE o.id=$mainOrder") -eq "new")
$pay = Invoke-Api Post "/orders/$mainOrder/pay" $t2 @{}
Check "pay: 200, paid, paidAt, address kept" ($pay.Status -eq 200 -and $pay.Data.status.code -eq "paid" -and $pay.Data.paidAt -and $pay.Data.address.city)
Check "pay: timeline new, awaiting_payment, paid" ((($pay.Data.timeline | ForEach-Object { $_.status.code }) -join ",") -eq "new,awaiting_payment,paid")
Check "pay: history rows carry the customer id" ((Sql "SELECT count(*) FROM order_status_history WHERE order_id=$mainOrder AND changed_by_user_id=$uid2") -eq "3")
Check "pay: one successful mock payment equal to total" ((Sql "SELECT count(*) FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.order_id=$mainOrder AND p.status='success' AND p.payment_method='mock' AND p.amount_rub=o.total_rub") -eq "1")
Check "pay: repeat 409, still one payment" ((Invoke-Api Post "/orders/$mainOrder/pay" $t2 @{}).Status -eq 409 -and (Sql "SELECT count(*) FROM payments WHERE order_id=$mainOrder") -eq "1")
Check "addresses: address used in an order cannot be deleted (409)" ((Invoke-Api Delete "/addresses/$addr2" $t2 $null).Status -eq 409 -and (Sql "SELECT count(*) FROM addresses WHERE id=$addr2") -eq "1")

Make-Cart $t2 1
$cnt1 = [int](Sql "SELECT count(*) FROM orders")
$codes = Run-Parallel 3 "Post" "/orders" $t2 @{ addressId = $addr2; customerComment = "reg-$tarAg" }
Check "double submit: exactly one 201, others 400" (@($codes | Where-Object { $_ -eq 201 }).Count -eq 1 -and @($codes | Where-Object { $_ -eq 400 }).Count -eq 2)
Check "double submit: one order created" ([int](Sql "SELECT count(*) FROM orders") -eq ($cnt1 + 1))
$o2 = New-Order $t2 $addr2 1
$codes = Run-Parallel 3 "Post" "/orders/$($o2.id)/pay" $t2 @{}
Check "parallel pay: one 200, two 409" (@($codes | Where-Object { $_ -eq 200 }).Count -eq 1 -and @($codes | Where-Object { $_ -eq 409 }).Count -eq 2)
Check "parallel pay: one payment" ((Sql "SELECT count(*) FROM payments WHERE order_id=$($o2.id)") -eq "1")

# ---------------------------------------------------------------- manager
Section "manager"
Clear-RateLimits
Refresh-Tokens
$mo = $mainOrder
Check "queue: no token 401, customer 403" ((Invoke-Api Get "/manager/orders" $null $null).Status -eq 401 -and (Invoke-Api Get "/manager/orders" $t2 $null).Status -eq 403)
$q = Invoke-Api Get "/manager/orders" $tm $null
Check "queue: 200, only queue statuses, contacts present" ($q.Status -eq 200 -and @($q.Data.items | Where-Object { $_.status.code -notin "awaiting_payment", "paid", "purchased" }).Count -eq 0 -and $q.Data.items[0].customer.email)
Check "queue: validation 400" ((Invoke-Api Get "/manager/orders?limit=100" $tm $null).Status -eq 400 -and (Invoke-Api Get "/manager/orders?status=xxx" $tm $null).Status -eq 400)
Check "queue: admin allowed" ((Invoke-Api Get "/manager/orders" $ta $null).Status -eq 200)
Check "status: no token 401, customer 403" ((Set-Status $null $mo "purchased" $null).Status -eq 401 -and (Set-Status $t2 $mo "purchased" $null).Status -eq 403)
Check "status: missing 404, abc 400, unknown 400" ((Set-Status $tm 999999999 "purchased" $null).Status -eq 404 -and (Invoke-Api Patch "/manager/orders/abc/status" $tm @{ status = "purchased" }).Status -eq 400 -and (Set-Status $tm $mo "xxx" $null).Status -eq 400)
Check "status: manual paid and new rejected 409" ((Set-Status $tm $mo "paid" $null).Status -eq 409 -and (Set-Status $tm $mo "new" $null).Status -eq 409)
Check "status: skipping stages rejected 409" ((Set-Status $tm $mo "delivered" $null).Status -eq 409)
Check "shipment: not allowed for paid order 409" ((Invoke-Api Patch "/manager/orders/$mo/shipment" $tm @{ weightKg = 0.3 }).Status -eq 409)
$r = Set-Status $tm $mo "purchased" "reg-note"
Check "status: purchased 200" ($r.Status -eq 200 -and $r.Data.status.code -eq "purchased")
Check "status: history has manager id and comment" ((Sql "SELECT changed_by_user_id || '|' || comment FROM order_status_history WHERE order_id=$mo ORDER BY id DESC LIMIT 1") -eq "$uidM|reg-note")
Check "status: same status again 409" ((Set-Status $tm $mo "purchased" $null).Status -eq 409)

$tot0 = Sql "SELECT total_rub FROM orders WHERE id=$mo"
Check "shipment: no token 401, customer 403" ((Invoke-Api Patch "/manager/orders/$mo/shipment" $null @{ weightKg = 1 }).Status -eq 401 -and (Invoke-Api Patch "/manager/orders/$mo/shipment" $t2 @{ weightKg = 1 }).Status -eq 403)
Check "shipment: empty body, bad carrier, negative weight 400" ((Invoke-Api Patch "/manager/orders/$mo/shipment" $tm @{}).Status -eq 400 -and (Invoke-Api Patch "/manager/orders/$mo/shipment" $tm @{ carrier = "xxx" }).Status -eq 400 -and (Invoke-Api Patch "/manager/orders/$mo/shipment" $tm @{ weightKg = -1 }).Status -eq 400)
Check "shipment: nothing saved after refusals" ((Sql "SELECT count(*) FROM shipments WHERE order_id=$mo") -eq "0")
$sh = Invoke-Api Patch "/manager/orders/$mo/shipment" $tm @{ trackingNumber = "REG$tarAg"; carrier = "cdek"; weightKg = 0.3 }
Check "shipment: created" ($sh.Status -eq 200 -and $sh.Data.shipment.trackingNumber -eq "REG$tarAg")
Check "shipment: declared value equals subtotal" ((Sql "SELECT count(*) FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.order_id=$mo AND s.declared_value_cny=o.subtotal_cny") -eq "1")
Check "shipment: partial update by admin keeps tracking" ((Invoke-Api Patch "/manager/orders/$mo/shipment" $ta @{ weightKg = 0.4 }).Status -eq 200 -and (Sql "SELECT tracking_number FROM shipments WHERE order_id=$mo") -eq "REG$tarAg" -and (Sql "SELECT count(*) FROM shipments WHERE order_id=$mo") -eq "1")
Check "shipment: actual weight does not change order total" ((Sql "SELECT total_rub FROM orders WHERE id=$mo") -eq $tot0)
Check "shipment: customer sees tracking" ((Invoke-Api Get "/orders/$mo" $t2 $null).Data.shipment.trackingNumber -eq "REG$tarAg")
Check "comment: customer 403, too long 400, missing 404" ((Invoke-Api Patch "/manager/orders/$mo/comment" $t2 @{ comment = "x" }).Status -eq 403 -and (Invoke-Api Patch "/manager/orders/$mo/comment" $tm @{ comment = ("a" * 2001) }).Status -eq 400 -and (Invoke-Api Patch "/manager/orders/999999999/comment" $tm @{ comment = "x" }).Status -eq 404)
Check "comment: saved, visible to staff only" ((Invoke-Api Patch "/manager/orders/$mo/comment" $tm @{ comment = "note-$tarAg" }).Status -eq 200 -and (Invoke-Api Get "/orders/$mo" $tm $null).Data.managerComment -eq "note-$tarAg" -and (Invoke-Api Get "/orders/$mo" $t2 $null).Data.PSObject.Properties.Name -notcontains "managerComment")

Check "chain: shipped_from_china" ((Set-Status $tm $mo "shipped_from_china" $null).Status -eq 200)
Check "chain: in_transit by admin" ((Set-Status $ta $mo "in_transit" $null).Status -eq 200)
Check "chain: arrived_warehouse" ((Set-Status $tm $mo "arrived_warehouse" $null).Status -eq 200)
$dl = Set-Status $tm $mo "delivered" $null
Check "chain: delivered, completed_at set" ($dl.Status -eq 200 -and (Sql "SELECT completed_at IS NOT NULL FROM orders WHERE id=$mo") -eq "t")
Check "chain: 8 history rows, no change after delivery" ((Sql "SELECT count(*) FROM order_status_history WHERE order_id=$mo") -eq "8" -and (Set-Status $tm $mo "cancelled" "x").Status -eq 409)

$co = New-PaidOrder $t2 $addr2
Check "cancel: without reason 400, order still paid" ((Set-Status $tm $co "cancelled" $null).Status -eq 400 -and (Sql "SELECT s.code FROM orders o JOIN order_statuses s ON s.id=o.status_id WHERE o.id=$co") -eq "paid")
Check "cancel: with reason 200, cancelled_at, reason in history" ((Set-Status $tm $co "cancelled" "reg-cancel").Status -eq 200 -and (Sql "SELECT cancelled_at IS NOT NULL FROM orders WHERE id=$co") -eq "t" -and (Sql "SELECT comment FROM order_status_history WHERE order_id=$co ORDER BY id DESC LIMIT 1") -eq "reg-cancel")
Check "cancel: no further changes, no shipment" ((Set-Status $tm $co "purchased" $null).Status -eq 409 -and (Invoke-Api Patch "/manager/orders/$co/shipment" $tm @{ weightKg = 1 }).Status -eq 409)

# ---------------------------------------------------------------- admin
Section "admin: access"
Clear-RateLimits
Refresh-Tokens
foreach ($p in "/admin/rates", "/admin/rates/current", "/admin/settings/commission", "/admin/tariffs", "/admin/users", "/admin/stats", "/admin/access") {
  Check "admin $p : 401 without token, 403 for customer and manager" ((Invoke-Api Get $p $null $null).Status -eq 401 -and (Invoke-Api Get $p $t2 $null).Status -eq 403 -and (Invoke-Api Get $p $tm $null).Status -eq 403)
}

Section "admin: rate and commission"
$cnt = [int](Sql "SELECT count(*) FROM exchange_rates")
foreach ($bad in 0, -1, 1001) { Check "rate $bad rejected 400" ((Invoke-Api Post "/admin/rates" $ta @{ rate = $bad }).Status -eq 400) }
Check "rate abc rejected 400" ((Invoke-Api Post "/admin/rates" $ta @{ rate = "abc" }).Status -eq 400)
Check "rate: nothing added after bad requests" ([int](Sql "SELECT count(*) FROM exchange_rates") -eq $cnt)
$lst = Invoke-Api Get "/admin/rates?limit=2" $ta $null
Check "rates list: pagination, limit=101 gives 400" ($lst.Status -eq 200 -and @($lst.Data.items).Count -le 2 -and $lst.Data.total -ge 1 -and (Invoke-Api Get "/admin/rates?limit=101" $ta $null).Status -eq 400)
$r13 = Invoke-Api Post "/admin/rates" $ta @{ rate = 13 }
Check "rate 13: 201, active, manual" ($r13.Status -eq 201 -and $r13.Data.rate -eq 13 -and $r13.Data.isActive -eq $true -and $r13.Data.source -eq "manual")
Check "rate 13: one active row, old rows closed" ((Sql "SELECT count(*) FROM exchange_rates WHERE base_currency='CNY' AND target_currency='RUB' AND is_active") -eq "1" -and (Sql "SELECT count(*) FROM exchange_rates WHERE NOT is_active AND valid_until IS NULL") -eq "0")
Check "rate 13: current" ((Invoke-Api Get "/admin/rates/current" $ta $null).Data.rate -eq 13)
$gOld = Invoke-Api Get "/orders/$mainOrder" $t2 $null
Check "snapshot: old order keeps rate 12.5 and total 18444" ($gOld.Data.exchangeRate -eq 12.5 -and $gOld.Data.totalRub -eq 18444)
Make-Cart $t2 1
Check "cart uses new rate (9391.20)" ([math]::Abs((Invoke-Api Get "/cart" $t2 $null).Data.totals.itemsRub - 9391.2) -lt 0.01)
Redis-Cli SET cache:exchange_rate:current 99 | Out-Null
$o99 = New-Order $t2 $addr2 1
Check "order ignores cached rate, uses DB rate 13" ($o99.exchangeRate -eq 13)
Invoke-Api Post "/admin/rates" $ta @{ rate = 13 } | Out-Null
Check "cache: dropped after rate change" ("$(Redis-Cli EXISTS cache:exchange_rate:current)".Trim() -eq "0")
$codes = Run-Parallel 5 "Post" "/admin/rates" $ta @{ rate = 14 }
Check "parallel rate changes: all 201, one active row" (@($codes | Where-Object { $_ -eq 201 }).Count -eq 5 -and (Sql "SELECT count(*) FROM exchange_rates WHERE base_currency='CNY' AND target_currency='RUB' AND is_active") -eq "1")
Check "rate restored to 12.5" ((Invoke-Api Post "/admin/rates" $ta @{ rate = 12.5 }).Status -eq 201 -and (Invoke-Api Get "/admin/rates/current" $ta $null).Data.rate -eq 12.5)
Check "commission: get 5" ((Invoke-Api Get "/admin/settings/commission" $ta $null).Data.commissionPercent -eq 5)
Check "commission: -1, 101, abc, 5.123 rejected 400" ((Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = -1 }).Status -eq 400 -and (Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = 101 }).Status -eq 400 -and (Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = "abc" }).Status -eq 400 -and (Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = 5.123 }).Status -eq 400)
Check "commission: unchanged after refusals" ((Sql "SELECT value FROM settings WHERE key='default_commission_percent'") -eq "5")
Check "commission 7.5 saved" ((Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = 7.5 }).Data.commissionPercent -eq 7.5)
Make-Cart $t2 1
Check "cart uses commission 7.5 (9245)" ((Invoke-Api Get "/cart" $t2 $null).Data.totals.itemsRub -eq 9245)
Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = 5 } | Out-Null
Invoke-Api Delete "/cart" $t2 $null | Out-Null

Section "admin: tariffs"
$tl = Invoke-Api Get "/admin/tariffs" $ta $null
Check "tariffs: seed list, last without upper bound" ($tl.Status -eq 200 -and @($tl.Data).Count -ge 3 -and $null -eq (@($tl.Data) | Where-Object { $_.id -eq "3" }).maxWeightKg)
Check "tariffs: max <= min and negative price rejected 400" ((New-Tariff "ZZ reg M $tarAg" 10 5 $false).Status -eq 400 -and (Invoke-Api Post "/admin/tariffs" $ta @{ name = "ZZ reg N $tarAg"; minWeightKg = 3000; maxWeightKg = 4000; baseCostRub = -1; perKgCostRub = 1; minDays = 1; maxDays = 2 }).Status -eq 400)
Check "tariffs: open-ended seed tariff blocks overlap 409" ((New-Tariff "ZZ reg X $tarAg" 3000 4000 $true).Status -eq 409)
Check "tariffs: seed tariff 3 limited to 1000" ((Invoke-Api Patch "/admin/tariffs/3" $ta @{ maxWeightKg = 1000 }).Status -eq 200)
$tarA = New-Tariff "ZZ reg A $tarAg" 3000 4000 $true
Check "tariffs: create 201" ($tarA.Status -eq 201 -and ($tarA.Data.id -is [string]))
Check "tariffs: duplicate name 409" ((New-Tariff "ZZ reg A $tarAg" 6000 7000 $false).Status -eq 409)
Check "tariffs: overlap 409" ((New-Tariff "ZZ reg B $tarAg" 3500 3600 $true).Status -eq 409)
$tarC = New-Tariff "ZZ reg C $tarAg" 4000 5000 $true
Check "tariffs: adjacent interval allowed, boundary 4000 belongs to it" ($tarC.Status -eq 201 -and (Sql "SELECT fn_find_delivery_tariff(4000)") -eq $tarC.Data.id)
$tarD = New-Tariff "ZZ reg D $tarAg" 3500 3600 $false
Check "tariffs: inactive overlapping tariff created" ($tarD.Status -eq 201)
Check "tariffs: activating overlapping 409, stays inactive" ((Invoke-Api Patch "/admin/tariffs/$($tarD.Data.id)" $ta @{ isActive = $true }).Status -eq 409 -and (Sql "SELECT is_active FROM delivery_tariffs WHERE id=$($tarD.Data.id)") -eq "f")
Check "tariffs: partial patch keeps other fields" ((Invoke-Api Patch "/admin/tariffs/$($tarA.Data.id)" $ta @{ baseCostRub = 77 }).Status -eq 200 -and (Sql "SELECT base_cost_rub || '/' || per_kg_cost_rub FROM delivery_tariffs WHERE id=$($tarA.Data.id)") -eq "77.00/1.00")
Check "tariffs: patch validation (max<min 400, abc 400, missing 404, empty 400)" ((Invoke-Api Patch "/admin/tariffs/$($tarA.Data.id)" $ta @{ maxWeightKg = 100 }).Status -eq 400 -and (Invoke-Api Patch "/admin/tariffs/abc" $ta @{ baseCostRub = 1 }).Status -eq 400 -and (Invoke-Api Patch "/admin/tariffs/999999" $ta @{ baseCostRub = 1 }).Status -eq 404 -and (Invoke-Api Patch "/admin/tariffs/$($tarA.Data.id)" $ta @{}).Status -eq 400)
Check "tariffs: no delete route" ((Invoke-Api Delete "/admin/tariffs/$($tarA.Data.id)" $ta $null).Status -in 404, 405)
Make-Cart $t2 1
Check "tariffs: changed base price reaches cart (442)" ((Invoke-Api Patch "/admin/tariffs/1" $ta @{ baseCostRub = 400 }).Status -eq 200 -and (Invoke-Api Get "/cart" $t2 $null).Data.totals.deliveryRub -eq 442)
Invoke-Api Patch "/admin/tariffs/1" $ta @{ baseCostRub = 300 } | Out-Null
Invoke-Api Patch "/admin/tariffs/1" $ta @{ isActive = $false } | Out-Null
Check "tariffs: cart without suitable tariff gives 422" ((Invoke-Api Get "/cart" $t2 $null).Status -eq 422)
Sql "UPDATE delivery_tariffs SET is_active=true WHERE id IN (1,2,3)" | Out-Null
Invoke-Api Delete "/cart" $t2 $null | Out-Null
Sql "DELETE FROM delivery_tariffs WHERE name LIKE 'ZZ reg%'" | Out-Null
Sql "UPDATE delivery_tariffs SET max_weight_kg=NULL WHERE id=3" | Out-Null

Section "admin: users and main administrator"
$ul = Invoke-Api Get "/admin/users?limit=3" $ta $null
Check "users: list with fields" ($ul.Status -eq 200 -and @($ul.Data.items).Count -le 3 -and $ul.Data.items[0].fullName -and $ul.Data.items[0].role -and $null -ne $ul.Data.items[0].ordersCount)
Check "users: no password or hash in response" (($ul.Json | ConvertTo-Json -Depth 8) -notmatch "password|hash")
Check "users: limit=101 and role=xxx give 400" ((Invoke-Api Get "/admin/users?limit=101" $ta $null).Status -eq 400 -and (Invoke-Api Get "/admin/users?role=xxx" $ta $null).Status -eq 400)
Check "users: role filter and total match DB" ([string](Invoke-Api Get "/admin/users?role=customer" $ta $null).Data.total -eq (Sql "SELECT count(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='customer'"))
Check "users: search q=% is literal" ([string](Invoke-Api Get "/admin/users?q=%25" $ta $null).Data.total -eq (Sql "SELECT count(*) FROM users WHERE position('%' in email)>0 OR position('%' in full_name)>0"))
$acc = Invoke-Api Get "/admin/access" $ta $null
Check "main admin: admin@ is the only main administrator" ($acc.Data.isSuperAdmin -eq $true -and $acc.Data.superAdminId -eq $uidA -and (Sql "SELECT count(*) FROM users WHERE is_super_admin") -eq "1")
Check "users: patch validation (abc 400, missing 404, empty 400, bad role 400)" ((Invoke-Api Patch "/admin/users/abc" $ta @{ isActive = $false }).Status -eq 400 -and (Invoke-Api Patch "/admin/users/999999999" $ta @{ isActive = $false }).Status -eq 404 -and (Invoke-Api Patch "/admin/users/$uid3" $ta @{}).Status -eq 400 -and (Invoke-Api Patch "/admin/users/$uid3" $ta @{ role = "xxx" }).Status -eq 400)
Check "users: administrator cannot change self (409)" ((Invoke-Api Patch "/admin/users/$uidA" $ta @{ role = "customer" }).Status -eq 409 -and (Invoke-Api Patch "/admin/users/$uidA" $ta @{ isActive = $false }).Status -eq 409)
Check "users: main admin promotes customer3 to admin" ((Invoke-Api Patch "/admin/users/$uid3" $ta @{ role = "admin" }).Data.role -eq "admin")
$t3a = Get-Tok "customer3@test.local"
Check "second admin: not main, can open list" ((Invoke-Api Get "/admin/access" $t3a $null).Data.isSuperAdmin -eq $false -and (Invoke-Api Get "/admin/users?limit=1" $t3a $null).Status -eq 200)
Check "second admin: cannot appoint admins (403)" ((Invoke-Api Patch "/admin/users/$uid2" $t3a @{ role = "admin" }).Status -eq 403 -and (Role-Of $uid2) -eq "customer/true")
Check "second admin: cannot touch the main admin (403)" ((Invoke-Api Patch "/admin/users/$uidA" $t3a @{ role = "customer" }).Status -eq 403 -and (Invoke-Api Patch "/admin/users/$uidA" $t3a @{ isActive = $false }).Status -eq 403 -and (Role-Of $uidA) -eq "admin/true")
Check "second admin: manages managers (role, block, unblock)" ((Invoke-Api Patch "/admin/users/$uid2" $t3a @{ role = "manager" }).Status -eq 200 -and (Invoke-Api Patch "/admin/users/$uid2" $t3a @{ isActive = $false }).Status -eq 200 -and (Invoke-Api Patch "/admin/users/$uid2" $t3a @{ isActive = $true }).Status -eq 200)
Sql "UPDATE users SET role_id=(SELECT id FROM roles WHERE name='admin') WHERE id=$uid2" | Out-Null
Check "second admin: cannot demote or block another admin (403)" ((Invoke-Api Patch "/admin/users/$uid2" $t3a @{ role = "customer" }).Status -eq 403 -and (Invoke-Api Patch "/admin/users/$uid2" $t3a @{ isActive = $false }).Status -eq 403 -and (Role-Of $uid2) -eq "admin/true")
Check "main admin demotes both admins back" ((Invoke-Api Patch "/admin/users/$uid2" $ta @{ role = "customer" }).Status -eq 200 -and (Invoke-Api Patch "/admin/users/$uid3" $ta @{ role = "customer" }).Status -eq 200)
$bl = Invoke-Api Patch "/admin/users/$uid3" $ta @{ isActive = $false }
Check "block: 200 and blocked user cannot log in" ($bl.Status -eq 200 -and (Invoke-Api Post "/auth/login" $null @{ email = "customer3@test.local"; password = "Test1234!" }).Status -eq 403)
Check "unblock: login works again" ((Invoke-Api Patch "/admin/users/$uid3" $ta @{ isActive = $true }).Status -eq 200 -and (Invoke-Api Post "/auth/login" $null @{ email = "customer3@test.local"; password = "Test1234!" }).Status -eq 200)
Sql "UPDATE users SET role_id=(SELECT id FROM roles WHERE name='customer'), is_active=true WHERE id IN ($uid2,$uid3)" | Out-Null
Sql "UPDATE users SET is_super_admin=true WHERE email='manager@test.local'" | Out-Null
Check "db: second main administrator rejected by unique index" ((Sql "SELECT count(*) FROM users WHERE is_super_admin") -eq "1")

Section "admin: statistics"
Refresh-Tokens
$today = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$d29 = (Get-Date).ToUniversalTime().AddDays(-29).ToString("yyyy-MM-dd")
$d400 = (Get-Date).ToUniversalTime().AddDays(-400).ToString("yyyy-MM-dd")
$st = Invoke-Api Get "/admin/stats" $ta $null
Check "stats: default period is last 30 days" ($st.Status -eq 200 -and $st.Data.period.from -eq $d29 -and $st.Data.period.to -eq $today -and @($st.Data.byDay).Count -eq 30)
Check "stats: byStatus lists every status and sums to total" (@($st.Data.orders.byStatus).Count -eq [int](Sql "SELECT count(*) FROM order_statuses") -and (($st.Data.orders.byStatus | Measure-Object -Property count -Sum).Sum) -eq $st.Data.orders.total)
Check "stats: users block matches DB" ($st.Data.users.total -eq [int](Sql "SELECT count(*) FROM users") -and $st.Data.users.active -eq [int](Sql "SELECT count(*) FROM users WHERE is_active"))
$revDb = [double](Sql "SELECT COALESCE(sum(o.total_rub),0) FROM orders o JOIN order_statuses s ON s.id=o.status_id WHERE o.paid_at >= '$d29 00:00:00+00'::timestamptz AND o.paid_at < ('$today 00:00:00+00'::timestamptz + interval '1 day') AND s.code <> 'cancelled'")
Check "stats: revenue matches DB" ([math]::Abs($st.Data.revenue.totalRub - $revDb) -lt 0.01)
Check "stats: byDay revenue sums to total" ([math]::Abs((($st.Data.byDay | Measure-Object -Property revenueRub -Sum).Sum) - $st.Data.revenue.totalRub) -lt 0.01)
Check "stats: bad periods and dates give 400" ((Invoke-Api Get "/admin/stats?from=$today&to=$d29" $ta $null).Status -eq 400 -and (Invoke-Api Get "/admin/stats?from=$d400&to=$today" $ta $null).Status -eq 400 -and (Invoke-Api Get "/admin/stats?from=abc" $ta $null).Status -eq 400 -and (Invoke-Api Get "/admin/stats?from=2026-13-45&to=$today" $ta $null).Status -eq 400)
$se = Invoke-Api Get "/admin/stats?from=2030-01-01&to=2030-01-03" $ta $null
Check "stats: empty period gives zeros and 3 days" ($se.Data.orders.total -eq 0 -and $se.Data.revenue.totalRub -eq 0 -and $se.Data.revenue.averageOrderRub -eq 0 -and @($se.Data.byDay).Count -eq 3)
$sb = (Invoke-Api Get "/admin/stats?from=$today&to=$today" $ta $null).Data
$po = New-PaidOrder $t2 $addr2
$po_total = [double](Sql "SELECT total_rub FROM orders WHERE id=$po")
$sa = (Invoke-Api Get "/admin/stats?from=$today&to=$today" $ta $null).Data
Check "stats: paid order adds its total to revenue" ([math]::Abs(($sa.revenue.totalRub - $sb.revenue.totalRub) - $po_total) -lt 0.01 -and $sa.revenue.paidOrdersCount -eq ($sb.revenue.paidOrdersCount + 1))
Set-Status $tm $po "cancelled" "reg-stats" | Out-Null
Check "stats: cancelled order leaves revenue" ([math]::Abs((Invoke-Api Get "/admin/stats?from=$today&to=$today" $ta $null).Data.revenue.totalRub - $sb.revenue.totalRub) -lt 0.01)

# ---------------------------------------------------------------- profile
Section "profile"
Refresh-Tokens
$pm = "zz-reg-$tarAg@test.local"; $p1 = "Start1234!"; $p2 = "Other5678!"
Check "profile: register" ((Invoke-Api Post "/auth/register" $null @{ email = $pm; password = $p1; fullName = "ZZ Reg" }).Status -in 200, 201)
$ps = New-Session
$pl = Invoke-Api Post "/auth/login" $null @{ email = $pm; password = $p1 } $ps
$pt = $pl.Data.accessToken
Check "profile: login and refresh work" ($pt -and (Invoke-Api Post "/auth/refresh" $null $null $ps).Status -eq 200)
Check "profile: no token 401, empty body 400, empty name 400, bad phone 400" ((Invoke-Api Patch "/profile" $null @{ fullName = "X" }).Status -eq 401 -and (Invoke-Api Patch "/profile" $pt @{}).Status -eq 400 -and (Invoke-Api Patch "/profile" $pt @{ fullName = "" }).Status -eq 400 -and (Invoke-Api Patch "/profile" $pt @{ phone = "abc" }).Status -eq 400)
$rn = Invoke-Api Patch "/profile" $pt @{ fullName = "ZZ Renamed" }
Check "profile: rename visible in /auth/me" ($rn.Status -eq 200 -and (Invoke-Api Get "/auth/me" $pt $null).Data.user.fullName -eq "ZZ Renamed")
$ph = Invoke-Api Patch "/profile" $pt @{ phone = "+7 900 000 00 00" }
Check "profile: phone saved, name kept" ($ph.Status -eq 200 -and $ph.Data.phone -eq "+7 900 000 00 00" -and $ph.Data.fullName -eq "ZZ Renamed")
Check "profile: empty phone becomes NULL" ((Invoke-Api Patch "/profile" $pt @{ phone = "" }).Status -eq 200 -and (Sql "SELECT phone IS NULL FROM users WHERE email='$pm'") -eq "t")
Check "password: no token 401, wrong current 400, short 400, same 400" ((Invoke-Api Post "/profile/password" $null @{ currentPassword = $p1; newPassword = $p2 }).Status -eq 401 -and (Invoke-Api Post "/profile/password" $pt @{ currentPassword = "Wrong0000!"; newPassword = $p2 }).Status -eq 400 -and (Invoke-Api Post "/profile/password" $pt @{ currentPassword = $p1; newPassword = "short" }).Status -eq 400 -and (Invoke-Api Post "/profile/password" $pt @{ currentPassword = $p1; newPassword = $p1 }).Status -eq 400)
Check "password: old password still works after refusals" ((Invoke-Api Post "/auth/login" $null @{ email = $pm; password = $p1 }).Status -eq 200)
Check "password: change 200" ((Invoke-Api Post "/profile/password" $pt @{ currentPassword = $p1; newPassword = $p2 }).Status -eq 200)
Check "password: old login rejected, new login works" ((Invoke-Api Post "/auth/login" $null @{ email = $pm; password = $p1 }).Status -eq 401 -and (Invoke-Api Post "/auth/login" $null @{ email = $pm; password = $p2 }).Status -eq 200)
Check "password: old session revoked" ((Invoke-Api Post "/auth/refresh" $null $null $ps).Status -in 401, 403)
Check "password: stored as hash" ((Sql "SELECT password_hash <> '$p2' AND length(password_hash) >= 50 FROM users WHERE email='$pm'") -eq "t")

# ---------------------------------------------------------------- rate limit
Section "rate limit"
Clear-RateLimits
$codes = 1..25 | ForEach-Object { (Invoke-Api Post "/auth/login" $null @{ email = "nobody@test.local"; password = "x" }).Status }
Check "login limit: first attempts are 401" ($codes[0] -eq 401)
Check "login limit: 429 appears" ($codes -contains 429)
Check "login limit: backend alive afterwards" ((Invoke-Api Get "/health" $null $null).Status -eq 200)
Clear-RateLimits

# ---------------------------------------------------------------- cleanup
Section "cleanup and restore"
Refresh-Tokens
Sql "DELETE FROM orders WHERE customer_comment = 'reg-$tarAg'" | Out-Null
Sql "DELETE FROM products WHERE external_id='$tarAg' OR name='ZZ reg $tarAg'" | Out-Null
Sql "DELETE FROM addresses WHERE street LIKE 'ZZ-reg-%'" | Out-Null
Sql "DELETE FROM delivery_tariffs WHERE name LIKE 'ZZ reg%'" | Out-Null
Sql "UPDATE delivery_tariffs SET max_weight_kg=NULL WHERE id=3" | Out-Null
Sql "UPDATE delivery_tariffs SET is_active=true WHERE id IN (1,2,3)" | Out-Null
Sql "DELETE FROM users WHERE email LIKE 'zz-reg-%'" | Out-Null
Sql "UPDATE users SET role_id=(SELECT id FROM roles WHERE name='customer'), is_active=true WHERE id IN ($uid2,$uid3)" | Out-Null
$cur = Invoke-Api Get "/admin/rates/current" $ta $null
if ([math]::Abs([double]$cur.Data.rate - $rate0) -gt 0.0000001) { Invoke-Api Post "/admin/rates" $ta @{ rate = $rate0 } | Out-Null }
Invoke-Api Put "/admin/settings/commission" $ta @{ commissionPercent = $comm0 } | Out-Null
Sql "DELETE FROM user_products up WHERE NOT EXISTS (SELECT 1 FROM zz_up_backup b WHERE b.user_id=up.user_id AND b.product_id=up.product_id)" | Out-Null
Sql "INSERT INTO user_products SELECT * FROM zz_up_backup ON CONFLICT DO NOTHING" | Out-Null
Sql "DROP TABLE IF EXISTS zz_up_backup" | Out-Null
Clear-RateLimits
Invoke-Api Delete "/cart" $t2 $null | Out-Null
Check "restored: rate and commission" ([math]::Abs([double](Invoke-Api Get "/admin/rates/current" $ta $null).Data.rate - $rate0) -lt 0.0000001 -and (Invoke-Api Get "/admin/settings/commission" $ta $null).Data.commissionPercent -eq $comm0)
Check "restored: tariffs 1..3 active, tariff 3 unbounded" ((Sql "SELECT count(*) FROM delivery_tariffs WHERE id IN (1,2,3) AND is_active") -eq "3" -and (Sql "SELECT max_weight_kg IS NULL FROM delivery_tariffs WHERE id=3") -eq "t")
Check "restored: personal lists identical" ((Sql "SELECT count(*) FROM user_products") -eq $links0)
Check "restored: no test data left" ((Sql "SELECT (SELECT count(*) FROM orders WHERE customer_comment LIKE 'reg-%') + (SELECT count(*) FROM users WHERE email LIKE 'zz-reg-%') + (SELECT count(*) FROM products WHERE name LIKE 'ZZ reg%')") -eq "0")

# ---------------------------------------------------------------- summary
$elapsed = [int]((Get-Date) - $started).TotalSeconds
$summary = "TOTAL: OK=$script:ok FAIL=$script:fail  (seconds: $elapsed)"
Write-Host ""; Write-Host $summary -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Red" })
if ($script:fail -gt 0) { Write-Host "--- FAILED:"; $script:failed | ForEach-Object { Write-Host "  $_" } }
New-Item -ItemType Directory -Force docs | Out-Null
$header = @("china-orders regression test", "date: $((Get-Date).ToString('yyyy-MM-dd HH:mm'))", $summary)
($header + $script:lines) | Set-Content -Path "docs\regression-result.txt" -Encoding UTF8
if ($script:fail -gt 0) { exit 1 } else { exit 0 }