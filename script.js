(() => {
  const setViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  };

  setViewportHeight();
  window.addEventListener("resize", setViewportHeight);

  const video = document.getElementById("video");
  const canvas = document.getElementById("overlay");
  const ctx = canvas.getContext("2d");
  const placeholder = document.getElementById("placeholder");
  const placeholderText = document.getElementById("placeholderText");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const detectedWord = document.getElementById("detectedWord");
  const nameInput = document.getElementById("nameInput");
  const cardList = document.getElementById("cardList");
  const triggerAudio = document.getElementById("triggerAudio");

  let speakingEnabled = true;
  let specialTriggered = false;
  let specialHoldFrames = 0;
  let spiderManTriggered = false;
  let spiderManHoldFrames = 0;
  let greetingTriggered = false;
  let greetingHoldFrames = 0;
  const SPECIAL_TRIGGER_TEXT = "miku miku " + "b".repeat(120);

  // Step 1: Set up audio and sound effects.
  const playAudioFromFile = (fileName) => {
    if (!triggerAudio) return;

    triggerAudio.src = fileName;
    triggerAudio.muted = false;
    triggerAudio.volume = 1;
    triggerAudio.currentTime = 0;
    triggerAudio.load();

    const playPromise = triggerAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        speak(fileName === "spidi.mp3" ? "Spider-Man" : SPECIAL_TRIGGER_TEXT);
      });
    }
  };

  document.addEventListener(
    "pointerdown",
    () => {
      if (!triggerAudio) return;
      triggerAudio.muted = true;
      triggerAudio
        .play()
        .then(() => {
          triggerAudio.pause();
          triggerAudio.currentTime = 0;
          triggerAudio.muted = false;
        })
        .catch(() => {});
    },
    { once: true },
  );

  // Step 2: Build the list of gestures that the app knows.
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

  const speak = (text) => {
    if (!speakingEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    window.speechSynthesis.speak(utterance);
  };

  const playSpecialSound = () => {
    playAudioFromFile("miku.mp3");
    if (!triggerAudio || triggerAudio.paused) {
      speak(SPECIAL_TRIGGER_TEXT);
    }
  };

  const playGreetingSound = (detectedHandCount) => {
    if (detectedHandCount < 2) return;
    playAudioFromFile("muslim.mp3");
    if (!triggerAudio || triggerAudio.paused) {
      speak("Assalamu alaikum");
    }
  };

  const playSpiderManSound = () => {
    playAudioFromFile("spidi.mp3");
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
    const palm = {
      x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
      y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
    };

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
      const tipDist = dist(lm[tipIdx], palm);
      const pipDist = dist(lm[pipIdx], palm);
      state[finger] = tipDist > pipDist * 1.12;
    }
    return state;
  };

  const getHandCenter = (lm) => {
    const xs = lm.map((point) => point.x);
    const ys = lm.map((point) => point.y);
    return {
      x: xs.reduce((sum, value) => sum + value, 0) / xs.length,
      y: ys.reduce((sum, value) => sum + value, 0) / ys.length,
    };
  };

  const isGreetingHand = (lm) => {
    const center = getHandCenter(lm);
    const palm = {
      x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
      y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
    };

    const fingerTips = [4, 8, 12, 16, 20];
    const tipSpread = fingerTips.reduce((max, idx) => {
      return Math.max(max, dist(lm[idx], palm));
    }, 0);

    const fingerCluster = fingerTips.every((idx) => dist(lm[idx], palm) < 0.14);
    const fingerPairsClose =
      dist(lm[8], lm[12]) < 0.12 &&
      dist(lm[12], lm[16]) < 0.12 &&
      dist(lm[16], lm[20]) < 0.12 &&
      dist(lm[4], lm[8]) < 0.18;

    const wristNearCenter = dist(lm[0], center) < 0.2;

    const nearFace =
      center.y < 0.55 && center.y > 0.18 && center.x > 0.18 && center.x < 0.82;

    return (
      tipSpread < 0.2 &&
      fingerCluster &&
      fingerPairsClose &&
      wristNearCenter &&
      nearFace
    );
  };

  // Step 3: Check the hand shape and decide which gesture it matches.
  const classify = (lm) => {
    const f = getFingerState(lm);

    if (isGreetingHand(lm)) {
      return GESTURES.find((g) => g.key === "hello") || null;
    }

    const pointLike =
      f.index &&
      !f.thumb &&
      !f.middle &&
      !f.ring &&
      !f.pinky &&
      dist(lm[8], lm[5]) > dist(lm[6], lm[5]) * 0.7;

    if (pointLike) {
      return GESTURES.find((g) => g.key === "point") || null;
    }

    for (const g of GESTURES) {
      if (g.key !== "point" && g.test(f)) return g;
    }
    return null;
  };

  const detectTwoHandPeaceMiku = (recognizedHands) => {
    if (!recognizedHands || recognizedHands.length < 2) return false;

    const peaceHands = recognizedHands.filter(({ gesture }) => {
      return gesture && gesture.key === "hi";
    });

    if (peaceHands.length < 2) return false;

    const centers = peaceHands
      .map(({ lm }) => getHandCenter(lm))
      .sort((a, b) => a.x - b.x);

    if (centers.length < 2) return false;

    const spread = Math.abs(centers[0].x - centers[centers.length - 1].x);
    const bothVisible =
      centers[0].x < 0.8 && centers[centers.length - 1].x > 0.2;
    const verticalAlignment =
      Math.abs(centers[0].y - centers[centers.length - 1].y) < 0.18;

    return spread > 0.22 && bothVisible && verticalAlignment;
  };

  const detectTwoHandOpenPalms = (recognizedHands) => {
    if (!recognizedHands || recognizedHands.length !== 2) return false;

    const openHands = recognizedHands.filter(({ gesture }) => {
      return gesture && gesture.key === "hello";
    });

    if (openHands.length !== 2) return false;

    const centers = openHands
      .map(({ lm }) => getHandCenter(lm))
      .sort((a, b) => a.x - b.x);
    const spread = Math.abs(centers[0].x - centers[1].x);
    const verticalAlignment = Math.abs(centers[0].y - centers[1].y) < 0.25;

    return spread > 0.12 && verticalAlignment;
  };

  const detectSpiderMan = (recognizedHands) => {
    return recognizedHands.some(({ lm }) => {
      const fingers = getFingerState(lm);
      return fingers.index && fingers.pinky && !fingers.middle && !fingers.ring;
    });
  };

  const STABLE_FRAMES = 4;
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

  // Step 4: Use MediaPipe to process every video frame.
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
            color: "rgba(255,255,255,0.75)",
            lineWidth: 1.5,
          });
        }
        if (window.drawLandmarks) {
          drawLandmarks(ctx, lm, {
            color: "rgba(143, 227, 216, 0.9)",
            lineWidth: 1,
            radius: 2,
          });
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
      setStatus("Two-hand boom trigger!", "live");

      if (!specialTriggered) {
        specialTriggered = true;
        playSpecialSound();
      }
      ctx.restore();
      return;
    }

    const spiderMan = detectSpiderMan(recognizedHands);
    if (spiderMan) {
      spiderManHoldFrames += 1;
    } else {
      spiderManHoldFrames = 0;
    }

    if (spiderMan && spiderManHoldFrames >= 3) {
      detectedWord.textContent = "Spider-Man";
      detectedWord.className = "detected-word active";
      highlightCard("point");
      setStatus("Spider-Man sign detected.", "live");

      if (!spiderManTriggered) {
        spiderManTriggered = true;
        playSpiderManSound();
      }
      ctx.restore();
      return;
    }

    if (!spiderMan) {
      spiderManTriggered = false;
      spiderManHoldFrames = 0;
    }

    const twoHandOpenPalms = detectTwoHandOpenPalms(recognizedHands);
    if (twoHandOpenPalms) {
      greetingHoldFrames += 1;
    } else {
      greetingHoldFrames = 0;
      greetingTriggered = false;
    }

    if (twoHandOpenPalms && greetingHoldFrames >= 3) {
      detectedWord.textContent = "Assalamu alaikum";
      detectedWord.className = "detected-word active";
      highlightCard("hello");
      setStatus("Two open palms detected.", "live");

      if (!greetingTriggered) {
        greetingTriggered = true;
        playGreetingSound(handLandmarks.length);
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
      } catch (e) {}
      sending = false;
    }
    requestAnimationFrame(frameLoop);
  };

  // Step 5: Start the webcam and begin the detection loop.
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
