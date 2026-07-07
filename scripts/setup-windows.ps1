# Installation runtime "tout-en-un" de Lumen sur Windows 10/11 x64.
#
# Installe ce dont l'app a besoin pour fonctionner tout de suite :
#   - Ollama (moteur LLM local) + un modele par defaut.
# La VOIX (synthese) utilise les voix systeme de Windows (ou l'app compagnon
# iPhone) : rien a installer cote voix. La dictee locale neuronale (whisper)
# n'est pas fournie sous Windows aujourd'hui.
#
# A executer dans PowerShell :
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
# Modele personnalise :
#   $env:LUMEN_MODEL="qwen2.5:3b"; powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
param([switch]$Yes)

$ErrorActionPreference = "Stop"
$Model = if ($env:LUMEN_MODEL) { $env:LUMEN_MODEL } else { "liquidai/lfm2.5-350m:latest" }

function Confirm-Step($prompt) {
  if ($Yes) { Write-Host "-> $prompt [oui]"; return $true }
  $a = Read-Host "$prompt [O/n]"
  if ([string]::IsNullOrWhiteSpace($a)) { return $true }
  return ($a -match '^(o|oui|y|yes)$')
}

function Install-Ollama {
  if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "-> Ollama deja present"
    return
  }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "winget est introuvable. Installe Ollama manuellement : https://ollama.com/download/windows"
  }
  Write-Host "-> Installation d'Ollama via winget"
  winget install --id Ollama.Ollama --exact --source winget --accept-package-agreements --accept-source-agreements
  # Rendre `ollama` disponible dans la session courante (sinon nouveau terminal).
  $ollamaBin = Join-Path $env:LOCALAPPDATA "Programs\Ollama"
  if (Test-Path $ollamaBin) { $env:Path = "$ollamaBin;$env:Path" }
}

function Wait-Ollama {
  for ($i = 0; $i -lt 30; $i++) {
    try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:11434/api/tags -TimeoutSec 2 | Out-Null; return $true }
    catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

Write-Host "=== Lumen - installation runtime Windows ==="
Install-Ollama

if (Confirm-Step "Telecharger le modele Ollama `"$Model`" maintenant ?") {
  # Demarre le serveur Ollama en arriere-plan s'il ne tourne pas deja.
  if (-not (Wait-Ollama)) {
    Write-Host "-> Demarrage du service Ollama"
    Start-Process -WindowStyle Hidden -FilePath "ollama" -ArgumentList "serve" -ErrorAction SilentlyContinue
    Wait-Ollama | Out-Null
  }
  Write-Host "-> ollama pull $Model"
  ollama pull $Model
}

Write-Host ""
Write-Host "OK Termine."
Write-Host "   - Modele local : $Model (modifiable dans Reglages -> IA)."
Write-Host "   - Voix : voix systeme Windows, ou l'app compagnon iPhone."
Write-Host "   - Cloud optionnel : ajoute une cle API dans Reglages -> IA."
