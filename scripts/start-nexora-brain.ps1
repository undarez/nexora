param(
  [string]$Model = "SandLogicTechnologies/Qwen3.5-4B-GGUF:Q4_K_M",
  [int]$Port = 8080,
  [int]$Context = 16384
)

$ErrorActionPreference = "Stop"

$server = Get-Command llama-server.exe -ErrorAction SilentlyContinue
if (-not $server) {
  $server = Get-Command llama-server -ErrorAction SilentlyContinue
}

if (-not $server) {
  Write-Host "llama-server est introuvable." -ForegroundColor Red
  Write-Host "Installe llama.cpp puis relance ce script."
  exit 1
}

Write-Host "NEXORA Brain" -ForegroundColor Cyan
Write-Host "Model : $Model"
Write-Host "API   : http://127.0.0.1:$Port/v1"
Write-Host "Health: http://127.0.0.1:$Port/health"
Write-Host ""

& $server.Source `
  -hf $Model `
  --alias nexora-lia `
  --host 127.0.0.1 `
  --port $Port `
  --ctx-size $Context `
  --jinja `
  --reasoning off `
  --temp 0.2
