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
  const triggerAudio = document.getElementById("triggerAudio");

  let speakingEnabled = true;
  let specialTriggered = false;
  let specialHoldFrames = 0;
  const SPECIAL_TRIGGER_TEXT = "miku miku " + "b".repeat(120);

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
    if (el) {
      el.textContent = `${GESTURES.find((g) => g.key === "point").phrase()}`;
    }
  });

  muteBtn.addEventListener("click", () => {
    speakingEnabled = !speakingEnabled;
    muteBtn.textContent = speakingEnabled
      ? "🔊 Speaking on"
      : "🔇 Speaking off";
    muteBtn.classList.toggle("active", speakingEnabled);
    if (!speakingEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  });

  const speak = (text) => {
    if (!speakingEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    window.speechSynthesis.speak(utterance);
  };

  const playSpecialSound = () => {
    if (triggerAudio) {
      triggerAudio.muted = false;
      triggerAudio.volume = 1;
      triggerAudio.currentTime = 0;
      const playPromise = triggerAudio.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => {
            return;
          })
          .catch(() => {
            speak(SPECIAL_TRIGGER_TEXT);
          });
        return;
      }

      if (!triggerAudio.paused) {
        return;
      }
    }

    speak(SPECIAL_TRIGGER_TEXT);
  };

  const setStatus = (text, mode) => {
    statusText.textContent = text;
    statusDot.className = "dot" + (mode ? " " + mode : "");
  };

  const highlightCard = (key) => {
    GESTURES.forEach((g) => {
      const card = document.getElementById("card-" + g.key);
      if (card) card.classList.toggle("hot", g.key === key);
    });
  };

  const dist = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
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

  const getHandCenter = (lm) => {
    const xs = lm.map((point) => point.x);
    const ys = lm.map((point) => point.y);
    return {
      x: xs.reduce((sum, value) => sum + value, 0) / xs.length,
      y: ys.reduce((sum, value) => sum + value, 0) / ys.length,
    };
  };

  const detectTwoHandPeaceMiku = (recognizedHands) => {
    if (!recognizedHands || recognizedHands.length < 2) return false;

    const peaceHands = recognizedHands
      .map(({ lm, gesture }) => ({
        center: getHandCenter(lm),
        gesture,
      }))
      .filter((item) => item.gesture && item.gesture.key === "hi");

    if (peaceHands.length < 2) return false;

    const width = canvas.width || video.videoWidth || 640;
    const height = canvas.height || video.videoHeight || 480;

    const leftEye = { x: width * 0.32, y: height * 0.28 };
    const rightEye = { x: width * 0.68, y: height * 0.28 };

    const leftHand = peaceHands
      .filter((hand) => hand.center.x < 0.5)
      .sort((a, b) => a.center.x - b.center.x)[0];
    const rightHand = peaceHands
      .filter((hand) => hand.center.x >= 0.5)
      .sort((a, b) => b.center.x - a.center.x)[0];

    if (!leftHand || !rightHand) return false;

    const leftNearEye =
      Math.abs(leftHand.center.x * width - leftEye.x) < width * 0.32 &&
      Math.abs(leftHand.center.y * height - leftEye.y) < height * 0.35;
    const rightNearEye =
      Math.abs(rightHand.center.x * width - rightEye.x) < width * 0.32 &&
      Math.abs(rightHand.center.y * height - rightEye.y) < height * 0.35;

    const leftRightSpread =
      Math.abs(leftHand.center.x - rightHand.center.x) > 0.1;
    const bothOnScreen = leftHand.center.x < 0.8 && rightHand.center.x > 0.2;

    return (leftNearEye && rightNearEye) || (leftRightSpread && bothOnScreen);
  };

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

  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
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
    const handLandmarks = results.multiHandLandmarks || [];
    const recognizedHands = handLandmarks.map((lm) => ({
      lm,
      gesture: classify(lm),
    }));

    if (handLandmarks.length) {
      handLandmarks.forEach((lm) => {
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          drawConnectors(ctx, lm, HAND_CONNECTIONS, {
            color: "#4fd1c5",
            lineWidth: 3,
          });
        }
        if (window.drawLandmarks) {
          drawLandmarks(ctx, lm, { color: "#e8a33d", lineWidth: 1, radius: 3 });
        }
      });

      matched = recognizedHands[0]?.gesture || null;
      setStatus("Hands detected — reading the shape.", "live");
    } else {
      setStatus("Camera live — show a hand.", "warn");
    }

    const twoHandMiku = detectTwoHandPeaceMiku(recognizedHands);
    if (twoHandMiku) {
      specialHoldFrames += 1;
    } else {
      specialHoldFrames = 0;
    }

    if (twoHandMiku && specialHoldFrames >= 3) {
      detectedWord.textContent = "Miku miku beeeee!";
      detectedWord.className = "detected-word active";
      highlightCard("hi");
      setStatus("Two-hand peace trigger!", "live");

      if (!specialTriggered) {
        specialTriggered = true;
        playSpecialSound();
      }
      ctx.restore();
      return;
    }

    if (!twoHandMiku) {
      specialTriggered = false;
      specialHoldFrames = 0;
    }

    ctx.restore();
    onGestureFrame(matched);
  });

  let sending = false;
  const frameLoop = async () => {
    if (video.readyState >= 2 && !sending) {
      sending = true;
      try {
        await hands.send({ image: video });
      } catch (e) {
        // ignore transient frame errors
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
