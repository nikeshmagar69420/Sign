# Gesture Camera Demo

A fun webcam-based hand gesture project that uses MediaPipe Hands to recognize different hand signs and respond with voice, text, and sound effects.

## Project Overview

This project lets users show hand gestures in front of the camera and trigger different reactions. It is designed to feel interactive, playful, and easy to present in a demo.

## Main Features

- Live webcam feed
- Real-time hand tracking
- Gesture recognition using MediaPipe Hands
- Voice responses for each detected sign
- Sound effects for special triggers
- Emoji and highlight cards for visual feedback

## Recognized Gestures

| Gesture         | Meaning       | Response                     |
| --------------- | ------------- | ---------------------------- |
| Open palm       | Greeting      | Says: Hello!                 |
| Peace sign      | Friendly wave | Says: Hi!                    |
| Thumbs up       | Approval      | Says: I am doing great!      |
| Pointing finger | Introduction  | Says: My name is [your name] |
| Closed fist     | Thank you     | Says: Thank you!             |

## Special Trigger Actions

### 1. Two Peace Signs

When two peace-sign hands are held together, the app triggers a special Miku-style effect and displays:

- “Miku miku beeeee!”
- a special sound effect
- a highlight animation

### 2. Two Open Palms

When two open palms are held together, the app triggers a greeting effect and says:

- “Assalamu alaikum”
- plus the matching sound file

## How to Run

Because the webcam requires a secure/local browser context, the project should be served through a local web server.

### Option 1: Python

```bash
cd "c:/Users/nikes/Desktop/project"
python -m http.server 8000
```

Then open this in the browser:

```text
http://localhost:8000/
```

### Option 2: VS Code Live Server

- Open the project folder in VS Code
- Start Live Server
- Open the preview in the browser

## Important Notes

- Allow camera permission when the browser asks
- Use a browser that supports webcam access
- Audio may need a user click before it plays
- If sound is blocked, the app still uses speech output as a backup

## Presentation Summary

This project is a simple and engaging demonstration of computer vision, gesture interaction, and voice response. It is suitable for a class presentation, hackathon demo, or creative prototype.
