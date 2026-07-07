#!/bin/bash
# Installe whisper.cpp (reconnaissance vocale locale, MIT) pour la DICTÉE du build
# Raspberry Pi de Lumen. STT offline sur CPU, FR & EN. Construit le binaire
# `whisper-cli` et télécharge le modèle `base` (multilingue) dans /opt/whisper.
#
# La dictée (bouton micro) enregistre un court clip (parecord/arecord) puis le
# transcrit avec whisper.cpp. Aucun cloud, aucune dépendance Apple.
#
#   sudo ./install.sh            # modèle « base » (rapide, défaut)
#   sudo ./install.sh small      # modèle « small » (plus précis, plus lent)
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer en root : sudo ./install.sh" >&2
  exit 1
fi

MODEL="${1:-base}"   # base (défaut) | small | tiny | medium…

echo "→ Dépendances de build + capture audio"
apt-get update -qq
apt-get install -y git cmake build-essential pulseaudio-utils alsa-utils

TMP="$(mktemp -d)"
echo "→ Clonage et compilation de whisper.cpp (peut durer quelques minutes sur Pi)"
git clone --depth 1 https://github.com/ggerganov/whisper.cpp "$TMP/whisper.cpp"
cd "$TMP/whisper.cpp"
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)" --config Release

mkdir -p /opt/whisper/models
# Le binaire s'appelle whisper-cli (récent) ou main (ancien) selon la version.
if [ -f build/bin/whisper-cli ]; then cp build/bin/whisper-cli /opt/whisper/whisper-cli
elif [ -f build/bin/main ];        then cp build/bin/main        /opt/whisper/main
else echo "Binaire whisper introuvable après build" >&2; exit 1; fi

echo "→ Téléchargement du modèle « $MODEL » (multilingue)"
bash ./models/download-ggml-model.sh "$MODEL"
cp "models/ggml-${MODEL}.bin" /opt/whisper/models/ggml-base.bin   # Lumen lit toujours ggml-base.bin

cd /; rm -rf "$TMP"
echo
echo "✓ Dictée whisper.cpp installée dans /opt/whisper (modèle : $MODEL)."
echo "  Test : echo bonjour ; /opt/whisper/whisper-cli -m /opt/whisper/models/ggml-base.bin -f samples.wav -l fr -nt"
echo "  Dans Lumen, utilise le bouton micro de la barre."
