#!/usr/bin/env bash
# Adds the alarm layer: MQTT broker, Zigbee2MQTT (sensors and siren) and Home
# Assistant with the Alarmo alarm panel and the Frigate integration.
# Plug in the Zigbee USB dongle first. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Run ./scripts/setup.sh first."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "git is needed: sudo apt install git"; exit 1; }

get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }
put() {
  if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
secret() { head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# --- Zigbee dongle -----------------------------------------------------------
dev="$(get ZIGBEE_DEVICE)"
if [ -z "$dev" ] || [ ! -e "$dev" ]; then
  mapfile -t found < <(ls /dev/serial/by-id/* 2>/dev/null || true)
  if [ "${#found[@]}" -eq 0 ]; then
    echo "No Zigbee USB dongle found under /dev/serial/by-id/. Plug it in and re-run."
    exit 1
  fi
  if [ "${#found[@]}" -gt 1 ]; then
    echo "More than one USB serial device found:"
    printf '  %s\n' "${found[@]}"
    echo "Set ZIGBEE_DEVICE in .env to the Zigbee dongle and re-run."
    exit 1
  fi
  dev="${found[0]}"
  put ZIGBEE_DEVICE "$dev"
  # Sonoff's "Dongle Plus V2" (ZBDongle-E) and other Silicon Labs sticks speak
  # ember; Texas Instruments sticks (ZBDongle-P, CC2652) speak zstack.
  case "$dev" in
    *V2* | *Ember* | *EFR32* | *SkyConnect* | *ZBT-1* | *ZBT-2*) put ZIGBEE_ADAPTER ember ;;
    *) put ZIGBEE_ADAPTER zstack ;;
  esac
fi
[ -n "$(get ZIGBEE_ADAPTER)" ] || put ZIGBEE_ADAPTER ember
echo "Zigbee dongle: $dev (adapter type: $(get ZIGBEE_ADAPTER); change ZIGBEE_ADAPTER in .env if it fails to start)"

# --- Secrets -----------------------------------------------------------------
[ -n "$(get FRIGATE_MQTT_USER)" ] || put FRIGATE_MQTT_USER nvr
[ -n "$(get FRIGATE_MQTT_PASSWORD)" ] || put FRIGATE_MQTT_PASSWORD "$(secret)"
[ -n "$(get ZIGBEE_UI_TOKEN)" ] || put ZIGBEE_UI_TOKEN "$(secret)"
mqtt_user="$(get FRIGATE_MQTT_USER)"
mqtt_pass="$(get FRIGATE_MQTT_PASSWORD)"

# --- Data folders and first-run files ---------------------------------------
mkdir -p data/mosquitto/config data/mosquitto/data data/zigbee2mqtt data/homeassistant
[ -f data/zigbee2mqtt/configuration.yaml ] ||
  cp alarm/zigbee2mqtt.configuration.yaml data/zigbee2mqtt/configuration.yaml

ha=data/homeassistant
if [ ! -f "$ha/configuration.yaml" ]; then
  cp alarm/homeassistant/configuration.yaml "$ha/configuration.yaml"
  echo '[]' > "$ha/automations.yaml"
  : > "$ha/scripts.yaml"
  : > "$ha/scenes.yaml"
fi
mkdir -p "$ha/blueprints/automation/home_nvr"
cp alarm/homeassistant/blueprints/*.yaml "$ha/blueprints/automation/home_nvr/"

# Broker settings and login file. The login file is written by the broker's own
# tool, inside its container, so the format and ownership are right.
cp alarm/mosquitto.conf data/mosquitto/config/mosquitto.conf
docker run --rm -v "$PWD/data/mosquitto/config:/mosquitto/config" \
  -e U="$mqtt_user" -e P="$mqtt_pass" eclipse-mosquitto:2 sh -c \
  'mosquitto_passwd -b -c /mosquitto/config/passwd "$U" "$P" &&
   chown mosquitto:mosquitto /mosquitto/config/passwd && chmod 600 /mosquitto/config/passwd'

# Alarmo (alarm panel) and the Frigate integration are community add-ons for
# Home Assistant; fetch them into its custom_components folder.
fetch() { # fetch <repo> <component>
  local tmp dest="$ha/custom_components/$2"
  tmp="$(mktemp -d)"
  if ! git clone -q --depth 1 "https://github.com/$1" "$tmp"; then
    echo "Could not download $1; re-run this script later to add it."
  elif ! { mkdir -p "$ha/custom_components" && rm -rf "$dest"; } 2>/dev/null; then
    echo "Kept the installed copy of $2 (files are owned by root; re-run with sudo to update it)."
  else
    cp -r "$tmp/custom_components/$2" "$dest"
    echo "Installed Home Assistant add-on: $2"
  fi
  rm -rf "$tmp"
}
fetch nielsfaber/alarmo alarmo
fetch blakeblackshear/frigate-hass-integration frigate

# --- Point Frigate at the broker --------------------------------------------
python3 - "$PWD/config/config.yml" <<'PY'
import re, shutil, sys
path = sys.argv[1]
text = open(path).read()
block = (
    "mqtt:\n"
    "  enabled: true\n"
    "  host: mosquitto\n"
    '  user: "{FRIGATE_MQTT_USER}"\n'
    '  password: "{FRIGATE_MQTT_PASSWORD}"\n'
)
m = re.search(r"^mqtt:[^\n]*\n(?:(?:[ \t]+[^\n]*|[ \t]*)\n)*", text, re.M)
if m and "host: mosquitto" in m.group(0):
    print("Frigate is already pointed at the MQTT broker.")
else:
    shutil.copy(path, path + ".before-alarm")
    text = text[: m.start()] + block + "\n" + text[m.end():] if m else block + "\n" + text
    open(path, "w").write(text)
    print("Enabled MQTT in config/config.yml (previous copy: config.yml.before-alarm).")
PY

put ALARM_ENABLED true
./scripts/setup.sh

ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
cat <<MSG

Alarm layer is starting. Finish in the browser (details in README, "Alarm system"):

  Home Assistant     http://${ip:-<this-pc-ip>}:8123
  Sensor pairing     http://${ip:-<this-pc-ip>}:8080   token: $(get ZIGBEE_UI_TOKEN)

When Home Assistant asks for the MQTT broker:
  broker 127.0.0.1   port 1883   username $mqtt_user   password $mqtt_pass
When it asks for the Frigate URL:
  http://127.0.0.1:5000
MSG
