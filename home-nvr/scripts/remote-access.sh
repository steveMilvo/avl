#!/usr/bin/env bash
# Roaming access through Tailscale: gives Frigate a private address with a trusted
# HTTPS certificate, reachable only from your own signed-in devices. Nothing is
# opened on the router. Safe to re-run.
#
# Before running, in the Tailscale admin console (DNS page) turn on MagicDNS and
# HTTPS Certificates.
set -euo pipefail

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sudo sh
fi

if ! sudo tailscale status >/dev/null 2>&1; then
  echo "Sign this machine in to your Tailscale account (a login link follows)."
  sudo tailscale up
fi

# Frigate's own port uses a self-signed certificate, hence https+insecure for the
# hop on this machine. Devices connect to Tailscale's trusted certificate on 443.
sudo tailscale serve --bg https+insecure://localhost:8971

name="$(sudo tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
ts_ip="$(sudo tailscale ip -4 | head -1)"

echo
echo "Roaming address:  https://$name"
echo
echo "On each phone or tablet:"
echo "  1. Install the Tailscale app and sign in with the same account."
echo "  2. Open the address above and log in to Frigate."
echo "  3. Android (Chrome): menu > Install app.   iPhone (Safari): Share > Add to Home Screen."
echo
echo "Optional, for lowest-latency live view and two-way talk away from home, add to"
echo "config/config.yml under go2rtc and restart Frigate:"
echo "  webrtc:"
echo "    candidates:"
echo "      - $ts_ip:8555"
echo "      - $(hostname -I | awk '{print $1}'):8555"
