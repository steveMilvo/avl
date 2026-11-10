# Home NVR

A self-hosted camera recorder for a mini PC, built on [Frigate](https://github.com/blakeblackshear/frigate).
Frigate does the recording, AI detection (people, cars, pets), timeline review and web app. This folder
adds the deployment around it: a Docker Compose stack, a starting configuration, a setup script, and
private remote access so the app installs on your phone and works away from home.

This folder is independent of the LoadLab code in the rest of the repository.

| File | Purpose |
|---|---|
| `docker-compose.yml` | The Frigate container, ports and storage |
| `config/config.yml` | Recording retention, detection and camera definitions |
| `.env.example` | Timezone, storage location and the camera login |
| `scripts/setup.sh` | First-time setup and start |
| `scripts/remote-access.sh` | Roaming access with a trusted HTTPS address |
| `docker-compose.alarm.yml`, `alarm/` | Optional alarm layer: sensors, siren, arm/disarm |
| `scripts/setup-alarm.sh` | Installs and starts the alarm layer |
| `SHOPPING-LIST.md` | Cameras, switch, cabling, mini PC and storage |

## How it fits together

```
Cameras ──ethernet──> PoE switch ──> Router ──> Mini PC (Frigate, recordings on local disk)
                                                   │
                                Tailscale (private, encrypted) ──> Phone / laptop app, anywhere
```

Video never leaves the house except to your own signed-in devices. No ports are opened on the router
and there is no cloud subscription.

## 1. Prepare the mini PC

1. Install Debian 12 or Ubuntu Server 24.04 (no desktop needed) and enable SSH.
2. Mount the recording drive, for example at `/mnt/nvr`, and add it to `/etc/fstab` so it survives reboots.
3. Install Docker Engine:

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   ```

   ```bash
   sudo usermod -aG docker $USER
   ```

   Log out and back in afterwards.
4. Give the mini PC a fixed IP address in your router (DHCP reservation).

## 2. Prepare each camera

1. Connect it and find its IP address in your router's device list.
2. Open that address in a browser, set an admin password and give it a fixed IP.
3. Create a second, view-only user for the recorder. Use the same name and password on every camera.
4. Turn on RTSP and ONVIF if they are off (Tapo: in the app under Advanced Settings > Camera Account).
5. Set the main stream to H.264 if the camera offers it (plays in every browser), 15 fps, with the
   I-frame interval equal to the frame rate. Set the substream to about 640x360 or 704x480 at 5 fps.
6. Check the stream plays in VLC (Media > Open Network Stream) before going further.

## 3. Install and start

```bash
git clone https://github.com/stevemilvo/avl.git
```

```bash
cd avl/home-nvr && ./scripts/setup.sh
```

The script creates `.env`, enables GPU video decoding if the PC has a GPU, starts Frigate, and prints
the address and the first-run admin password. Then:

1. Edit `.env`: set `STORAGE_PATH` to the recording drive and the camera login from step 2.
   Run `./scripts/setup.sh` again to apply.
2. Open `https://<mini-pc-ip>:8971`, accept the certificate warning (it is only shown on the LAN
   address) and log in as `admin`.
3. Change the admin password under Settings > Users. Add a viewer account for family members.

## 4. Add cameras

Settings > Camera management > **Add Camera**. The wizard probes the camera, picks the main stream for
recording and the substream for detection, and writes the result to `config/config.yml`.

To write the YAML by hand instead, uncomment the example at the bottom of `config/config.yml`. It
includes stream URL formats for Dahua, Hikvision, Tapo and Reolink.

After the cameras are in, draw motion masks over timestamps and moving trees, and zones for areas such
as the driveway (Settings > Masks / Zones).

## 5. Roaming access and the phone app

Frigate's web interface is a PWA, but a phone will only install it from a trusted HTTPS address.
Tailscale provides one, privately:

1. Create a free account at tailscale.com. In the admin console, DNS page, turn on **MagicDNS** and
   **HTTPS Certificates**.
2. On the mini PC:

   ```bash
   ./scripts/remote-access.sh
   ```

   It prints an address like `https://nvr.your-tailnet.ts.net`.
3. On each phone: install the Tailscale app, sign in with the same account, open that address and log
   in. Then install it:
   - Android (Chrome): menu > **Install app**
   - iPhone (Safari, iOS 16.4+): Share > **Add to Home Screen**
4. For push alerts, enable notifications under Settings > Notifications in the installed app.

The address works at home and away, on Wi-Fi or mobile data, as long as Tailscale is connected on the
phone.

Avoid forwarding port 8971 from the router to the internet. If you need access from devices that cannot
run Tailscale, put Frigate behind a reverse proxy with a real certificate instead; see Frigate's
[reverse proxy guide](https://docs.frigate.video/guides/reverse_proxy).

## 6. Alarm system (optional)

Adds battery-powered motion sensors, door and window contacts and a siren, with arming and disarming
from your phone. Three more containers run beside Frigate:

| Part | Job |
|---|---|
| Zigbee2MQTT | Talks to the sensors and siren through a Zigbee USB dongle |
| Mosquitto | Message broker that connects everything |
| Home Assistant + Alarmo | The alarm panel: arm modes, entry and exit delays, siren, phone alerts |

### Install

1. Plug the Zigbee dongle into the mini PC. Use a short USB extension lead and a USB 2 port; USB 3
   ports and drives sitting next to the dongle cut its range badly.
2. Run:

   ```bash
   ./scripts/setup-alarm.sh
   ```

   It finds the dongle, generates the passwords, connects Frigate to the broker, starts the containers
   and prints the addresses and logins used in the next steps.

### Finish in the browser

1. **Home Assistant**, `http://<mini-pc-ip>:8123`: create your account.
2. Settings > Devices & services > **Add integration**, three times:
   - **MQTT**: enter the broker details the script printed. Sensors then appear automatically.
   - **Frigate**: URL `http://127.0.0.1:5000`. Adds the cameras and their person/car detections.
   - **Alarmo**: adds the alarm panel.
3. **Pair the sensors**, `http://<mini-pc-ip>:8080` (enter the token the script printed): click
   **Permit join**, then hold each sensor's pairing button until it appears. Name each one by location,
   for example `hall_motion` or `back_door`. Pair mains-powered devices such as the siren first, then
   pair each battery sensor in the spot where it will live.
4. **Set up the alarm** in the Alarmo panel in the Home Assistant sidebar:
   - Sensors: add each one and tick the modes it belongs to. Typically door and window contacts are in
     both **Armed away** and **Armed home**, and indoor motion sensors in **Armed away** only, so you
     can move around the house at night with the doors still protected.
   - General: set exit and entry delays (30 seconds is usual) and a PIN.
   - Actions: on **Triggered**, switch the siren on and send a notification to your phone.
5. **Link sensors to cameras**: Settings > Automations > Blueprints > **Sensor trip records a camera
   clip**. Choose the sensors, type the Frigate camera name that covers the same area, and save. When
   one of those sensors trips while armed, Frigate saves a 30-second clip and files it as an alert,
   even if the camera itself detected nothing. Make one per area.

### On your phone

Run `./scripts/remote-access.sh` again. It now also prints an address for Home Assistant. Install the
Home Assistant app, sign in with that address, and you get the arm/disarm panel, push alerts, and
presence, so automations can arm the alarm when everyone has left.

### What to expect from it

This is a self-monitored alarm. It depends on the mini PC, mains power and your internet connection,
nobody is called if it goes off, and insurers may not treat it as a monitored system. A UPS on the
mini PC, switch and router keeps it running through a power cut. Test every sensor after pairing, and
again every few months: battery sensors report their battery level in Home Assistant.

## Storage and retention

`config/config.yml` keeps all footage for 3 days, footage with motion for 14 days, and clips of people
and vehicles for 30 days. Frigate removes the oldest footage itself when the disk fills.

Rough sizing for continuous recording: bitrate in Mbps x 10.8 = GB per camera per day. A 4 MP camera
at 4 Mbps is about 43 GB a day, so four cameras for 3 days is about 520 GB before motion and event
footage. A 2 TB drive suits four cameras on these settings; go to 4 TB for longer retention or 4K.

## Tuning

- **Intel mini PC**: uncomment the `detectors` and `model` block in `config/config.yml` to run detection
  on the integrated GPU. Inference time is shown under System metrics; under 30 ms is healthy.
- **"Bus error" in the log**: raise `shm_size` in `docker-compose.yml`.
- **Choppy live view away from home**: pick the Sub stream in the live view, or add the WebRTC
  candidates that `remote-access.sh` prints.
- **Keep cameras off the internet**: block their IP addresses from WAN access in the router, or put
  them on a separate VLAN. They only need to talk to the mini PC.

## Day-to-day

```bash
docker compose logs -f frigate
```

```bash
docker compose restart frigate
```

```bash
docker compose pull && docker compose up -d
```

The last one upgrades everything that is installed. Read the release notes first for major versions, and back up
`config/` (Frigate's configuration and event database) and `data/` (the alarm layer's settings and
the paired sensors).

## Status

Nothing here has been run on a physical mini PC with cameras or sensors. What has been checked: the
Compose files merge and validate, the scripts pass a syntax check, `setup-alarm.sh` was dry-run with
Docker stubbed out, and the configuration files were written against the Frigate 0.18.2 and
Zigbee2MQTT 2.14 schemas. Treat the first start as a commissioning step and read
`docker compose logs` for errors.
