#!/bin/bash
# Installation runtime « tout-en-un » de Lumen sur macOS.
#
# Installe ce dont l'app a besoin pour fonctionner tout de suite :
#   • Ollama (moteur LLM local) + un modèle par défaut.
# La VOIX (synthèse) et la DICTÉE sont gérées nativement par macOS (app
# Raccourcis / synthèse vocale système) : rien à installer côté voix.
#
# À lancer UNE FOIS, SANS sudo :
#   ./scripts/setup-macos.sh
# Non interactif :
#   ./scripts/setup-macos.sh --yes
# Modèle personnalisé :
#   LUMEN_MODEL="qwen2.5:3b" ./scripts/setup-macos.sh
set -euo pipefail

MODEL="${LUMEN_MODEL:-liquidai/lfm2.5-350m:latest}"
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    *) echo "Option inconnue : $arg" >&2; exit 2 ;;
  esac
done

ask() {
  local prompt="$1" answer
  if [ "$ASSUME_YES" -eq 1 ]; then echo "→ $prompt [oui]"; return 0; fi
  read -r -p "$prompt [O/n] " answer
  case "${answer:-O}" in o|O|oui|Oui|y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

install_ollama() {
  if command -v ollama >/dev/null 2>&1; then
    echo "→ Ollama déjà présent : $(ollama --version 2>/dev/null | head -1)"
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    echo "→ Installation d'Ollama via Homebrew"
    brew install ollama
  else
    echo "Homebrew est absent. Installe Ollama manuellement :"
    echo "  https://ollama.com/download/mac  (puis relance ce script)"
    echo "Ou installe Homebrew : https://brew.sh"
    exit 1
  fi
}

ensure_ollama_running() {
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then return 0; fi
  echo "→ Démarrage du service Ollama"
  # Sur macOS, `ollama serve` tient le terminal : on le lance en arrière-plan le
  # temps du pull. L'app Ollama (si installée via .dmg) le gère ensuite seule.
  (ollama serve >/tmp/lumen-ollama.log 2>&1 &) || true
  for _ in $(seq 1 30); do
    curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "  Ollama n'a pas répondu sur :11434. Lance « ollama serve » dans un autre terminal." >&2
  return 1
}

pull_model() {
  echo "→ Téléchargement du modèle par défaut : $MODEL"
  ollama pull "$MODEL"
}

echo "=== Lumen · installation runtime macOS ==="
install_ollama
if ask "Télécharger le modèle Ollama « $MODEL » maintenant ?"; then
  ensure_ollama_running && pull_model
fi

cat <<EOF

✅ Terminé.
   • Modèle local : $MODEL (modifiable dans Réglages → IA).
   • Voix & dictée : gérées par macOS (app Raccourcis / synthèse système).
   • Cloud optionnel : ajoute une clé API dans Réglages → IA si besoin.
EOF
