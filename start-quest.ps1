# Starts the local app + a Cloudflare HTTPS tunnel, then writes quest.local.html.
# Keep this window open while using the Quest.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Wait-Health {
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $r = Invoke-WebRequest -Uri http://localhost:8080/api/health -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { return }
    } catch {}
    Start-Sleep -Seconds 1
  }
  throw '本地服务 http://localhost:8080 没有起来。'
}

try {
  Invoke-WebRequest -Uri http://localhost:8080/api/health -UseBasicParsing -TimeoutSec 2 | Out-Null
} catch {
  Write-Host 'Starting npm start...'
  Start-Process -FilePath 'npm' -ArgumentList 'start' -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
  Wait-Health
}

Write-Host 'Starting Cloudflare tunnel... keep this window open.'
$log = Join-Path $PSScriptRoot 'cloudflared.local.log'
if (Test-Path $log) { Remove-Item $log -Force }
$proc = Start-Process -FilePath 'cloudflared' -ArgumentList 'tunnel --url http://localhost:8080' -RedirectStandardOutput $log -RedirectStandardError $log -PassThru -NoNewWindow

$url = $null
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $text = Get-Content $log -Raw -ErrorAction SilentlyContinue
    if ($text -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
      $url = $Matches[0]
      break
    }
  }
  if ($proc.HasExited) { throw "cloudflared exited early. See $log" }
}
if (-not $url) { throw "没有拿到隧道地址。See $log" }

$encoded = [uri]::EscapeDataString($url)
$html = @"
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Quest 打开这个</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: "Segoe UI", sans-serif; background: #10140f; color: #eaf0df; }
    main { text-align: center; padding: 32px 20px; max-width: 640px; }
    img { width: 280px; height: 280px; background: #fff; padding: 12px; border-radius: 16px; }
    a { display: inline-block; margin-top: 18px; color: #d7ecc0; font-size: 22px; word-break: break-all; }
    ol { text-align: left; line-height: 1.7; color: #cdd8c2; }
  </style>
</head>
<body>
  <main>
    <h1>用头显浏览器打开这个地址</h1>
    <img alt="Quest URL QR" src="https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=$encoded">
    <p><a href="$url">$url</a></p>
    <ol>
      <li>戴上 Quest，打开 Browser</li>
      <li>输入上面的地址，或手机扫码后发到头显</li>
      <li>点「进入 MR」</li>
    </ol>
  </main>
</body>
</html>
"@
Set-Content -Path (Join-Path $PSScriptRoot 'quest.local.html') -Value $html -Encoding UTF8
Start-Process (Join-Path $PSScriptRoot 'quest.local.html')
Write-Host ""
Write-Host "Quest URL: $url"
Write-Host "Keep this window open. Close it when you are done with the headset."
Wait-Process -Id $proc.Id
