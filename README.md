# idrive7-apps

> **Fork TNM** de [nickgcode/idrive7-apps](https://github.com/nickgcode/idrive7-apps) : identique a l'original,
> sauf **G's Dash**, qui affiche le logo **TNM** (`apps/ng_gsdash/images/logo_custom.png`, 672x160) au centre
> du compteur, quel que soit le style. Si l'image manque ou est illisible, l'app reprend son logo d'origine.
> Installation : Store -> Settings -> Add source -> `yahyaMIf/idrive7-apps`.

Custom apps for BMW iDrive 7 head units. You install and update them from the car through
robertn_store, which builds each app on the head unit from this repository.

## Apps

### G's Dash (`ng_gsdash`)

A driver display and car hub for the centre screen.

- **Seven looks:** M Style, GT, Digital '84, Sim Racing, Lumen, Pixel and Vector, some with a choice
  of colours. Star your favourites and tap the gear on Drive to switch between them.
- **Pages:** swipe between Showcase (the car, what Spotify is playing, or a clock), Drive (shift
  lights, gear, rpm, speed, g-meter, drive mode, oil and coolant temperatures), Warm-up, G-force and
  Tires (tire pressures and temperatures).
- **Units:** mph or km/h, °F or °C, psi, bar or kPa.
- **Spotify panel:** optional, with its own sign-in by QR code.
- **Home-screen widget.**
- **On the car's other displays** (optional): cluster dials and a HUD in your look, the G's Dash logo
  in the cluster, and a picker for what the cluster's centre map area shows. These need the Cluster
  renderer tool from the Store. A single switch in Options puts the cluster and HUD back to stock.
  The cluster dials are built only for the instrument cluster's M layout. If your car doesn't use
  it, you can code it with BimmerCode.
- **CarPlay map in the cluster** (optional, off by default): needs the Waze on cluster tool from the
  Store and is untested on most firmware. To revert, turn it off and restart the head unit, or remove
  the tool.

### G's Music (`ng_spotify`)

A full-screen Spotify player with synced lyrics or a visualizer.

![G's Music playing a track with synced lyrics](docs/gsmusic-lyrics.png)

- Album art, large touch controls (previous, play/pause, next, shuffle, repeat, like) and a seek bar
  you tap or drag.
- Synced lyrics from [LRCLIB](https://lrclib.net), or a visualizer.
- Sign in by scanning a QR code with your phone.
- A home-screen widget showing what's playing.
- While music plays, lyrics (scrolling as in the app) or the visualizer in the instrument cluster, and
  optionally the lyrics in the HUD (off by default), in a small, medium or large size. Both need the Cluster renderer tool; the
  HUD also needs its HUD takeover setting turned on. G's Dash's cluster dials and HUD step aside while
  lyrics show in the HUD.

Needs Spotify Premium. Setup guide: [docs/spotify.md](docs/spotify.md).

### G's TV (`ng_tv`) - experimental

Video on the centre screen while parked.

- Channels from [Spelunkr](https://spelunkr.tv) (programmes on the Internet Archive) with a
  two-hour guide and channel up / down.
- Your own sources: direct links to MP4 (H.264) files, sent from your phone with a QR code or a
  6-digit code.
- Picks up where you left off.
- Optional playback in the HUD or the cluster, also only while parked.

The picture shows only in P, at a standstill. Video only, no sound yet.

## Requirements

- A BMW with an iDrive 7 head unit and robertn_store installed.
- **Internet** for G's Music, G's TV and G's Dash's Spotify panel: turn on the Store's uplink (phone
  hotspot or Wi-Fi).
- **Cluster and HUD features:** the Cluster renderer tool from the Store. The CarPlay map in the
  cluster also needs the Waze on cluster tool.

## Install

1. On the car, open **robertn_store → Settings → Add source**.
2. Enter `nickgcode/idrive7-apps` (or paste this repository's link) and save.
3. The apps appear in the Store's list. Choose one and tap **Install**.

Updates appear in the Store as well. To remove an app, uninstall it in the Store.

Nothing here contains BMW's SDK. The Store supplies it when it builds an app on the head unit; a
local build needs it in `oap-sdk/` (git-ignored). Never publish `dist/`, since builds contain the SDK.

## Support

Enjoying the apps? You can support development via [GitHub Sponsors](https://github.com/sponsors/nickgcode).

## Disclaimer

Unofficial. Not made, endorsed or supported by BMW or by the Store's author. Use at your own risk:
you are responsible for your car and for how you use these apps. Don't let them distract you while
driving.

## License

MIT, see [LICENSE](LICENSE). Bundled third-party code keeps its own licence:
[kit/LICENSE.idrive7-apps](kit/LICENSE.idrive7-apps), [apps/ng_gsdash/LICENSE](apps/ng_gsdash/LICENSE),
[apps/ng_spotify/LICENSE](apps/ng_spotify/LICENSE), [apps/ng_tv/LICENSE](apps/ng_tv/LICENSE).
