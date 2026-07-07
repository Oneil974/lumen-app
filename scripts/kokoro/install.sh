#!/bin/bash
# Installe le moteur Kokoro (TTS neuronal ONNX, Apache 2.0) pour le build
# Raspberry Pi de Lumen. Kokoro tourne sur CPU via onnxruntime et fournit des
# voix FR et EN de haute qualité. On crée un venv dédié (/opt/kokoro-venv) pour
# ne pas polluer le Python système (Raspberry Pi OS Bookworm = PEP 668).
#
# Les FICHIERS DE MODÈLE (modèle + embeddings de voix, ~340 Mo) se téléchargent
# ensuite depuis les Réglages de Lumen (section « Synthèse vocale », voix Kokoro).
#
#   sudo ./install.sh
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer en root : sudo ./install.sh" >&2
  exit 1
fi

echo "→ Dépendances système (espeak-ng pour la phonémisation, lecteurs audio)"
apt-get update -qq
# pipewire-bin (pw-play) / pulseaudio-utils (paplay) : lecture sur le périphérique
# par défaut du bureau, comme le navigateur. alsa-utils (aplay) en repli.
apt-get install -y python3 python3-venv python3-pip espeak-ng \
  alsa-utils pipewire-bin pulseaudio-utils || \
  apt-get install -y python3 python3-venv python3-pip espeak-ng alsa-utils

VENV="/opt/kokoro-venv"
echo "→ Environnement Python dédié : $VENV"
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip wheel
# kokoro-onnx tire onnxruntime (roues aarch64 disponibles) ; soundfile écrit le WAV.
"$VENV/bin/pip" install "kokoro-onnx>=0.4.0" soundfile

echo
echo "✓ Kokoro installé dans $VENV"
echo "  Télécharge une voix Kokoro depuis Lumen → Réglages → Synthèse vocale."
echo "  (Lumen détecte automatiquement $VENV/bin/python3.)"
