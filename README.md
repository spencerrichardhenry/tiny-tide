# Tiny Tide

A mobile 3D eat-and-evolve game with one continuous ocean-to-space world. Build your own little creature, feed it,
and evolve it from Tiny to Cosmic.

Play: https://spencerrichardhenry.github.io/tiny-tide/

Read the [game guide](docs/TINY-TIDE.md), the [evolution notes](docs/TINY-TIDE-EVOLUTION.md) and the
[Blender art notes](docs/TINY-TIDE-ART.md).

## Run locally

```sh
npm install
npm run dev        # http://localhost:5199/
```

## Phone app (Android)

```sh
npm run android:install   # builds the game into the app and installs it on the connected phone
```

The app runs in landscape and full screen. It uses the Android SDK in `../.android-sdk` (or `ANDROID_HOME`) and Java 21.

## Checks

See "Verification" in [the game guide](docs/TINY-TIDE.md). Pushing `master` deploys to GitHub Pages.

This game was split out of the [wildtag](https://github.com/spencerrichardhenry/wildtag) repo on 2026-10-07, with its history.
