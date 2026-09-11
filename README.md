# Gesture Camera Demo

This is a browser-based hand gesture demo. It uses the webcam and MediaPipe Hands to recognize hand shapes and trigger different behaviors.

## Features

- Webcam camera feed fills the page
- Hand detection with MediaPipe Hands
- Gesture-based voice output
- Special two-hand peace trigger with Miku-style sound

## Run locally

Because camera access requires a secure/local browser context, serve the project from a local web server instead of opening the file directly.

### Option 1: Python

```bash
cd "c:/Users/nikes/Desktop/project"
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

### Option 2: VS Code Live Server

Open the folder in VS Code and run Live Server on the project.

## Notes

- Use a browser that allows camera access.
- Accept the camera permission when prompted.
- The special trigger works when two peace-sign hands are held in front of the camera.
- Audio may be blocked until the page has an interaction or user gesture.
