(() => {
  const video = document.getElementById("video");
  const canvas = document.getElementById("overlay");
  const ctx = canvas.getContext("2d");
  const placeholder = document.getElementById("placeholder");
  const placeholderText = document.getElementById("placeholderText");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const detectedWord = document.getElementById("detectedWord");
  const muteBtn = document.getElementById("muteBtn");
  const nameInput = document.getElementById("nameInput");
  const cardList = document.getElementById("cardList");

  let speakingEnabled = true;

  // ---- Gesture definitions -------------------------------------------
  // Each rule checks index/middle/ring/pinky/thumb "extended" booleans.
  const GESTURES = [
    {
      key: "hello",
      emoji: "🖐️",
      name: "Open palm",
      test: (f) => f.index && f.middle && f.ring && f.pinky,
      phrase: () => "Hello!",
    },
    {
      key: "hi",
      emoji: "✌️",
      name: "Peace sign",
      test: (f) => f.index && f.middle && !f.ring && !f.pinky,
      phrase: () => "Hi!",
    },
    {
      key: "thumbsup",
      emoji: "👍",
      name: "Thumbs up",
      test: (f) => f.thumb && !f.index && !f.middle && !f.ring && !f.pinky,
      phrase: () => "I am doing great!",
    },
    {
      key: "point",
      emoji: "☝️",
      name: "Pointing finger",
      test: (f) => f.index && !f.thumb && !f.middle && !f.ring && !f.pinky,
      phrase: () => `My name is ${nameInput.value.trim() || "friend"}.`,
    },
    {
      key: "fist",
      emoji: "✊",
      name: "Closed fist",
      test: (f) => !f.index && !f.middle && !f.ring && !f.pinky,
      phrase: () => "Thank you!",
    },
  ];

  // Build reference cards
  GESTURES.forEach((g) => {
    const card = document.createElement("div");
    card.className = "card";
    card.id = "card-" + g.key;
    card.innerHTML = `
      <div class="emoji">${g.emoji}</div>
      <div class="info">
        <div class="name">${g.name}</div>
        <div class="phrase" id="phrase-${g.key}">"${g.phrase()}"</div>
      </div>`;
    cardList.appendChild(card);
  });
  nameInput.addEventListener("input", () => {
    const el = document.getElementById("phrase-point");
    if (el)
      el.textContent = `${GESTURES.find((g) => g.key === "point").phrase()}`;
  });

  muteBtn.addEventListener("click", () => {
    speakingEnabled = !speakingEnabled;
    muteBtn.textContent = speakingEnabled
      ? "🔊 Speaking on"
      : "🔇 Speaking off";
    muteBtn.classList.toggle("active", speakingEnabled);
    if (!speakingEnabled && window.speechSynthesis)
      window.speechSynthesis.cancel();
  });

  const speak = (text) => {
    if (!speakingEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
  };

  const setStatus = (text, mode) => {
    statusText.textContent = text;
    statusDot.className = "dot" + (mode ? " " + mode : "");
  };

  const highlightCard = (key) => {
    GESTURES.forEach((g) => {
      document
        .getElementById("card-" + g.key)
        .classList.toggle("hot", g.key === key);
    });
  };

  // ---- Landmark helpers -------------------------------------------
  const dist = (a, b) => {
    const dx = a.x - b.x,
      dy = a.y - b.y,
      dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const getFingerState = (lm) => {
    const wrist = lm[0];
    const pairs = {
      thumb: [4, 3],
      index: [8, 6],
      middle: [12, 10],
      ring: [16, 14],
      pinky: [20, 18],
    };
    const state = {};
    for (const finger in pairs) {
      const [tipIdx, pipIdx] = pairs[finger];
      state[finger] = dist(wrist, lm[tipIdx]) > dist(wrist, lm[pipIdx]) * 1.02;
    }
    return state;
  };

  const classify = (lm) => {
    const f = getFingerState(lm);
    for (const g of GESTURES) {
      if (g.test(f)) return g;
    }
    return null;
  };

  // ---- Stability / speaking logic ----------------------------------
  const STABLE_FRAMES = 7;
  let candidateKey = null;
  let candidateCount = 0;
  let lastSpokenKey = null;

  const onGestureFrame = (matchedGesture) => {
    const key = matchedGesture ? matchedGesture.key : null;

    if (key === candidateKey) {
      candidateCount++;
    } else {
      candidateKey = key;
      candidateCount = 1;
    }

    if (key === null) {
      // hand absent or shape not recognized; allow re-triggering later
      if (candidateCount > STABLE_FRAMES) lastSpokenKey = null;
      detectedWord.textContent = "Show a sign to begin";
      detectedWord.className = "detected-word idle";
      highlightCard(null);
      return;
    }

    detectedWord.textContent = matchedGesture.name;
    detectedWord.className = "detected-word active";
    highlightCard(key);

    if (candidateCount === STABLE_FRAMES && key !== lastSpokenKey) {
      lastSpokenKey = key;
      const phrase = matchedGesture.phrase();
      detectedWord.textContent = phrase;
      speak(phrase);
    }
  };

  // ---- MediaPipe Hands setup ----------------------------------------
  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6,
  });

  hands.onResults((results) => {
    if (canvas.width !== video.videoWidth && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let matched = null;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
      const lm = results.multiHandLandmarks[0];
      if (window.drawConnectors && window.HAND_CONNECTIONS) {
        drawConnectors(ctx, lm, HAND_CONNECTIONS, {
          color: "#4fd1c5",
          lineWidth: 3,
        });
      }
      if (window.drawLandmarks) {
        drawLandmarks(ctx, lm, { color: "#e8a33d", lineWidth: 1, radius: 3 });
      }
      matched = classify(lm);
      setStatus("Hand detected — reading the shape.", "live");
    } else {
      setStatus("Camera live — show a hand.", "warn");
    }
    ctx.restore();
    onGestureFrame(matched);
  });

  // ---- Camera setup ----------------------------------------------
  let sending = false;
  const frameLoop = async () => {
    if (video.readyState >= 2 && !sending) {
      sending = true;
      try {
        await hands.send({ image: video });
      } catch (e) {
        /* ignore transient frame errors */
      }
      sending = false;
    }
    requestAnimationFrame(frameLoop);
  };

  const startCamera = async () => {
    if (!window.isSecureContext) {
      placeholderText.textContent =
        "Open this page in a browser via localhost or HTTPS to allow camera access.";
      setStatus("Camera requires a secure browser context.", "warn");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      placeholderText.textContent =
        "This browser doesn't support camera access.";
      setStatus("Camera not supported in this browser.", "warn");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      placeholder.style.display = "none";
      setStatus("Camera live — show a hand.", "warn");
      requestAnimationFrame(frameLoop);
    } catch (err) {
      placeholderText.textContent =
        "Camera access was blocked. Allow it in your browser settings and reload.";
      setStatus("Camera permission denied.", "warn");
    }
  };

  startCamera();
})();
