param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'application/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.png' = 'image/png'
  '.gif' = 'image/gif'
  '.svg' = 'image/svg+xml'
  '.mp3' = 'audio/mpeg'
  '.txt' = 'text/plain; charset=utf-8'
  '.ico' = 'image/x-icon'
}
# TCP local direto: dispensa Python, Node e reservacao de URLACL no Windows.
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
  $listener.Start()
} catch {
  Write-Host "A porta $Port ja esta ocupada. Feche o servidor SELIC antigo e tente novamente." -ForegroundColor Red
  Read-Host 'Pressione ENTER para sair'
  exit 1
}
Write-Host "SELIC integrado em http://localhost:$Port" -ForegroundColor Green
Write-Host 'Mantenha esta janela aberta. Para finalizar, feche a janela.' -ForegroundColor Yellow
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 12000
      $client.SendTimeout = 12000
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 2048, $true)
      $line = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($line)) { continue }
      $tokens = $line.Split(' ')
      if ($tokens.Length -lt 2 -or $tokens[0] -ne 'GET') { continue }
      while ($true) {
        $header = $reader.ReadLine()
        if ($null -eq $header -or $header -eq '') { break }
      }
      $rawPath = ($tokens[1] -split '\?',2)[0]
      $urlPath = [System.Uri]::UnescapeDataString($rawPath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = 'index.html' }
      $filename = [System.IO.Path]::GetFullPath((Join-Path $root ($urlPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
      $valid = $filename.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
      if ($valid -and [System.IO.File]::Exists($filename)) {
        $contents = [System.IO.File]::ReadAllBytes($filename)
        $ext = [System.IO.Path]::GetExtension($filename).ToLowerInvariant()
        $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $status = '200 OK'
      } else {
        $contents = [System.Text.Encoding]::UTF8.GetBytes('Arquivo nao encontrado')
        $type = 'text/plain; charset=utf-8'
        $status = '404 Not Found'
      }
      $response = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($contents.Length)`r`nConnection: close`r`nCache-Control: no-cache, no-store, must-revalidate`r`nX-Content-Type-Options: nosniff`r`n`r`n"
      $head = [System.Text.Encoding]::ASCII.GetBytes($response)
      $stream.Write($head, 0, $head.Length)
      $stream.Write($contents, 0, $contents.Length)
      $stream.Flush()
    } catch {
      Write-Host "Requisicao ignorada: $($_.Exception.Message)" -ForegroundColor DarkYellow
    } finally {
      if ($reader) { $reader.Dispose(); $reader = $null }
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
