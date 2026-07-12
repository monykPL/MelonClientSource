#!/usr/bin/env bash
# ==========================================================================
# Instalator MelonClient dla Linuksa
#
# Użytkownik uruchamia jedną komendę w terminalu (patrz README), a ten
# skrypt sam:
#   1. Pobiera najnowszy MelonClient.AppImage z GitHub Releases
#   2. Nadaje mu prawa do uruchamiania
#   3. Wrzuca go do ~/.local/share/MelonClient
#   4. Tworzy wpis w menu aplikacji (z ikoną), żeby dało się go znaleźć
#      i uruchamiać tak jak każdy inny program, nie tylko z terminala
#
# WAŻNE DLA CIEBIE (zanim to wyślesz komuś): podmień GITHUB_REPO poniżej
# na swoje prawdziwe repo (np. "twojnick/melonclient"), po tym jak
# wrzucisz zbudowany plik .AppImage jako załącznik do GitHub Release.
# ==========================================================================

set -e

GITHUB_REPO="monykPL/MelonClientSource"
INSTALL_DIR="$HOME/.local/share/MelonClient"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

echo "== Instalacja MelonClient =="

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"

echo "-> Pobieram najnowszą wersję z GitHub Releases..."
LATEST_URL=$(curl -s "https://api.github.com/repos/$GITHUB_REPO/releases/latest" \
  | grep "browser_download_url.*AppImage" \
  | cut -d '"' -f 4)

if [ -z "$LATEST_URL" ]; then
  echo "BŁĄD: nie znalazłem pliku .AppImage w najnowszym Release na $GITHUB_REPO."
  echo "Sprawdź, czy repo istnieje i czy release ma załączony plik .AppImage."
  exit 1
fi

curl -L "$LATEST_URL" -o "$INSTALL_DIR/MelonClient.AppImage"
chmod +x "$INSTALL_DIR/MelonClient.AppImage"

echo "-> Pobieram ikonę..."
curl -sL "https://raw.githubusercontent.com/$GITHUB_REPO/main/src/assets/logo.png" \
  -o "$ICON_DIR/melonclient.png" || true

echo "-> Tworzę skrót w terminalu (komenda 'melonclient')..."
ln -sf "$INSTALL_DIR/MelonClient.AppImage" "$BIN_DIR/melonclient"

echo "-> Dodaję wpis w menu aplikacji..."
cat > "$DESKTOP_DIR/melonclient.desktop" << EOF
[Desktop Entry]
Name=MelonClient
Comment=Klient Minecraft
Exec=$INSTALL_DIR/MelonClient.AppImage
Icon=melonclient
Terminal=false
Type=Application
Categories=Game;
EOF

echo ""
echo "Gotowe! MelonClient jest zainstalowany."
echo "Możesz go odpalić:"
echo "  - z menu aplikacji (szukaj 'MelonClient'),"
echo "  - albo wpisując w terminalu: melonclient"
echo ""
echo "Uwaga: jeśli \$HOME/.local/bin nie jest w PATH, dodaj do ~/.bashrc:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
