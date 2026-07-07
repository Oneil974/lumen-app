# Scripts d'installation Lumen

Scripts **runtime** pour préparer une machine à faire tourner Lumen : moteur LLM local (Ollama), voix neuronales locales (Piper, Kokoro) et dictée locale (whisper.cpp). Aucun outil de build n'est requis — vous utilisez l'application téléchargée depuis les [Releases](https://github.com/Oneil974/lumen-app/releases/latest).

## Installation « tout-en-un »

Lancez le script correspondant à votre système, **sans `sudo`** (il demande les droits quand nécessaire). Mode et modèle sont configurables.

### macOS (Apple Silicon)
```bash
./setup-macos.sh          # interactif
./setup-macos.sh --yes    # installe tout sans confirmation
```
Installe **Ollama** + un modèle par défaut. La voix et la dictée sont gérées nativement par macOS — rien à installer côté voix.

### Linux (Debian/Ubuntu x86_64)
```bash
./setup-linux.sh          # interactif
./setup-linux.sh --yes    # installe tout
```
Installe **Ollama**, les voix **Piper** et **Kokoro**, et la dictée **whisper.cpp**.

### Raspberry Pi OS (64-bit)
```bash
./setup-pi.sh             # interactif
./setup-pi.sh --yes       # installe tout
```
Comme Linux, avec des modèles adaptés au Pi. Sur 4 Go de RAM, privilégiez les petits modèles (ou déportez l'inférence : *Réglages → IA → URL*).

### Windows 10/11 (x64)
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```
Installe **Ollama** (via winget) + un modèle par défaut. La voix utilise les voix système Windows.

### Choisir le modèle
```bash
LUMEN_MODEL="qwen2.5:3b" ./setup-linux.sh
```
```powershell
$env:LUMEN_MODEL="qwen2.5:3b"; powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

## Composants voix / dictée (Linux & Pi, en autonome)

Les scripts « tout-en-un » les appellent déjà. Pour les (ré)installer séparément, en **root** :

| Composant | Commande | Rôle |
|---|---|---|
| **Piper** | `sudo ./piper/install.sh` | Synthèse vocale rapide (MIT) |
| **Kokoro** | `sudo ./kokoro/install.sh` | Synthèse vocale haute qualité (Apache 2.0, venv dédié) |
| **whisper.cpp** | `sudo ./whisper/install.sh [base\|small\|tiny]` | Dictée locale hors-ligne (MIT) |

> Les **fichiers de voix** (modèles `.onnx`) se téléchargent ensuite depuis **Lumen → Réglages → Synthèse vocale**.

## Prérequis minimal

Seul **[Ollama](https://ollama.com)** est indispensable pour l'inférence 100 % locale. Tout le reste (voix, dictée) est optionnel. En mode local, aucune donnée ne quitte votre machine.
