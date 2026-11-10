# Shopping list

Sized for a **four-camera wired (PoE) house** with one optional Wi-Fi camera. Adjust quantities to suit.
Prices are rough AliExpress/online ranges in AUD and move a lot with sales; treat them as a guide.

## What every camera must have

- **RTSP and ONVIF** stated in the listing. App-only cameras (Tuya, Smart Life, CloudEdge, V380,
  YI IoT, battery and solar models) cannot be recorded.
- **Two streams**: a main stream to record and a low-resolution substream for detection.
- **H.264 selectable** for the main stream, so playback works in every browser.
- **Standard PoE, 802.3af**, not "passive PoE".
- **International / English firmware.** Cheap Hikvision and Dahua listings are often Chinese-region
  units that cannot be updated. Buy from the brand's official store or a known reseller.
- A sensor of 1/2.8" or larger. For night image, sensor size matters more than megapixels: a 4 MP
  camera on a 1/1.8" sensor beats an 8 MP camera on a 1/2.8" sensor.

## Cameras

Pick one tier and stay within it so every camera configures the same way.

| Tier | Model | Type | Use for | Approx. each |
|---|---|---|---|---|
| **Recommended** | Dahua IPC-T54IR-AS-S3 (sold as EmpireTech / Loryta), 2.8 mm lens | 4 MP turret, 1/1.8" sensor, IR | Driveway, front and back yard. Best night image here; the brand Frigate's author recommends first | $180-230 |
| Recommended, colour at night | Dahua IPC-T549M-ALED-S3 (EmpireTech / Loryta) | 4 MP turret, 1/1.8", warm LED | Front door or anywhere you want colour faces and clothing at night | $200-260 |
| Mid | Hikvision DS-2CD2343G2-I (turret) or DS-2CD2043G2-I (bullet), 2.8 mm | 4 MP AcuSense | Same roles; solid streams, widely available | $140-190 |
| **Budget** | Reolink RLC-520A (turret) or RLC-510A (bullet) | 5 MP PoE | Good value. Stay at 5 MP or below: Frigate's docs report problems with Reolink's 4K models | $70-95 |
| Doorbell (optional) | Reolink Video Doorbell PoE | 5 MP, two-way talk | Front door; two-way talk works in Frigate | $130-170 |
| Wi-Fi, outdoor (only where no cable can run) | Reolink RLC-510WA | 5 MP, dual-band, mains powered | One awkward spot. Needs a power point and strong signal | $90-120 |
| Wi-Fi, indoor | TP-Link Tapo C210 or C220 | 2K pan-tilt | Hallway, garage. Enable the Camera Account in the Tapo app for RTSP | $40-60 |

Turrets are the best default outdoors: no dome to glare or collect spider webs, and easy to aim.
A 2.8 mm lens gives a wide view (about 100°) for general coverage; choose 3.6 mm or 6 mm for a long
driveway or a gate where you need to identify a face or plate at distance.

Frigate's documentation advises against Wi-Fi cameras because dropped streams leave gaps in the
recordings. Keep them to one or two.

## Network and power

| Item | Spec | Qty | Approx. |
|---|---|---|---|
| PoE switch | 8 ports with at least 4 PoE (802.3af/at), 60 W or more budget, gigabit uplink. TP-Link TL-SG1008P or TL-SG108PE class. Budget about 8 W per fixed camera | 1 | $70-120 |
| Ethernet cable | Cat6, **solid pure copper** (not "CCA"), UV-rated outdoor jacket for external runs. 100 m box, or pre-terminated lengths | 1 box | $60-110 |
| RJ45 plugs and crimp tool | Cat6 pass-through plugs, crimper, cheap cable tester | 1 kit | $30-50 |
| Junction boxes | The matching box for each camera model (Dahua PFA130-E for the turrets above). Keeps the connector dry and hides the cable | 1 per camera | $15-25 each |
| Patch leads | Switch to router, mini PC to router | 2 | $10 |
| UPS (optional) | 600 VA or larger, powering the mini PC, switch and router so recording continues through a power cut | 1 | $100-160 |

Buy mains-powered items (switch, UPS, power adapters) from a local seller so they come with the right
plug and electrical approval. In Australia, fixed data cabling inside walls and ceilings legally
requires a registered cabler; pre-terminated leads you plug in yourself do not.

## Recorder

| Item | Spec | Approx. |
|---|---|---|
| Mini PC | Intel N100 or N150, 16 GB RAM, 256 GB+ SSD for the system. Dual LAN ports are a bonus (one can be a camera-only network). Frigate's docs recommend the Beelink EQ13 and warn of compatibility problems with the EQ14 | $250-350 |
| Recording drive | 2 TB for four cameras on the default retention, 4 TB for more days or 4K. A surveillance-rated HDD (WD Purple, Seagate SkyHawk) in a USB 3 enclosure, or an internal SSD if the PC has a second bay | $110-200 |

An Intel CPU is the easy choice: its integrated GPU handles both video decoding and AI detection, so
no separate accelerator is needed for this many cameras. Connect the mini PC to the router by cable if
at all possible; over Wi-Fi every camera's recording depends on that one link.

## Example basket: four cameras

| Item | Qty | Approx. |
|---|---|---|
| Dahua IPC-T54IR-AS-S3 turret | 3 | $600 |
| Dahua IPC-T549M-ALED-S3 turret (front door) | 1 | $230 |
| Junction boxes | 4 | $80 |
| 8-port PoE switch | 1 | $90 |
| Cat6 outdoor cable, plugs, crimper | 1 | $130 |
| N100 mini PC, 16 GB | 1 | $300 |
| 2 TB surveillance drive and enclosure | 1 | $140 |
| **Total** | | **about $1,570** |

The same basket with Reolink RLC-520A cameras comes to about $1,050.

## Before ordering several

Order one camera first, connect it, and confirm it plays in VLC and in Frigate. Then order the rest.
