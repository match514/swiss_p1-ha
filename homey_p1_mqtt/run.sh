#!/usr/bin/env bash
set -e

OPTIONS_FILE="/data/options.json"

DONGLE_IP=$(jq -r '.dongle_ip' "$OPTIONS_FILE")
MODE=$(jq -r '.mode' "$OPTIONS_FILE")
DECRYPTION_KEY=$(jq -r '.decryption_key // empty' "$OPTIONS_FILE")
MQTT_HOST=$(jq -r '.mqtt_host' "$OPTIONS_FILE")
MQTT_PORT=$(jq -r '.mqtt_port' "$OPTIONS_FILE")
MQTT_USER=$(jq -r '.mqtt_user // empty' "$OPTIONS_FILE")
MQTT_PASSWORD=$(jq -r '.mqtt_password // empty' "$OPTIONS_FILE")

if [ -n "$MQTT_USER" ]; then
  MQTT_URL="mqtt://${MQTT_USER}:${MQTT_PASSWORD}@${MQTT_HOST}:${MQTT_PORT}"
else
  MQTT_URL="mqtt://${MQTT_HOST}:${MQTT_PORT}"
fi

echo "Démarrage du pont Homey P1 -> MQTT"
echo "Dongle: ${DONGLE_IP}  Mode: ${MODE}  Broker: ${MQTT_HOST}:${MQTT_PORT}"

exec node /app/homey-energy-dongle-mqtt.js "$DONGLE_IP" "$MODE" "$MQTT_URL" "$DECRYPTION_KEY"
