#!/bin/bash

# ProtonMail Bridge Instance for mobicycle-ou (rose@mobicycle.ee)
# Isolated config directory prevents instance collision
# Ports: IMAP 1143, SMTP 1025

BRIDGE_CONFIG_DIR="$(dirname "$0")/protonmail-bridge-instance" \
/Applications/Proton\ Mail\ Bridge.app/Contents/MacOS/bridge --cli
