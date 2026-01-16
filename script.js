let connectionsVerified = false;
let starterMoved = false;
let mcbOn = false;
const CONNECTION_VERIFIED_EVENT = "connections-verified";
const MCB_TURNED_OFF_EVENT = "mcb-turned-off";
const MCB_TURNED_ON_EVENT = "mcb-turned-on";
const STARTER_MOVED_EVENT = "starter-moved";
const WIRE_CURVINESS = -50;

const generatorRotor = document.querySelector(".generator-rotor");

let suppressAllAutoVoices = true;
let suppressGuideDuringAutoConnect = false;
let isAutoConnecting = false;

function resetSpeakButtonUI() {
  const speakBtn = document.querySelector(".speak-btn");
  if (!speakBtn) return;

  speakBtn.classList.remove("guiding");
  speakBtn.setAttribute("aria-pressed", "false");

  const label = speakBtn.querySelector(".speak-btn__label");
  if (label) {
    label.textContent = "Tap To Listen";
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.cancel();
}
resetSpeakButtonUI();

function pickPreferredVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;

  const englishVoices = voices.filter((voice) =>
    String(voice.lang || "").toLowerCase().startsWith("en")
  );

  const maleByGender = englishVoices.find(
    (voice) => String(voice.gender || "").toLowerCase() === "male"
  );
  if (maleByGender) return maleByGender;

  const maleNameHints = [
    /male/i,
    /ravi/i,
    /hemant/i,
    /david/i,
    /mark/i,
    /george/i,
    /daniel/i,
    /alex/i,
    /fred/i,
    /john/i,
    /james/i,
    /mike/i,
    /andrew/i,
    /tom/i,
    /steve/i,
    /roger/i
  ];
  const maleByName = englishVoices.find((voice) =>
    maleNameHints.some((hint) => hint.test(String(voice.name || "")))
  );
  if (maleByName) return maleByName;

  const enIndia = englishVoices.find((voice) =>
    String(voice.lang || "").toLowerCase().startsWith("en-in")
  );
  return enIndia || englishVoices[0] || voices[0];
}

window.labSpeech = window.labSpeech || {};
window.labSpeech.enabled = true;
window.labSpeech.speak = function speak(text, options = {}) {
  if (!window.labSpeech.enabled) return Promise.resolve();
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    return Promise.resolve();
  }
  if (!text) return Promise.resolve();

  const opts = options || {};
  const shouldInterrupt = opts.interrupt !== false;

  if (shouldInterrupt) window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(String(text));
    const voice = pickPreferredVoice();
    if (voice) utterance.voice = voice;

    utterance.lang = (voice && voice.lang) || "en-US";
    utterance.rate = Number.isFinite(opts.rate) ? opts.rate : 0.85;
    utterance.pitch = Number.isFinite(opts.pitch) ? opts.pitch : 0.9;
    utterance.volume = Number.isFinite(opts.volume) ? opts.volume : 1;

    utterance.onend = () => {
      if (typeof opts.onend === "function") opts.onend();
      resolve();
    };
    utterance.onerror = () => {
      if (typeof opts.onend === "function") opts.onend();
      resolve();
    };
    window.speechSynthesis.speak(utterance);
  });
};
window.labSpeech.stop = function stop() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};
window.labSpeech.cancel =
  window.labSpeech.cancel ||
  function cancel() {
    window.labSpeech.stop();
  };
window.labSpeech.isActive = window.labSpeech.isActive || (() => false);
window.labSpeech.say =
  window.labSpeech.say ||
  function say(text) {
    if (!text) return Promise.resolve();
    return window.labSpeech.speak(text);
  };
window.labSpeech.sayLines =
  window.labSpeech.sayLines ||
  function sayLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return Promise.resolve();
    const [first] = lines;
    if (!first) return Promise.resolve();
    return window.labSpeech.speak(first);
  };

function updateRotorSpin() {
  if (!generatorRotor) return;
  const shouldSpin = connectionsVerified && mcbOn && starterMoved;
  generatorRotor.classList.toggle("spinning", shouldSpin);
}

// Step-by-step helper popups
const stepGuide = (() => {
  const steps = [
    {
      id: "connect",
      title: "Make the connections",
      copy: "Use the label points to wire the circuit or press Auto Connect. When you are done, hit Check Connections."
    },
    {
      id: "mcb",
      title: "Turn on the MCB",
      copy: "Connections are correct. Click the MCB to switch it on before moving the starter."
    },
    {
      id: "starter",
      title: "Move the starter handle",
      copy: "Drag the starter handle from left to right to start the setup."
    },
    {
      id: "reading",
      title: "Add a reading",
      copy: "Choose the number of bulbs and click Add To Table to log the paired readings."
    },
    {
      id: "graph",
      title: "Plot the graph",
      copy: "After adding at least six readings, click Graph to draw Voltage vs Load Current."
    },
    {
      id: "done",
      title: "All steps complete",
      copy: "Great job! You can keep experimenting or press Reset to run the flow again."
    }
  ];

  let activeIndex = 0;

  const modal = document.createElement("div");
  modal.className = "step-modal is-hidden";
  modal.innerHTML = `
    <div class="step-modal__backdrop"></div>
    <div class="step-modal__card">
      <div class="step-modal__header">
        <span class="step-modal__step"></span>
        <button class="step-modal__close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="step-modal__body">
        <p class="step-modal__title"></p>
        <p class="step-modal__copy"></p>
      </div>
      <button class="step-modal__cta" type="button">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);

  const stepLabel = modal.querySelector(".step-modal__step");
  const titleEl = modal.querySelector(".step-modal__title");
  const copyEl = modal.querySelector(".step-modal__copy");
  const closeBtn = modal.querySelector(".step-modal__close");
  const ctaBtn = modal.querySelector(".step-modal__cta");
  const backdrop = modal.querySelector(".step-modal__backdrop");

  function hide() {
    modal.classList.add("is-hidden");
  }

  function renderStep(step, index) {
    if (!step) return;
    const totalPlayable = steps.length - 1; // last step is the completion note
    const stepNumber = step.id === "done" ? "Complete" : `Step ${index + 1} of ${totalPlayable}`;
    stepLabel.textContent = stepNumber;
    titleEl.textContent = step.title;
    copyEl.textContent = step.copy;
  }

  function showCurrent() {
    const step = steps[activeIndex];
    if (!step) return;
    renderStep(step, activeIndex);
    modal.classList.remove("is-hidden");
  }

  function complete(stepId) {
    const expected = steps[activeIndex];
    if (!expected || expected.id !== stepId) return;
    activeIndex = Math.min(activeIndex + 1, steps.length - 1);
    showCurrent();
  }

  function reset() {
    activeIndex = 0;
    showCurrent();
  }

  closeBtn?.addEventListener("click", hide);
  ctaBtn?.addEventListener("click", hide);
  backdrop?.addEventListener("click", hide);

  // Show the first prompt when the page is ready
  if (document.readyState === "complete" || document.readyState === "interactive") {
    showCurrent();
  } else {
    document.addEventListener("DOMContentLoaded", showCurrent, { once: true });
  }

  return { complete, reset, showCurrent, hide };
})();

(function initComponentIntro() {
  const intro = document.getElementById("componentIntro");
  if (!intro) return;

  const skipBtn = intro.querySelector(".component-intro__skip");
  const closeTargets = intro.querySelectorAll("[data-component-intro-close]");

  function open() {
    intro.classList.remove("is-hidden");
    if (stepGuide && typeof stepGuide.hide === "function") {
      stepGuide.hide();
    }
    skipBtn?.focus?.();
  }

  function close() {
    intro.classList.add("is-hidden");
    if (stepGuide && typeof stepGuide.showCurrent === "function") {
      stepGuide.showCurrent();
    }
  }

  closeTargets.forEach((target) => target.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", open, { once: true });
  } else {
    open();
  }
})();

const sharedControls = {
  updateControlLocks: () => {},
  setMcbState: () => {},
  starterHandle: null
};

function findButtonByLabel(label) {
  if (!label) return null;
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const target = normalize(label);
  const buttons = document.querySelectorAll(".pill-btn, .graph-pill-btn");
  return (
    Array.from(buttons).find((btn) => {
      const text = normalize(btn.textContent);
      const aria = normalize(btn.getAttribute("aria-label"));
      return text === target || aria === target || text.includes(target) || aria.includes(target);
    }) || null
  );
}

// (function initInstructionsModal() {
//   const openBtn = document.querySelector(".instructions-btn");
//   const modal = document.getElementById("instructionModal");
//   if (!openBtn || !modal) return;

//   const closeBtn = modal.querySelector(".instruction-close");
//   const backdrop = modal.querySelector(".instruction-overlay__backdrop");
//   const hiddenClass = "is-hidden";

//   let lastFocusedEl = null;

//   function isOpen() {
//     return !modal.classList.contains(hiddenClass);
//   }

//   function open() {
//     if (isOpen()) return;
//     lastFocusedEl = document.activeElement;
//     modal.classList.remove(hiddenClass);
//     openBtn.setAttribute("aria-expanded", "true");
//     closeBtn?.focus?.();
//   }

//   function close() {
//     if (!isOpen()) return;
//     modal.classList.add(hiddenClass);
//     openBtn.setAttribute("aria-expanded", "false");
//     if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
//       lastFocusedEl.focus();
//     } else {
//       openBtn.focus();
//     }
//   }

//   openBtn.setAttribute("aria-controls", "instructionModal");
//   openBtn.setAttribute("aria-expanded", "false");

//   openBtn.addEventListener("click", open);
//   closeBtn?.addEventListener("click", close);
//   backdrop?.addEventListener("click", close);
//   document.addEventListener("keydown", (event) => {
//     if (event.key === "Escape") close();
//   });
// })();

if (!window.jsPlumb || typeof window.jsPlumb.ready !== "function") {
  console.error("jsPlumb is not loaded. Connection wiring is disabled.");
} else {
  jsPlumb.ready(function () {
  const ringSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="12" fill="black"/>
        <circle cx="13" cy="13" r="9" fill="#C38055"/>
        <circle cx="13" cy="13" r="6" fill="black"/>
      </svg>
    `);
  // keep defaults aligned with the legacy curvy wires
  jsPlumb.importDefaults({
    Connector: ["Bezier", { curviness: WIRE_CURVINESS }]
  });
  // Base endpoint options (no connectorStyle here; we'll set per-endpoint dynamically)
  const baseEndpointOptions = {
    endpoint: ["Image", { url: ringSvg, width: 26, height: 26 }],
    isSource: true,
    isTarget: true,
    maxConnections: -1,
    connector: ["Bezier", { curviness: WIRE_CURVINESS }]
  };
  const container = document.querySelector(".top-row");
  if (container) {
    jsPlumb.setContainer(container);
  } else {
    console.warn('jsPlumb: container ".top-row" not found.');
  }
  // anchors for each point (you can tweak these)
  const anchors = {
    pointR: [1, 0.5, 1, 0], // right side
    pointB: [0, 0.5, -1, 0], // left side
    
    pointL: [1, 0.5, 1, 0], // right
    pointF: [0, 0.5, -1, 0], // left
    pointA: [1, 0.5, 1, 0], // right
    pointC: [0, 0.5, -1, 0],
    pointD: [1, 0.5, 1, 0],
    pointE: [0, 0.5, -1, 0],
    pointG: [1, 0.5, 1, 0],
    pointH: [0, 0.5, -1, 0],
    pointI: [1, 0.5, 1, 0],
    pointJ: [0, 0.5, -1, 0],
    pointK: [1, 0.5, 1, 0],
    pointA1: [0, 0.5, -1, 0],
    pointZ1: [1, 0.5, 1, 0],
    pointA3: [0, 0.5, -1, 0],
    pointZ3: [1, 0.5, 1, 0],
    pointA2: [0, 0.5, -1, 0],
    pointZ2: [1, 0.5, 1, 0],
    pointA4: [0, 0.5, -1, 0],
    pointZ4: [1, 0.5, 1, 0],
    pointL1: [0, 0.5, -1, 0],
    pointL2: [1, 0.5, 1, 0],
  };
  const endpointsById = new Map();
  const loopbackTargets = new Map();

  function mirrorAnchor(anchor) {
    if (!anchor || !Array.isArray(anchor)) return null;
    const mirrored = anchor.slice();
    if (mirrored.length > 2) mirrored[2] = -mirrored[2];
    if (mirrored.length > 3) mirrored[3] = -mirrored[3];
    return mirrored;
  }

  function getLoopbackEndpoint(id) {
    if (loopbackTargets.has(id)) return loopbackTargets.get(id);

    const el = document.getElementById(id);
    if (!el) {
      console.warn("jsPlumb: element not found for loopback:", id);
      return null;
    }

    const baseAnchor = anchors[id];
    const loopAnchor = mirrorAnchor(baseAnchor) || baseAnchor || [0.5, 0.5, 0, 0];

    const ep = jsPlumb.addEndpoint(el, {
      anchor: loopAnchor,
      uuid: `${id}-loopback`,
      endpoint: "Blank",
      isSource: false,
      isTarget: true,
      maxConnections: -1
    });

    loopbackTargets.set(id, ep);
    return ep;
  }
  // helper to safely add endpoint if element exists
  function addEndpointIfExists(id, anchor) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn("jsPlumb: element not found:", id);
      return;
    }
    // raise z-index so endpoint image stays visible above other elements
    el.style.zIndex = 2000;
    // Determine color based on anchor side (left: blue, right: red)
    const isLeftSide = anchor[0] === 0; // x=0 is left side
    const wireColor = isLeftSide ? "blue" : "red";
    // Create per-endpoint options with connectorStyle for drag preview
    const endpointOptions = { ...baseEndpointOptions };
    endpointOptions.connectorStyle = {
      stroke: wireColor,
      strokeWidth: 4
    };
    // Use a stable uuid so Auto Connect can reuse the same styled endpoint
    const ep = jsPlumb.addEndpoint(el, { anchor, uuid: id }, endpointOptions);
    endpointsById.set(id, ep);
    return ep;
  }
  // add endpoints for the points
  Object.keys(anchors).forEach(id => addEndpointIfExists(id, anchors[id]));

  function getOrCreateEndpoint(id) {
    let ep = endpointsById.get(id);
    if (!ep && typeof jsPlumb.getEndpoint === "function") {
      ep = jsPlumb.getEndpoint(id);
      if (ep) endpointsById.set(id, ep);
    }
    if (!ep && anchors[id]) {
      ep = addEndpointIfExists(id, anchors[id]);
    }
    return ep || null;
  }

  function connectionKey(a, b) {
    return [a, b].sort().join("-");
  }

  function getSeenConnectionKeys() {
    const seen = new Set();
    jsPlumb.getAllConnections().forEach(conn => {
      seen.add(connectionKey(conn.sourceId, conn.targetId));
    });
    return seen;
  }

  function connectRequiredPair(req, seenKeys, index = -1) {
    const [a, b] = req.split("-");
    if (!a || !b) return false;
    const isSelfConnection = a === b;

    const normalizedKey = connectionKey(a, b);
    if (seenKeys && seenKeys.has(normalizedKey)) return true;

    const aEl = document.getElementById(a);
    const bEl = document.getElementById(b);
    if (!aEl || !bEl) {
      console.warn("Auto Connect: missing element(s) for", req);
      return false;
    }

    const aAnchor = anchors[a];
    const bAnchor = anchors[b];
    const aIsLeft = aAnchor ? aAnchor[0] === 0 : false;
    const bIsLeft = bAnchor ? bAnchor[0] === 0 : false;

    let sourceId, targetId;
    if (isSelfConnection) {
      sourceId = a;
      targetId = a;
    } else if (aIsLeft !== bIsLeft) {
      // Mixed sides: alternate preference for balance (even index: prefer right source -> red; odd: left -> blue)
      const preferRight = (index % 2 === 0) || (index < 0);
      if (preferRight) {
        sourceId = aIsLeft ? b : a; // Choose right as source
      } else {
        sourceId = bIsLeft ? b : a; // Choose left as source
      }
      targetId = sourceId === a ? b : a;
    } else {
      // Same side: default to a as source
      sourceId = a;
      targetId = b;
    }

    const sourceAnchorSide = anchors[sourceId];
    const sourceIsLeftSide = sourceAnchorSide ? sourceAnchorSide[0] === 0 : false;
    const wireColor = sourceIsLeftSide ? "blue" : "red";

    const sourceEndpoint = getOrCreateEndpoint(sourceId);
    const targetEndpoint = isSelfConnection ? getLoopbackEndpoint(targetId) : getOrCreateEndpoint(targetId);
    if (!sourceEndpoint || !targetEndpoint) {
      console.warn("Auto Connect: missing endpoint(s) for", req);
      return false;
    }

    // Connect using existing endpoints to keep point design unchanged.
    const connectionParams = {
      sourceEndpoint,
      targetEndpoint,
      connector: ["Bezier", { curviness: WIRE_CURVINESS }],
      paintStyle: { stroke: wireColor, strokeWidth: 4 }
    };

    if (isSelfConnection) {
      const sourceAnchor = anchors[sourceId];
      const targetAnchor = mirrorAnchor(sourceAnchor) || sourceAnchor;
      if (sourceAnchor || targetAnchor) {
        connectionParams.anchors = [sourceAnchor || targetAnchor, targetAnchor];
      }
    }

    const conn = jsPlumb.connect(connectionParams);

    if (conn && seenKeys) {
      seenKeys.add(connectionKey(conn.sourceId, conn.targetId));
    }

    return !!conn;
  }

  // Dynamic wire color based on source anchor side (left: blue, right: red) - Now sets on connection for consistency
  jsPlumb.bind("connection", function(info) {
    const sourceId = info.sourceId;
    const sourceAnchor = anchors[sourceId];
    const isLeftSide = sourceAnchor && sourceAnchor[0] === 0; // x=0 is left side
    const wireColor = isLeftSide ? "blue" : "red";
    info.connection.setConnector(["Bezier", { curviness: WIRE_CURVINESS }]);
    info.connection.setPaintStyle({ stroke: wireColor, strokeWidth: 4 });
    console.log(`Wire from ${sourceId} set to ${wireColor}`); // Debug log (remove if not needed)
  });

  // Required connections: unsorted list for iteration order in auto-connect, sorted Set for checking
  const requiredPairs = [
    "pointR-pointC",
    "pointR-pointE",
    "pointB-pointG",
    "pointB-pointA2",
    "pointA2-pointZ2",
    "pointL-pointD",
    "pointF-pointZ1",
    "pointA-pointA1",
    "pointL2-pointA4",
    "pointA4-pointZ4",
    "pointZ4-pointK",
    "pointI-pointJ",
    "pointJ-pointL1",
    "pointH-pointA3",
    "pointH-pointZ3"
  ];
  const requiredConnections = new Set(requiredPairs.map(pair => {
    const [a, b] = pair.split("-");
    return [a, b].sort().join("-");
  }));
  const allowedConnections = new Set(requiredConnections);

  const mcbImg = document.querySelector(".mcb-toggle");
  const starterHandle = document.querySelector(".starter-handle");

  let isDragging = false;
  let startX, startLeft, startTop;

  function startDrag(e) {
    if (e.button !== 0 || !connectionsVerified || !mcbOn) return;
    isDragging = true;
    startX = e.clientX;
    startLeft = parseFloat(starterHandle.style.left) || 16.67;
    startTop = parseFloat(starterHandle.style.top) || 37.04;
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    starterHandle.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const parentRect = starterHandle.parentElement.getBoundingClientRect();
    const deltaPercent = (deltaX / parentRect.width) * 100;
    const progress = (startLeft + deltaPercent - 16.67) / (68 - 16.67);
    const t = Math.max(0, Math.min(1, progress));  // Clamp t 0-1

    // Linear left
    const newLeft = 16.67 + t * (68 - 16.67);

    // Curved top: sinusoidal dip (negative for "up" arc; adjust 15 for height)
    const curveHeight = 15;  // % rise in middle
    const newTop = 37.04 - curveHeight * Math.sin(t * Math.PI);

    starterHandle.style.left = newLeft + '%';
    starterHandle.style.top = newTop + '%';
  }

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', endDrag);

    // Get current t from left (approx)
    const currentLeft = parseFloat(starterHandle.style.left) || 16.67;
    const currentT = (currentLeft - 16.67) / (68 - 16.67);
    const threshold = 0.5;
    let targetT = currentT > threshold ? 1 : 0;

    // Snap to target
    const targetLeft = 16.67 + targetT * (68 - 16.67);
    const targetTop = 37.04 - 15 * Math.sin(targetT * Math.PI);
    starterHandle.style.left = targetLeft + '%';
    starterHandle.style.top = targetTop + '%';

    const wasMoved = starterMoved;
    starterMoved = targetT === 1;
    if (starterMoved) {
      stepGuide.complete("starter");
      if (!wasMoved) {
        window.dispatchEvent(new CustomEvent(STARTER_MOVED_EVENT));
      }
    }
    starterHandle.style.cursor = (connectionsVerified && mcbOn && !starterMoved) ? 'grab' : 'default';
    updateControlLocks();
    updateRotorSpin();
    e.preventDefault();
  }

  function updateStarterUI() {
    if (!starterHandle) return;
    if (connectionsVerified && mcbOn && !starterMoved) {
      starterHandle.style.cursor = 'grab';
      starterHandle.onmousedown = startDrag;
      // Reset to start pos if needed
      starterHandle.style.left = '16.67%';
      starterHandle.style.top = '37.04%';
    } else {
      starterHandle.style.cursor = 'default';
      starterHandle.onmousedown = null;
      if (!starterMoved) {
        starterHandle.style.left = '16.67%';
        starterHandle.style.top = '37.04%';
      }
    }
    if (starterMoved) {
      starterHandle.classList.add('moved');
    } else {
      starterHandle.classList.remove('moved');
    }
  }

  function updateControlLocks() {
    const ready = connectionsVerified && mcbOn && starterMoved;
    const lampSelect = document.getElementById("number");
    const addBtn =
      findButtonByLabel("Add Table") ||
      findButtonByLabel("Add To Table") ||
      findButtonByLabel("Add");
    if (lampSelect) lampSelect.disabled = !ready;
    if (addBtn) addBtn.disabled = !ready;
    updateStarterUI();
    updateRotorSpin();
  }

  function setMcbState(isOn, options = {}) {
    if (!mcbImg) return;
    const { silent = false } = options;
    const wasOn = mcbOn;
    mcbOn = !!isOn;
    mcbImg.src = isOn ? "images/mcb-on.png" : "images/mcb-off.png";
    mcbImg.classList.toggle("is-on", mcbOn);
    if (!wasOn && mcbOn) {
      window.dispatchEvent(new CustomEvent(MCB_TURNED_ON_EVENT));
    }
    if (wasOn && !mcbOn) {
      starterMoved = false;
      if (starterHandle) {
        starterHandle.style.left = '16.67%';
        starterHandle.style.top = '37.04%';
        starterHandle.classList.remove('moved');
      }
      updateControlLocks();
      window.dispatchEvent(new CustomEvent(MCB_TURNED_OFF_EVENT));
      if (!silent) {
        alert("You turned off the MCB. Turn it back on to continue the experiment.");
      }
      return;
    }
    updateControlLocks();
    updateRotorSpin();
  }

  sharedControls.updateControlLocks = updateControlLocks;
  sharedControls.setMcbState = setMcbState;
  sharedControls.starterHandle = starterHandle;

  const mcbLabel = document.querySelector(".mcb-label");
  const mcbTargets = [mcbImg, mcbLabel].filter(Boolean);
  if (mcbTargets.length) {
    const handleMcbClick = function () {
      if (!connectionsVerified) {
        alert("Make and check the connections before turning on the MCB.");
        return;
      }
      const nextState = !mcbOn;
      setMcbState(nextState);
      if (nextState) {
        stepGuide.complete("mcb");
      }
    };

    mcbTargets.forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", handleMcbClick);
    });
  }

  // Click on label buttons (e.g., .point-R) to remove connections from corresponding point
  document.querySelectorAll('[class^="point-"]').forEach(btn => {
    btn.style.cursor = "pointer"; // Ensure pointer cursor
    btn.addEventListener("click", function () {
      const className = this.className;
      const match = className.match(/point-([A-Za-z0-9]+)/);
      if (match) {
        const pointId = "point" + match[1];
        const pointEl = document.getElementById(pointId);
        if (pointEl) {
          // Remove all connections where this point is source or target
          jsPlumb.getConnections({ source: pointId }).concat(jsPlumb.getConnections({ target: pointId }))
            .forEach(c => jsPlumb.deleteConnection(c));
          jsPlumb.repaintEverything();
        }
      }
    });
  });

  // Existing: make clickable elements (endpoint divs) removable
  document.querySelectorAll(".point").forEach(p => {
    p.style.cursor = "pointer";
    p.addEventListener("click", function () {
      const id = this.id;
      jsPlumb.getConnections({ source: id }).concat(jsPlumb.getConnections({ target: id }))
        .forEach(c => jsPlumb.deleteConnection(c));
      jsPlumb.repaintEverything();
    });
  });

  // Check button - Robust selection by text content (no ID needed)
  const checkBtn = findButtonByLabel("Check") || findButtonByLabel("Check Connections");
  if (checkBtn) {
    console.log("Check button found and wired."); // Debug log
    checkBtn.addEventListener("click", function () {
      if (window.labSpeech && typeof window.labSpeech.cancel === "function") {
        window.labSpeech.cancel();
      }
      const connections = jsPlumb.getAllConnections();
      const seenKeys = new Set();
      const illegal = [];

      connections.forEach(conn => {
        const key = [conn.sourceId, conn.targetId].sort().join("-");
        seenKeys.add(key);
        if (!allowedConnections.has(key)) {
          illegal.push(key);
        }
      });

      const missing = [];
      requiredConnections.forEach(req => {
        if (!seenKeys.has(req)) missing.push(req);
      });

      if (!missing.length && !illegal.length) {
        alert("Connections are correct. Click the MCB to turn it on.");
        connectionsVerified = true;
        starterMoved = false;
        window.dispatchEvent(new CustomEvent(CONNECTION_VERIFIED_EVENT));
        return;
      }

      const formatList = (list) => list.slice(0, 5).map(k => k.replace(/point/gi, "").replace(/-/g, " - ")).join(", ");
      let message = "Connection not correct";
      if (illegal.length) {
        message += `\nWrong/extra connections detected${illegal.length > 5 ? " (showing first few)" : ""}: ${formatList(illegal)}`;
      }
      if (missing.length) {
        message += `\nMissing ${missing.length} required connection(s)${missing.length > 5 ? " (showing first few)" : ""}: ${formatList(missing)}`;
      }
      alert(message);
      setMcbState(false, { silent: true });
      connectionsVerified = false;
      starterMoved = false;
      updateControlLocks();
      stepGuide.reset();
      const lampSel = document.getElementById("number");
      if (lampSel) lampSel.disabled = true;
      const addBtn =
        findButtonByLabel("Add Table") ||
        findButtonByLabel("Add To Table") ||
        findButtonByLabel("Add");
      if (addBtn) addBtn.disabled = true;
    });
  } else {
    console.error("Check button not found! Looking for a control labeled 'Check' or 'Check Connections'. Add it or check HTML.");
  }

  // Auto Connect button - creates all required connections automatically
  const autoConnectBtn = findButtonByLabel("Auto Connect");
  if (autoConnectBtn) {
    autoConnectBtn.addEventListener("click", function () {
      isAutoConnecting = true;
      suppressAllAutoVoices = true;
      suppressGuideDuringAutoConnect = true;

      const guideWasActive =
        typeof window.isGuideActive === "function" && window.isGuideActive();

      if (window.labSpeech && typeof window.labSpeech.stop === "function") {
        window.labSpeech.stop();
      }

      if (!guideWasActive) {
        resetSpeakButtonUI();
      }

      const runBatch = typeof jsPlumb.batch === "function" ? jsPlumb.batch.bind(jsPlumb) : (fn => fn());

      runBatch(function () {
        // Clear existing connections so the final wiring is always correct
        if (typeof jsPlumb.deleteEveryConnection === "function") {
          jsPlumb.deleteEveryConnection();
        } else {
          jsPlumb.getAllConnections().forEach(c => jsPlumb.deleteConnection(c));
        }

        const seenKeys = new Set();
        requiredPairs.forEach((req, index) => connectRequiredPair(req, seenKeys, index));
      });

      // Ensure rendering completes; retry any missing connections once.
      requestAnimationFrame(() => {
        jsPlumb.repaintEverything();

        const seenKeys = getSeenConnectionKeys();
        const missing = [];
        requiredConnections.forEach(req => {
          const [a, b] = req.split("-");
          const key = a && b ? connectionKey(a, b) : req;
          if (!seenKeys.has(key)) missing.push(req);
        });

        if (missing.length) {
          console.warn("Auto Connect: retrying missing connection(s):", missing);
          runBatch(() => {
            const seenNow = getSeenConnectionKeys();
            missing.forEach(req => connectRequiredPair(req, seenNow));
          });
          requestAnimationFrame(() => jsPlumb.repaintEverything());
        }

        console.log(`Auto Connect: required=${requiredConnections.size}, missing after retry=${missing.length}`);
      });

      setTimeout(() => {
        suppressAllAutoVoices = false;
        suppressGuideDuringAutoConnect = false;
        isAutoConnecting = false;
      }, 0);
    });
  } else {
    console.error("Auto Connect button not found! Looking for '.pill-btn' with text 'Auto Connect'.");
  }

  // Speaking button - guided voice prompts for wiring
  (function initSpeakingGuidance() {
    function waitForVoices(callback) {
      if (!("speechSynthesis" in window)) {
        callback();
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        callback();
      } else {
        const handler = () => {
          if (typeof window.speechSynthesis.removeEventListener === "function") {
            window.speechSynthesis.removeEventListener("voiceschanged", handler);
          } else {
            window.speechSynthesis.onvoiceschanged = null;
          }
          callback();
        };
        if (typeof window.speechSynthesis.addEventListener === "function") {
          window.speechSynthesis.addEventListener("voiceschanged", handler);
        } else {
          window.speechSynthesis.onvoiceschanged = handler;
        }
      }
    }

    const speakBtn = document.querySelector(".speak-btn");
    if (!speakBtn || !window.labSpeech) return;

    let guideActive = false;
    window.isGuideActive = () => guideActive;

    let currentStep = 0;

    const steps = requiredPairs
      .map((pair) => pair.split("-"))
      .filter((pair) => pair.length === 2)
      .map(([from, to]) => {
        const fromLabel = String(from).replace(/^point/i, "");
        const toLabel = String(to).replace(/^point/i, "");
        return {
          from,
          to,
          text: `Connect point ${fromLabel} to point ${toLabel}.`
        };
      });

    function speakCurrentStep() {
      if (!guideActive) return;
      const step = steps[currentStep];
      if (!step) return;
      window.labSpeech.speak(step.text);
    }

    function getFirstIncompleteStepIndex() {
      const currentConnections = jsPlumb.getAllConnections();
      const connectedSet = new Set(
        currentConnections.map((conn) => connectionKey(conn.sourceId, conn.targetId))
      );

      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const key = connectionKey(step.from, step.to);
        if (!connectedSet.has(key)) {
          return i;
        }
      }

      return steps.length;
    }

    function activateGuideUI() {
      guideActive = true;
      speakBtn.classList.add("guiding");
      speakBtn.setAttribute("aria-pressed", "true");
      const label = speakBtn.querySelector(".speak-btn__label");
      if (label) label.textContent = "Guiding...";
    }

    function speakGuide(text) {
      const speechSupported =
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof window.SpeechSynthesisUtterance === "function";
      if (!speechSupported) {
        stopGuide({ resetUI: true });
        return;
      }
      window.labSpeech.speak(text);
    }

    function getLabStage() {
      if (starterMoved) return "starter_on";
      if (mcbOn) return "dc_on";
      if (connectionsVerified) return "checked";
      return "connections";
    }

    function startGuide() {
      if (suppressGuideDuringAutoConnect || isAutoConnecting) return;

      const stage = getLabStage();
      switch (stage) {
        case "checked":
          activateGuideUI();
          speakGuide("Connections are already verified. Now turn on the M C B.");
          return;
        case "dc_on":
          activateGuideUI();
          speakGuide("M C B is already on. Now move the starter handle from left to right.");
          return;
        case "starter_on":
          activateGuideUI();
          speakGuide("Starter is already on. Now select the number of bulbs from the lamp load.");
          return;
        default:
          break;
      }

      const firstIncomplete = getFirstIncompleteStepIndex();
      if (firstIncomplete >= steps.length) {
        activateGuideUI();
        speakGuide(
          "All connections are completed. Now click on the Check button to confirm the connection."
        );
        return;
      }

      activateGuideUI();
      currentStep = firstIncomplete;

      waitForVoices(() => {
        if (!("speechSynthesis" in window)) {
          speakCurrentStep();
          return;
        }
        const intro = new SpeechSynthesisUtterance("Lets connect the components.");
        const voice = pickPreferredVoice();
        if (voice) intro.voice = voice;
        intro.lang = (voice && voice.lang) || "en-US";
        intro.rate = 0.85;
        intro.pitch = 0.9;
        intro.volume = 1;

        intro.onend = () => {
          if (guideActive) speakCurrentStep();
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(intro);
      });
    }

    function stopGuide({ resetUI = false } = {}) {
      if (!guideActive && !resetUI) return;

      guideActive = false;
      currentStep = 0;

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      if (resetUI) {
        resetSpeakButtonUI();
      }
    }

    window.labSpeech.isActive = () => guideActive;
    window.labSpeech.say = (text, options = {}) => {
      if (!guideActive || !text) return Promise.resolve();
      const interrupt = options.interruptFirst !== false;
      return window.labSpeech.speak(text, { interrupt });
    };
    window.labSpeech.sayLines = (lines, options = {}) => {
      if (!guideActive || !Array.isArray(lines) || !lines.length) return Promise.resolve();
      const interrupt = options.interruptFirst !== false;
      return window.labSpeech.speak(lines[0], { interrupt });
    };
    window.labSpeech.cancel = () => {
      window.labSpeech.stop();
    };

    window.stopGuideSpeech = () => {
      stopGuide({ resetUI: true });
    };

    speakBtn.addEventListener("click", () => {
      if (guideActive) {
        stopGuide({ resetUI: true });
      } else {
        startGuide();
      }
    });

    jsPlumb.bind("connection", function (info) {
      if (!guideActive) return;
      if (suppressGuideDuringAutoConnect || isAutoConnecting) return;

      const made = connectionKey(info.sourceId, info.targetId);
      if (!requiredConnections.has(made)) {
        const wrongA = info.sourceId.replace("point", "");
        const wrongB = info.targetId.replace("point", "");
        window.labSpeech.speak(
          `Wrong connection. You connected ${wrongA} to ${wrongB}. Please follow the required connections.`
        );
        return;
      }

      currentStep = getFirstIncompleteStepIndex();
      if (currentStep >= steps.length) {
        speakGuide(
          "Now all the connections are completed. Please click on the Check button to confirm the connections."
        );
        return;
      }

      speakCurrentStep();
    });

    jsPlumb.bind("connectionDetached", function () {
      if (!guideActive) return;
      if (suppressGuideDuringAutoConnect || isAutoConnecting) return;
      currentStep = Math.max(0, getFirstIncompleteStepIndex());
    });

    window.addEventListener(CONNECTION_VERIFIED_EVENT, function () {
      if (!guideActive) return;
      window.labSpeech.speak("Connections verified. Click the M C B to turn it on.");
    });

    window.addEventListener(MCB_TURNED_ON_EVENT, function () {
      if (!guideActive) return;
      window.labSpeech.speak("Now, move the starter handle from left to right.");
    });

    window.addEventListener(STARTER_MOVED_EVENT, function () {
      if (!guideActive) return;
      window.labSpeech.speak("Now, select the number of bulbs from the lamp load.");
    });

    window.addEventListener(MCB_TURNED_OFF_EVENT, function () {
      if (!guideActive) return;
      window.labSpeech.speak("M C B is turned off. Turn it on to continue.");
    });
  })();

  // Lock every point to its initial coordinates so resizing the window cannot drift them
  const pinnedSelectors = [
    ".point",
    ".point-R", ".point-B", ".point-L", ".point-A", ".point-F",
    ".point-C", ".point-D", ".point-E", ".point-G", ".point-H", ".point-I", ".point-J", ".point-K",
    ".point-A1", ".point-Z1", ".point-A2", ".point-Z2", ".point-A3", ".point-Z3", ".point-A4", ".point-Z4",
    ".point-L1", ".point-L2"
  ];
  const basePositions = new Map();
  function captureBasePositions() {
    basePositions.clear();
    document.querySelectorAll(pinnedSelectors.join(", ")).forEach(el => {
      const parent = el.offsetParent;
      if (!parent) return;
      basePositions.set(el, {
        left: el.offsetLeft,
        top: el.offsetTop
      });
    });
  }
  function lockPointsToBase() {
    if (!basePositions.size) {
      captureBasePositions();
    }
    basePositions.forEach((base, el) => {
      el.style.left = `${base.left}px`;
      el.style.top = `${base.top}px`;
    });
    if (window.jsPlumb) {
      jsPlumb.repaintEverything();
    }
  }
  const initPinnedPoints = () => {
    captureBasePositions();
    lockPointsToBase();
  };
  if (document.readyState === "complete") {
    initPinnedPoints();
  } else {
    window.addEventListener("load", initPinnedPoints);
  }
  window.addEventListener("resize", lockPointsToBase);
  });
}

 
const NEEDLE_TRANSFORM_TRANSLATE = "translate(-50%, -82.5%)";

// Calibrated for the 0-30 A ammeters and 0-410 V voltmeters used in this lab.
const AMMETER_MIN_ANGLE = -73.4;
const AMMETER_MID_ANGLE = 0;
const AMMETER_MAX_ANGLE = 91.4;

const VOLTMETER_MIN_ANGLE = -70.6;
const VOLTMETER_MID_ANGLE = 0;
const VOLTMETER_MAX_ANGLE = 86.6;

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Piecewise linear mapping: [minValue..midValue] -> [minAngle..midAngle], [midValue..maxValue] -> [midAngle..maxAngle]
function valueToMeterAngle(value, { minValue, midValue, maxValue, minAngle, midAngle, maxAngle }) {
  const v = clamp(Number(value) || 0, minValue, maxValue);

  if (v <= midValue) {
    const t = (v - minValue) / (midValue - minValue || 1);
    return minAngle + (midAngle - minAngle) * t;
  } else {
    const t = (v - midValue) / (maxValue - midValue || 1);
    return midAngle + (maxAngle - midAngle) * t;
  }
}

function currentToAngle(currentValue) {
  // Ammeter artwork: 0-30 A with 15 at top center
  return valueToMeterAngle(currentValue, {
    minValue: 0,
    midValue: 15,
    maxValue: 30,
    minAngle: AMMETER_MIN_ANGLE,
    midAngle: AMMETER_MID_ANGLE,
    maxAngle: AMMETER_MAX_ANGLE
  });
}

function voltageToAngle(voltageValue) {
  // Voltmeter artwork: 0-410 V with 180 at top center (compressed right span).
  return valueToMeterAngle(voltageValue, {
    minValue: 0,
    midValue: 180,
    maxValue: 410,
    minAngle: VOLTMETER_MIN_ANGLE,
    midAngle: VOLTMETER_MID_ANGLE,
    maxAngle: VOLTMETER_MAX_ANGLE
  });
}
 
(function initObservations() {
  const sessionStartMs = Date.now();
  const sessionStart =
    typeof window.sessionStart === "number" ? window.sessionStart : sessionStartMs;
  if (typeof window.sessionStart !== "number") {
    window.sessionStart = sessionStart;
  }
  const minGraphPoints = 6;
  const lampSelect = document.getElementById("number");
  const bulbs = Array.from(document.querySelectorAll(".lamp-bulb"));

  const observationBody = document.getElementById("observationBody");
  const graphBars = document.getElementById("graphBars");
  const graphPlot = document.getElementById("graphPlot");
  const graphSection = document.querySelector(".graph-section");
  const graphCanvas = document.querySelector(".graph-canvas");

  const addTableBtn =
    findButtonByLabel("Add Table") ||
    findButtonByLabel("Add To Table") ||
    findButtonByLabel("Add");
  const graphBtn = findButtonByLabel("Graph");
  const resetBtn = findButtonByLabel("Reset");
  const printBtn = findButtonByLabel("Print");
  const reportBtn = findButtonByLabel("Report");

  const needle1 = document.querySelector(".meter-needle1"); // Ammeter-1 (motor current)
  const needle2 = document.querySelector(".meter-needle2"); // Ammeter-2 (load current)
  const needle3 = document.querySelector(".meter-needle3"); // Voltmeter-1 (supply voltage)
  const needle4 = document.querySelector(".meter-needle4"); // Voltmeter-2 (terminal voltage)

  // Reading sets pulled from the legacy implementation
  const ammeter1Readings = [3, 3.6, 5.4, 6.8, 8, 10, 11.5, 13, 14.2, 15.2];
  const voltmeter1Readings = [225, 225, 225, 225, 225, 225, 225, 225, 225, 225];
  const ammeter2Readings = [1.2, 2.8, 3.2, 3.6, 5.5, 7, 8.1, 10.2, 11, 12.7];
  const voltmeter2Readings = [220, 212, 208, 205, 200, 195, 189, 184, 179, 176];
  // Optional manual needle angles (degrees) per bulb index; edit as needed.
  const ammeter1ManualAngles = [-62, -60.4, -50.1, -47.5, -42.0, -32.1, -26.0, -15.9, -6.3, 2.8];
  const ammeter2ManualAngles = [-69.1, -59.2, -57.0, -55.9, -49.6, -45.4, -37, -28.0, -27, -18];
  const voltmeter1ManualAngles = [1.9, 1.9, 1.9, 1.9, 1.9, 1.9, 1.9, 1.9, 1.9, 1.9];
  const voltmeter2ManualAngles = [0.3, -5.9, -7.5, -7.7, -7.9, -7.8, -7.4, -6.8, -14.9, -15.7];

  const readingsRecorded = [];
  let selectedIndex = -1;
  let readingArmed = false;

  function speechIsActive() {
    return (
      typeof window !== "undefined" &&
      window.labSpeech &&
      typeof window.labSpeech.isActive === "function" &&
      window.labSpeech.isActive()
    );
  }

  function speak(text) {
    if (!text || !speechIsActive()) return;
    if (window.labSpeech && typeof window.labSpeech.say === "function") {
      window.labSpeech.say(text, { interruptFirst: true });
    }
  }

  function speakOrAlert(text) {
    if (!text) return;
    if (speechIsActive()) speak(text);
    else alert(text);
  }

  function updateGraphControls() {
    if (graphBtn) graphBtn.disabled = readingsRecorded.length < minGraphPoints;
    if (reportBtn) reportBtn.disabled = readingsRecorded.length < minGraphPoints;
  }

  function enforceReady(action) {
    if (!connectionsVerified) {
      speakOrAlert("You have to check the connections first.");
      if (action === "lampSelect" && lampSelect) {
        lampSelect.value = "";
        selectedIndex = -1;
        readingArmed = false;
        updateBulbs(0);
        updateNeedles(-1);
      }
      return false;
    }
    if (!mcbOn) {
      speakOrAlert("Turn on the MCB before continuing.");
      return false;
    }
    if (!starterMoved) {
      speakOrAlert("You have to move starter handle from left to right");
      return false;
    }
    return true;
  }

  function setNeedleRotation(el, angleDeg) {
    if (!el) return;
    el.style.transform = `${NEEDLE_TRANSFORM_TRANSLATE} rotate(${angleDeg}deg)`;
  }

  function resolveAngle(manualAngles, idx, fallbackAngle) {
    const manual = manualAngles && Number.isFinite(manualAngles[idx]) ? manualAngles[idx] : null;
    return Number.isFinite(manual) ? manual : fallbackAngle;
  }

  function updateBulbs(count) {
    bulbs.forEach((bulb, idx) => {
      const isOn = idx < count;
      bulb.src = isOn ? "images/on-bulb.png" : "images/off-bulb.png";
      bulb.classList.toggle("on", isOn);
      bulb.classList.toggle("off", !isOn);
    });
  }

  /* ✅ REPLACED: calibrated updateNeedles() (uses global currentToAngle/voltageToAngle) */
  function updateNeedles(idx) {
    const safeIdx = Number.isFinite(idx) ? idx : -1;

    if (safeIdx < 0) {
      // park needles at 0
      setNeedleRotation(needle1, currentToAngle(0));
      setNeedleRotation(needle2, currentToAngle(0));
      setNeedleRotation(needle3, voltageToAngle(0));
      setNeedleRotation(needle4, voltageToAngle(0));
      return;
    }

    setNeedleRotation(
      needle1,
      resolveAngle(ammeter1ManualAngles, safeIdx, currentToAngle(ammeter1Readings[safeIdx]))
    );
    setNeedleRotation(
      needle2,
      resolveAngle(ammeter2ManualAngles, safeIdx, currentToAngle(ammeter2Readings[safeIdx]))
    );
    setNeedleRotation(
      needle3,
      resolveAngle(voltmeter1ManualAngles, safeIdx, voltageToAngle(voltmeter1Readings[safeIdx]))
    );
    setNeedleRotation(
      needle4,
      resolveAngle(voltmeter2ManualAngles, safeIdx, voltageToAngle(voltmeter2Readings[safeIdx]))
    );
  }

  /* ===== everything below remains SAME as your current code ===== */

  function renderGraph() {
    if (readingsRecorded.length < minGraphPoints) {
      speakOrAlert(`Please take at least ${minGraphPoints} readings in the table.`);
      return;
    }

    const currents = readingsRecorded.map(r => r.current);
    const voltages = readingsRecorded.map(r => r.voltage);

    function ensurePlotly() {
      if (window.Plotly) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.plot.ly/plotly-3.0.1.min.js";
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    ensurePlotly()
      .then(() => {
        if (!graphPlot) return;

        const trace = {
          x: currents,
          y: voltages,
          mode: "lines+markers",
          type: "scatter",
          marker: { color: "#1b6fb8", size: 8 },
          line: { color: "#1b6fb8", width: 3 }
        };
        const layout = {
          title: { text: "<b>Voltage (V) vs Load Current (A)</b>" },
          margin: { l: 60, r: 20, t: 40, b: 50 },
          xaxis: {
            title: "<b>Load Current (A)</b>",
            gridcolor: "rgba(0, 0, 0, 0.07)",
            tickmode: "array",
            tickvals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
          },
          yaxis: { title: "<b>Voltage (V)</b>", gridcolor: "rgba(0, 0, 0, 0.07)" },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)"
        };

        if (graphBars) graphBars.style.display = "none";
        graphPlot.style.display = "block";
        if (graphCanvas) graphCanvas.classList.add("is-plotting");

        window.Plotly.newPlot(graphPlot, [trace], layout, { displaylogo: false, responsive: true });
        stepGuide.complete("graph");
        updateGraphControls();
        speak(
          "The graph of terminal voltage versus load current has been plotted. Your experiment is now complete. You may view the report by clicking the Report button, then use Print to print the page or Reset to start again."
        );
      })
      .catch(() => {
        alert("Unable to load graphing library. Please check your connection and try again.");
      });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generateReport() {
    const tableEl = document.getElementById("observationTable");
    if (!tableEl) {
      speakOrAlert("Report table not found.");
      return;
    }

    const rows = Array.from(tableEl.rows || []);
    const observationRows = [];
    const currentValues = [];
    const voltageValues = [];

    rows.slice(1).forEach((row) => {
      const cells = Array.from(row.cells);
      if (cells.length >= 3) {
        const entry = {
          sNo: cells[0].textContent.trim() || (observationRows.length + 1),
          current: cells[1].textContent.trim(),
          voltage: cells[2].textContent.trim()
        };
        observationRows.push(entry);
        const cVal = parseFloat(entry.current);
        const vVal = parseFloat(entry.voltage);
        if (!Number.isNaN(cVal)) currentValues.push(cVal);
        if (!Number.isNaN(vVal)) voltageValues.push(vVal);
      }
    });

    const now = new Date();
    const css = `
body {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: #f3f6fb;
  color: #1f2d3d;
  margin: 40px auto;
  max-width: 960px;
  padding: 32px;
  background-color: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5e9f2;
  box-shadow: 0 10px 30px rgba(31, 45, 61, 0.12);
  line-height: 1.65;
}
h1, h2, h3 { color: #1f2d3d; margin-top: 0; font-weight: 700; }
h1 {
  font-size: 28px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 3px solid #2f7bfa;
}
h2 { font-size: 22px; margin-bottom: 10px; color: #2b3f55; }
h3 { font-size: 18px; margin-bottom: 8px; }
.section {
  background: linear-gradient(135deg, #f8fbff 0%, #f3f6fb 100%);
  padding: 20px 22px;
  margin-bottom: 28px;
  border-radius: 12px;
  border: 1px solid #e5e9f2;
  box-shadow: 0 4px 12px rgba(31,45,61,0.06);
}
.label { font-weight: 600; color: #1f2d3d; }
ul { padding-left: 20px; margin-top: 10px; }
.two-column-list { column-count: 2; column-gap: 40px; list-style-position: inside; margin-top: 10px; }
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.info-card {
  background: #fff;
  border: 1px solid #e5e9f2;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 4px 10px rgba(31,45,61,0.05);
  font-size: 14px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
  box-shadow: 0 2px 10px rgba(31, 45, 61, 0.06);
  background-color: white;
  border-radius: 10px;
  overflow: hidden;
}
th, td {
  border: 1px solid #e5e9f2;
  padding: 12px;
  text-align: center;
  font-size: 15px;
}
th {
  background: linear-gradient(135deg, #2f7bfa 0%, #1f62d0 100%);
  color: white;
  font-weight: 700;
  letter-spacing: 0.2px;
}
tr:nth-child(even) { background-color: #f8fbff; }
.graph {
  text-align: center;
  margin-top: 24px;
  padding: 20px;
  border: 1px solid #e5e9f2;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(31,45,61,0.06);
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 26px;
  gap: 12px;
  flex-wrap: wrap;
}
.header-row h1 { flex: 1; }
.badge {
  padding: 8px 14px;
  border-radius: 20px;
  background: #e8f1ff;
  color: #1f62d0;
  font-weight: 600;
  font-size: 13px;
}
.print-btn {
  margin-top: 28px;
  padding: 12px 28px;
  font-size: 16px;
  background: linear-gradient(to right, #2f7bfa, #1f62d0);
  color: white;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.25s ease;
}
.print-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(31,45,61,0.12);
}
@media print { .print-btn { display:none; } body { margin:0; box-shadow:none; border:none; padding:0; } }
    `;

    const startTimeText = new Date(sessionStart).toLocaleTimeString();
    const endTime = Date.now();
    const endTimeText = new Date(endTime).toLocaleTimeString();
    const durationMinutes = Math.max(0, Math.round(((endTime - sessionStart) / 60000) * 10) / 10);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Simulation Report</title>
  <style>${css}</style>
  <script src="https://cdn.plot.ly/plotly-3.0.1.min.js"></script>
</head>
<body>
  <div class="header-row">
    <h1>Virtual Lab Simulation Report</h1>
  </div>

  <div class="section">
    <p class="badge">DC Machines Lab</p>
    <p><span class="label">Experiment Title:</span> Load Test on DC Shunt Generator</p>
    <p><span class="label">Date:</span> ${now.toLocaleDateString()}</p>
    <div class="info-grid">
      <div class="info-card"><span class="label">Start Time:</span><br>${startTimeText}</div>
      <div class="info-card"><span class="label">End Time:</span><br>${endTimeText}</div>
      <div class="info-card"><span class="label">Total Time Spent:</span><br>${durationMinutes} minutes</div>
    </div>
  </div>

  <div class="section">
    <h2>Summary</h2>
    <h3>Aim</h3>
    <p style="text-align:justify;">Study the DC shunt generator characteristics by varying lamp load, recording terminal voltage and current, and plotting the V-I relationship.</p>

    <h3>Procedure Summary</h3>
    <p style="text-align:justify;">Connections were completed as instructed, supply was enabled, lamp load was varied, readings of load current and terminal voltage were taken for multiple steps, and a graph was generated to observe the voltage regulation.</p>

    <h3>Components</h3>
    <ul class="two-column-list">
      <li>DC Shunt Generator</li>
      <li>DC Motor (prime mover)</li>
      <li>MCB / Supply</li>
      <li>Lamp Load Bank</li>
      <li>Voltmeter (0-240 V)</li>
      <li>Ammeter (0-20 A)</li>
      <li>Connecting Leads</li>
    </ul>

    <h3>Key Parameters</h3>
    <ul class="two-column-list">
      <li>Rated Voltage: 220-240 V DC</li>
      <li>Load Type: Resistive Lamp Bank</li>
      <li>Voltmeter Range: 0-240 V</li>
      <li>Ammeter Range: 0-20 A</li>
    </ul>
  </div>

  <div class="section">
    <h3>Observation Table</h3>
    <table>
      <thead>
        <tr><th>S.No.</th><th>Current (A)</th><th>Voltage (V)</th></tr>
      </thead>
      <tbody>
        ${observationRows.length ? observationRows.map(function (r) {
            return "<tr><td>" + r.sNo + "</td><td>" + r.current + "</td><td>" + r.voltage + "</td></tr>";
        }).join("") : "<tr><td colspan='3'>No readings recorded.</td></tr>"}
      </tbody>
    </table>
  </div>

  <div class="section graph">
    <h3>Graph</h3>
    <div id="report-graph" style="position:relative;width:100%;height:360px;"></div>
  </div>

  <button class="print-btn" onclick="window.print()">PRINT</button>

  <script>
    (function() {
      var currents = ${JSON.stringify(currentValues)};
      var voltages = ${JSON.stringify(voltageValues)};
      if (currents.length && voltages.length) {
        var trace = { x: currents, y: voltages, type: 'scatter', mode: 'lines+markers', name: 'V vs I', line: { color: '#3498db' } };
        var layout = {
          title: { text: 'Terminal Voltage vs Load Current' },
          xaxis: {
            title: 'Load Current (A)',
            tickmode: 'array',
            tickvals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
          },
          yaxis: { title: 'Voltage (V)' },
          margin: { t: 60, r: 20, l: 60, b: 60 }
        };
        Plotly.newPlot('report-graph', [trace], layout, {displaylogo:false});
      } else {
        document.getElementById('report-graph').innerHTML = '<em>No readings available to plot.</em>';
      }
    })();
  </script>
</body>
</html>`;

    const reportWindow = window.open("", "report");
    if (!reportWindow) {
      speakOrAlert("Please allow pop-ups to view the report.");
      return;
    }

    try {
      reportWindow.document.open("text/html", "replace");
      reportWindow.document.write(html);
      reportWindow.document.close();
      reportWindow.focus();
      speak(
        "Report opened in a new tab. You can print it from the report window, or use Reset to start again."
      );
    } catch (err) {
      try {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        reportWindow.location = url;
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 5000);
      } catch (err2) {
        console.error("Report generation failed:", err2);
        speakOrAlert("Unable to render the report. Please disable popup blockers and try again.");
      }
    }
  }

  function addRowToTable(idx) {
    if (!observationBody) return;
    const placeholder = observationBody.querySelector(".placeholder-row");
    if (placeholder) placeholder.remove();

    const row = document.createElement("tr");
    const serial = readingsRecorded.length; // already includes new entry
    const a2 = ammeter2Readings[idx];
    const v2 = voltmeter2Readings[idx];

    row.innerHTML = `<td>${serial}</td><td>${a2}</td><td>${v2}</td>`;
    observationBody.appendChild(row);
  }

  function handleAddReading() {
    if (!enforceReady("addReading")) return;
    if (selectedIndex < 0) {
      speakOrAlert("Select the number of bulbs first.");
      return;
    }
    if (!readingArmed) {
      speakOrAlert("Change the bulb selection to add the next reading.");
      return;
    }
    if (readingsRecorded.length >= 10) {
      speakOrAlert("You can only add maximum 10 readings in the table. Now, click on Graph button.");
      return;
    }

    const load = selectedIndex + 1;
    if (readingsRecorded.some((reading) => reading.load === load)) {
      speakOrAlert("This bulb load already exists in the table. Choose a different load.");
      readingArmed = false;
      return;
    }
    readingsRecorded.push({
      load,
      current: ammeter2Readings[selectedIndex],
      voltage: voltmeter2Readings[selectedIndex]
    });

    addRowToTable(selectedIndex);
    readingArmed = false;
    stepGuide.complete("reading");

    updateGraphControls();

    if (readingsRecorded.length < minGraphPoints) {
      speak("Once again, change the bulb selection.");
    } else if (readingsRecorded.length >= minGraphPoints && readingsRecorded.length < 10) {
      speak("Now, you can plot the graph by clicking on the Graph button or add more readings to the table.");
    }
  }

  function handleSelectionChange() {
    if (!enforceReady("lampSelect")) {
      lampSelect.value = "";
      selectedIndex = -1;
      readingArmed = false;
      updateBulbs(0);
      updateNeedles(-1);
      return;
    }

    const count = parseInt(lampSelect.value, 10);
    if (isNaN(count) || count < 1 || count > 10) {
      selectedIndex = -1;
      readingArmed = false;
      updateBulbs(0);
      updateNeedles(-1);
      return;
    }

    selectedIndex = count - 1;
    readingArmed = true;

    updateBulbs(count);
    updateNeedles(selectedIndex);

    if (readingsRecorded.length === 0) {
      speak("Press the Add To Table button to insert the values into the table.");
    } else {
      speak("Click the Add To Table button again.");
    }
  }

  function resetObservations() {
    const wasGuiding =
      typeof window.isGuideActive === "function" && window.isGuideActive();

    if (window.labSpeech && typeof window.labSpeech.stop === "function") {
      window.labSpeech.stop();
    }

    const speechSupported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function";

    if (wasGuiding && speechSupported && window.labSpeech && typeof window.labSpeech.speak === "function") {
      window.labSpeech.speak("Experiment reset. You can start again.", {
        onend: () => {
          if (typeof window.stopGuideSpeech === "function") {
            window.stopGuideSpeech();
          } else {
            resetSpeakButtonUI();
          }
        }
      });
    } else {
      resetSpeakButtonUI();
      if (typeof window.stopGuideSpeech === "function") {
        window.stopGuideSpeech();
      }
    }

    if (window.jsPlumb) {
      if (typeof jsPlumb.deleteEveryConnection === "function") jsPlumb.deleteEveryConnection();
      else if (typeof jsPlumb.getAllConnections === "function") jsPlumb.getAllConnections().forEach(c => jsPlumb.deleteConnection(c));
      if (typeof jsPlumb.repaintEverything === "function") jsPlumb.repaintEverything();
    }

    readingsRecorded.length = 0;

    if (observationBody) {
      observationBody.innerHTML = `<tr class="placeholder-row"><td colspan="3">No readings added yet.</td></tr>`;
    }

    selectedIndex = -1;
    readingArmed = false;
    if (lampSelect) lampSelect.value = "";

    updateBulbs(0);
    updateNeedles(-1);

    if (graphBars) graphBars.style.display = "block";
    if (graphPlot) {
      graphPlot.innerHTML = "";
      graphPlot.style.display = "none";
    }
    if (graphCanvas) graphCanvas.classList.remove("is-plotting");

    connectionsVerified = false;
    starterMoved = false;
    mcbOn = false;

    sharedControls.setMcbState(false, { silent: true });

    const starter = sharedControls.starterHandle || document.querySelector(".starter-handle");
    if (starter) {
      starter.style.left = "16.67%";
      starter.style.top = "37.04%";
      starter.classList.remove("moved");
    }

    sharedControls.updateControlLocks();
    updateRotorSpin();
    stepGuide.reset();
    updateGraphControls();
  }

  if (lampSelect) {
    lampSelect.addEventListener("change", handleSelectionChange);
    lampSelect.disabled = true;
  }

  if (addTableBtn) {
    addTableBtn.addEventListener("click", handleAddReading);
    addTableBtn.disabled = true;
  }

  if (graphBtn) {
    graphBtn.disabled = true;
    graphBtn.addEventListener("click", function () {
      renderGraph();
      if (graphSection && typeof graphSection.scrollIntoView === "function") {
        graphSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", resetObservations);
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      if (speechIsActive()) {
        window.labSpeech.speak("Opening the print dialog.");
      }
      window.print();
    });
  }
  if (reportBtn) {
    reportBtn.addEventListener("click", generateReport);
    reportBtn.disabled = true;
  }

  window.addEventListener(MCB_TURNED_OFF_EVENT, function () {
    selectedIndex = -1;
    if (lampSelect) {
      lampSelect.value = "";
      lampSelect.disabled = true;
    }
    if (addTableBtn) addTableBtn.disabled = true;
    updateBulbs(0);
    updateNeedles(-1);
  });

  // initialize defaults
  updateBulbs(0);
  updateNeedles(-1);
  updateGraphControls();
  sharedControls.updateControlLocks();

  window.addEventListener(CONNECTION_VERIFIED_EVENT, function () {
    connectionsVerified = true;
    starterMoved = false;
    mcbOn = false;
    sharedControls.setMcbState(false, { silent: true });
    sharedControls.updateControlLocks();
    updateRotorSpin();
    stepGuide.complete("connect");
  });
})();

 

(function initHoverDefinitions() {
  function setup() {
    if (document.querySelector(".hover-tooltip")) return;
    if (!document.body) return;

    const tooltipLayer = document.createElement("div");
    tooltipLayer.className = "hover-tooltip";
    tooltipLayer.innerHTML =
      '<div class="hover-tooltip__body"><div class="hover-tooltip__accent"></div><div class="hover-tooltip__text"></div></div>';
    const tooltipText = tooltipLayer.querySelector(".hover-tooltip__text");
    document.body.appendChild(tooltipLayer);

    const tooltips = [
      {
        id: "mcb",
        selector: ".mcb-toggle, .mcb-label, .mcb-block",
        text: "MCB: Main supply breaker for the setup; trips on overload/short-circuit to protect the circuit and users."
      },
      {
        id: "starter",
        selector: ".starter-block, .starter-body, .starter-handle, .starter-label",
        text: "3-Point Starter: Limits the DC motor starting current and provides no-volt/overload protection; drag the handle after turning ON the MCB."
      },
      {
        id: "lamp-load",
        selector: ".lampboard-dropdown, #number, .lamp-board, .lamp-grid, .lamp-bulb, .lamp-load-label",
        text: "Lamp Load: Variable resistive bulb bank used to change load; select the number of bulbs to vary current and observe voltage regulation."
      },
      {
        id: "ammeter-1",
        selector: ".meters > .meter-card:nth-of-type(1), #ammter1-label",
        text: "Ammeter-1: Measures the motor/supply current (connected in series)."
      },
      {
        id: "voltmeter-1",
        selector: ".meters > .meter-card:nth-of-type(2), #voltmeter1-label",
        text: "Voltmeter-1: Measures the supply/line voltage (connected across the source)."
      },
      {
        id: "ammeter-2",
        selector: ".meters > .meter-card:nth-of-type(3), #ammter2-label",
        text: "Ammeter-2: Measures the load current through the lamp load (connected in series with the load)."
      },
      {
        id: "voltmeter-2",
        selector: ".meters > .meter-card:nth-of-type(4), #voltmeter2-label",
        text: "Voltmeter-2: Measures the generator terminal voltage (connected across generator terminals)."
      },
      {
        id: "dc-motor",
        selector: ".motor-box, .motor-box img, .dc-motor-label",
        text: "DC Shunt Motor: Prime mover converting electrical power to mechanical power to drive the generator."
      },
      {
        id: "coupler",
        selector: ".coupler, .coupler img",
        text: "Coupling/Shaft: Mechanical link that transfers torque from the motor to the generator."
      },
      {
        id: "dc-generator",
        selector: ".generator-box, .generator-body, .generator-rotor, .dc-generator-label",
        text: "DC Shunt Generator: Converts mechanical power from the motor into DC output for the load; terminal voltage is measured on Voltmeter-2."
      },
      {
        id: "observation-table",
        selector: ".observation-section, #observationTable, #observationBody",
        text: "Observation Table: Stores recorded readings of load current and terminal voltage for plotting and the report."
      },
      {
        id: "output-graph",
        selector: ".graph-section, #graphPlot, #graphBars",
        text: "Output Graph: Plots terminal voltage (V) versus load current (A) using the readings you add to the table."
      },
      {
        id: "instructions",
        selector: ".instructions-wrapper, .instructions-btn, .instructions-panel, #instructionModal",
        text: "Instructions: Shows the required wiring sequence and the steps to run the experiment."
      },
      {
        id: "controls",
        selector: "#pill-stack",
        text: "Controls: Use these buttons to run the simulation (Speaking, Check, Auto Connect, Add To Table, Reset)."
      }
    ];

    tooltips.forEach(({ selector }) => {
      document.querySelectorAll(selector).forEach((el) => el.removeAttribute("title"));
    });

    let activeTarget = null;

    function findEntry(target) {
      if (!target || target.nodeType !== 1) return null;
      for (const entry of tooltips) {
        const match = target.closest(entry.selector);
        if (match) return { match, text: entry.text, id: entry.id };
      }
      return null;
    }

    function moveTip(event) {
      const padding = 16;
      const offsetX = 14;
      const offsetY = 14;

      const maxLeft = window.innerWidth - tooltipLayer.offsetWidth - padding;
      const maxTop = window.innerHeight - tooltipLayer.offsetHeight - padding;

      const desiredLeft = event.clientX + offsetX;
      const desiredTop = event.clientY + offsetY;

      tooltipLayer.style.left = Math.max(padding, Math.min(desiredLeft, maxLeft)) + "px";
      tooltipLayer.style.top = Math.max(padding, Math.min(desiredTop, maxTop)) + "px";
    }

    function showTip(text, event) {
      if (!tooltipText) return;
      tooltipText.textContent = text;
      moveTip(event);
      tooltipLayer.classList.add("show");
    }

    function hideTip() {
      tooltipLayer.classList.remove("show");
    }

      function attachLeaveHandler(target) {
        target.addEventListener(
          "mouseleave",
          () => {
            if (activeTarget === target) {
              activeTarget = null;
              hideTip();
            }
          },
          { once: true }
        );
      }

      document.addEventListener("click", function (event) {
        const found = findEntry(event.target);
        if (!found) {
          if (activeTarget) {
            activeTarget = null;
            hideTip();
          }
          return;
        }
        if (activeTarget === found.match) {
          activeTarget = null;
          hideTip();
          return;
        }
        activeTarget = found.match;
        showTip(found.text, event);
        attachLeaveHandler(activeTarget);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          activeTarget = null;
          hideTip();
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();

(function initChatbotWidget() {
  function setup() {
    const widget = document.querySelector(".chatbot-widget");
    if (!widget) return;

    const toggleBtn = widget.querySelector(".chatbot-launcher");
    const panel = widget.querySelector(".chatbot-panel");
    const closeBtn = widget.querySelector(".chatbot-panel-close");
    const iframe = panel?.querySelector("iframe");
    const placeholder = panel?.querySelector(".chatbot-panel-placeholder");
    const chatUrl = (panel?.dataset?.chatUrl || "").trim();
    const notifyAudio = document.getElementById("chatbot-notification-audio");

    if (!toggleBtn || !panel || !closeBtn || !iframe || !placeholder) return;

    let isLoaded = false;
    let notifiedOnce = false;

    function openPanel() {
      panel.classList.add("open");
      widget.classList.add("chatbot-open");
      toggleBtn.setAttribute("aria-expanded", "true");

      if (chatUrl && chatUrl !== "#") {
        if (!isLoaded) {
          placeholder.style.display = "flex";
          placeholder.textContent = "Loading assistant...";

          iframe.addEventListener(
            "load",
            () => {
              isLoaded = true;
              iframe.classList.add("chatbot-frame-visible");
              placeholder.style.display = "none";
            },
            { once: true }
          );

          iframe.src = chatUrl;
        }
      } else {
        placeholder.style.display = "flex";
        placeholder.innerHTML =
          'Set the <strong>data-chat-url</strong> on the chatbot panel to your chatbot link.';
      }

      if (!notifiedOnce && notifyAudio) {
        notifiedOnce = true;
        try {
          notifyAudio.currentTime = 0;
          const playResult = notifyAudio.play();
          if (playResult && typeof playResult.catch === "function") {
            playResult.catch(() => {});
          }
        } catch {
          // ignore playback errors (autoplay restrictions)
        }
      }
    }

    function closePanel() {
      panel.classList.remove("open");
      widget.classList.remove("chatbot-open");
      toggleBtn.setAttribute("aria-expanded", "false");
    }

    toggleBtn.addEventListener("click", () => {
      if (panel.classList.contains("open")) {
        closePanel();
      } else {
        openPanel();
      }
    });

    closeBtn.addEventListener("click", closePanel);

    document.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape" && panel.classList.contains("open")) {
        closePanel();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
// Components popup (auto on load + open from icon)
(function () {
  const modal = document.getElementById("componentsModal");
  if (!modal) return;

  const closeEls = modal.querySelectorAll("[data-components-close]");
  const skipBtn = modal.querySelector("[data-components-skip]");
  const openBtns = document.querySelectorAll("[data-open-components]");

  // If you want "Skip" to only close for now (not remember), remove STORAGE_KEY lines.
  const STORAGE_KEY = "vl_components_skipped";

  function openComponentsModal({ force = false } = {}) {
    if (!force) {
      try {
        if (localStorage.getItem(STORAGE_KEY) === "1") return;
      } catch (e) {}
    }
    modal.classList.remove("is-hidden");
    document.body.classList.add("is-modal-open");
  }

  function closeComponentsModal({ skip = false } = {}) {
    modal.classList.add("is-hidden");
    document.body.classList.remove("is-modal-open");

    if (skip) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch (e) {}
    }
  }

  // Auto open when page loads
  window.addEventListener("load", () => {
    setTimeout(() => openComponentsModal(), 250);
  });

  // Open via icons/buttons
  openBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openComponentsModal({ force: true }); // even if skipped
    });
  });

  // Close buttons + backdrop
  closeEls.forEach((el) => el.addEventListener("click", () => closeComponentsModal()));
  if (skipBtn) skipBtn.addEventListener("click", () => closeComponentsModal({ skip: true }));

  // ESC key to close
  document.addEventListener("keydown", (e) => {
    if (modal.classList.contains("is-hidden")) return;
    if (e.key === "Escape") closeComponentsModal();
  });
})();
