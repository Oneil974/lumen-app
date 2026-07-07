#!/bin/bash
# Installe Piper (synthèse vocale neuronale, MIT) pour le build Raspberry Pi de
# Lumen. Le binaire est posé dans /opt/piper et lié dans /usr/local/bin/piper ;
# `aplay` (alsa-utils) sert à la lecture. Les VOIX se téléchargent ensuite depuis
# les Réglages de Lumen (section « Synthèse vocale »).
#
#   sudo ./install.sh
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer en root : sudo ./install.sh" >&2
  exit 1
fi

# Architecture du binaire Piper (Pi 5 / Pi 4 64-bit = arm64 ; 32-bit = armv7).
case "$(uname -m)" in
  aarch64|arm64) ARCH="arm64" ;;
  armv7l|armhf)  ARCH="armv7" ;;
  x86_64)        ARCH="x86_64" ;;
  *) echo "Architecture non gérée : $(uname -m)" >&2; exit 1 ;;
esac

VERSION="2023.11.14-2"   # dernière release stable de rhasspy/piper
URL="https://github.com/rhasspy/piper/releases/download/${VERSION}/piper_linux_$( [ "$ARCH" = arm64 ] && echo aarch64 || echo "$ARCH" ).tar.gz"

echo "→ alsa-utils (aplay)"
apt-get update -qq
apt-get install -y alsa-utils wget tar

echo "→ Téléchargement de Piper ($ARCH)"
TMP="$(mktemp -d)"
wget -qO "$TMP/piper.tar.gz" "$URL"
echo "→ Installation dans /opt/piper"
rm -rf /opt/piper
tar -xzf "$TMP/piper.tar.gz" -C /opt
# L'archive extrait un dossier « piper/ » contenant le binaire `piper`.
ln -sf /opt/piper/piper /usr/local/bin/piper
rm -rf "$TMP"

echo
echo "✓ Piper installé : $(piper --version 2>/dev/null || echo '/usr/local/bin/piper')"
echo "  Télécharge une voix depuis Lumen → Réglages → Synthèse vocale."
echo "  Test manuel : echo 'Bonjour' | piper --model /chemin/voix.onnx --output_file - | aplay"
