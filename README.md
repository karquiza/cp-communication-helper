# CP Communication Helper

A class-project prototype of a communication helper for children with cerebral palsy.
The app suggests what a child means from their movements, gaze and sounds, and the child chooses.
"TalkBridge" and "Maya" are placeholder names. All suggestions are scripted; no AI model is running.

## What is in here

```
index.html              Landing page linking to the prototypes
prototypes/             Throwaway web demos. Quick to change, safe to break.
  shared/
    tokens.css          Colours, fonts and shadows used by every page
    scenarios.js        The scripted conversations used by every demo
  demo-scripted/        Clickable prototype with presenter notes (no camera)
  demo-gaze/            Choose an answer by looking at it (real camera)
app/                    Not created yet. The real mobile app goes here.
docs/                   Not created yet. Research notes, decisions, user-testing notes.
```

The prototypes have no build step and nothing to install. They are plain HTML, CSS and JavaScript.

## When you start the mobile app

Keep the app's source in `app/`, separate from the prototypes, so the two never mix.
Let the framework's own setup command create that folder; do not make it by hand.

| If you want | Use | What `app/` will contain |
| --- | --- | --- |
| To reuse this web code inside an app shell | Capacitor | The web code plus `ios/` and `android/` projects |
| A native app written in JavaScript | Expo (React Native) | Screens and components in JavaScript or TypeScript |

Either way, copy what you need from `prototypes/` into `app/`; do not link the app to the prototype files.
The scenario data and the gaze code in `prototypes/demo-gaze/app.js` are the parts most worth carrying over.
`.gitignore` already skips `node_modules/`; add the framework's own ignore rules when you set it up.

## Run it on your computer

Opening the files directly mostly works, but the camera needs a web server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Put it online with GitHub Pages

1. Push or upload everything in this folder to the repository, keeping the folders as they are.
2. In the repository, open Settings > Pages.
3. Choose "Deploy from a branch", branch `main`, folder `/ (root)`, and save.
4. After a minute or two the site is at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

The repository must be public for Pages on a free GitHub account.

## Where to change things

| To change | Edit |
| --- | --- |
| The conversations and suggestions | `prototypes/shared/scenarios.js` (the format is explained at the top of the file) |
| Colours and fonts | `prototypes/shared/tokens.css` |
| The phone screens, "My signals" and "Grown-ups" | `prototypes/demo-scripted/` |
| Gaze setup, hold time and tracking | `prototypes/demo-gaze/app.js` |

## Status

- `demo-scripted` has been checked in a desktop browser.
- `demo-gaze` has not yet been run with a real camera. Expect to fix things on first run.
  Gaze tracking is coarse: after a short setup it tells five screen regions apart.
  Keep the device still and the face well lit. Tapping always works as a backup.
- Video is processed in the browser with MediaPipe Face Landmarker and is not uploaded or saved.

## Ideas for next steps

- Detect one real signal in the scripted demo, such as a smile or a raised hand.
- Add a "How Maya confirms" setting: gaze, a yes/no signal, or scanning.
- Let a parent add their own phrases and scenarios.
- Wrap the web app as an installable phone app with Capacitor or Expo.
