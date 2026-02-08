#!/bin/bash

# ProtonMail Bridge Instance for mobicycle-productions (rose@mobicycle.productions)
# Isolated config directory prevents instance collision
# Ports: IMAP 1145, SMTP 1027

BRIDGE_CONFIG_DIR="$(dirname "$0")/protonmail-bridge-instance" \
/Applications/Proton\ Mail\ Bridge.app/Contents/MacOS/bridge --cli --imap-port=1145 --smtp-port=1027
