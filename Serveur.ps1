[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$global:listener = New-Object System.Net.HttpListener
$global:listener.Prefixes.Add("http://localhost:8080/")
$global:listener.Start()

Write-Host "======================================================="
Write-Host "    TC LA CIOTAT - Serveur du Tournoi de Tennis"
Write-Host "======================================================="
Write-Host ""
Write-Host "Le site est accessible a l'adresse : http://localhost:8080/"
Write-Host "Ne fermez pas cette fenetre pendant que vous utilisez l'application."
Write-Host ""
Write-Host "Appuyez sur CTRL+C pour arreter le serveur."
Write-Host ""

try {
    while ($global:listener.IsListening) {
        $context = $global:listener.GetContext()
        $response = $context.Response
        $request = $context.Request
        
        $path = $request.Url.LocalPath
        
        $response.AppendHeader("Access-Control-Allow-Origin", "*")
        
        if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }
        
        $localPath = Join-Path -Path $PSScriptRoot -ChildPath ($path.Trim('/'))
        
        if (Test-Path $localPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                default { "application/octet-stream" }
            }
            $response.ContentType = $contentType
            
            try {
                $bytes = [System.IO.File]::ReadAllBytes($localPath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
            }
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $global:listener.Stop()
}
