let connectionsVerified = false;
let starterMoved = false;
let mcbOn = false;
const CONNECTION_VERIFIED_EVENT = "connections-verified";
const MCB_TURNED_OFF_EVENT = "mcb-turned-off";
const WIRE_CURVINESS = -50;

const generatorRotor = document.querySelector(".generator-rotor");

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
      copy: "Choose the number of bulbs and click Add Table to log the paired readings."
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

const sharedControls = {
  updateControlLocks: () => {},
  setMcbState: () => {},
  starterHandle: null
};

function findButtonByLabel(label) {
  if (!label) return null;
  const target = label.trim().toLowerCase();
  const buttons = document.querySelectorAll(".pill-btn, .graph-pill-btn");
  return Array.from(buttons).find(btn => btn.textContent.trim().toLowerCase() === target) || null;
}

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

    starterMoved = targetT === 1;
    if (starterMoved) {
      stepGuide.complete("starter");
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
    const addBtn = Array.from(document.querySelectorAll('.pill-btn')).find(btn => btn.textContent.trim() === 'Add Table');
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

  if (mcbImg) {
    mcbImg.style.cursor = "pointer";
    mcbImg.addEventListener("click", function () {
      if (!connectionsVerified) {
        alert("Make and check the connections before turning on the MCB.");
        return;
      }
      const nextState = !mcbOn;
      setMcbState(nextState);
      if (nextState) {
        stepGuide.complete("mcb");
      }
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
      const addBtn = Array.from(document.querySelectorAll('.pill-btn')).find(btn => btn.textContent.trim() === 'Add Table');
      if (addBtn) addBtn.disabled = true;
    });
  } else {
    console.error("Check button not found! Looking for a control labeled 'Check' or 'Check Connections'. Add it or check HTML.");
  }

  // Auto Connect button - creates all required connections automatically
  const autoConnectBtn = findButtonByLabel("Auto Connect");
  if (autoConnectBtn) {
    autoConnectBtn.addEventListener("click", function () {
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
    });
  } else {
    console.error("Auto Connect button not found! Looking for '.pill-btn' with text 'Auto Connect'.");
  }

  // Speaking button - guided voice prompts for wiring
  (function initSpeakingGuidance() {
    const speakingBtn = findButtonByLabel("Speaking") || findButtonByLabel("Start Speaking");
    if (!speakingBtn) return;

    const speechSupported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function";

    const originalLabel = speakingBtn.textContent;
    const highlightClass = "speak-glow";

    if (!speechSupported) {
      speakingBtn.disabled = true;
      speakingBtn.title = "Speech synthesis is not available in this browser.";
      return;
    }

    let speakingActive = false;
    let voicesReady = false;
    let speechPrimed = false;
    let speechQueue = Promise.resolve();
    let currentPromptIndex = -1;

    function getTerminalLabel(pointId) {
      return String(pointId || "").replace(/^point/i, "");
    }

    function clearHighlights() {
      document.querySelectorAll(`.${highlightClass}`).forEach((el) => {
        el.classList.remove(highlightClass);
      });
    }

    function highlightTerminals(pointIds) {
      clearHighlights();
      pointIds.forEach((pointId) => {
        const label = getTerminalLabel(pointId);
        const pointEl = document.getElementById(pointId);
        if (pointEl) pointEl.classList.add(highlightClass);
        const btnEl = document.querySelector(`.point-${label}`);
        if (btnEl) btnEl.classList.add(highlightClass);
      });
    }

    function ensureVoicesReady() {
      if (voicesReady) return Promise.resolve();
      return new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
          voicesReady = true;
          resolve();
          return;
        }
        let done = false;
        const cleanup = () => {
          if (typeof window.speechSynthesis.removeEventListener === "function") {
            window.speechSynthesis.removeEventListener("voiceschanged", onChanged);
          } else if (window.speechSynthesis.onvoiceschanged === onChanged) {
            window.speechSynthesis.onvoiceschanged = null;
          }
        };
        const finish = () => {
          if (done) return;
          done = true;
          voicesReady = true;
          cleanup();
          resolve();
        };
        const onChanged = () => finish();
        if (typeof window.speechSynthesis.addEventListener === "function") {
          window.speechSynthesis.addEventListener("voiceschanged", onChanged);
        } else {
          window.speechSynthesis.onvoiceschanged = onChanged;
        }
        setTimeout(finish, 700);
      });
    }

    function pickVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || !voices.length) return null;
      return (
        voices.find((v) => (v.lang || "").toLowerCase().startsWith("en") && !/google/i.test(v.name)) ||
        voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) ||
        voices[0]
      );
    }

    function stopSpeechOutput() {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {
        // no-op
      }
    }

    function speakOnce(text, { interrupt = false } = {}) {
      if (!text) return Promise.resolve();
      return ensureVoicesReady().then(() => {
        if (interrupt) stopSpeechOutput();
        return new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(String(text));
          const voice = pickVoice();
          if (voice) utterance.voice = voice;
          utterance.rate = 0.95;
          utterance.pitch = 1;
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        });
      });
    }

    function queueSpeech(lines, { interruptFirst = true } = {}) {
      const list = Array.isArray(lines) ? lines.filter(Boolean) : [];
      if (!list.length) return Promise.resolve();
      speechQueue = speechQueue.then(() => {
        if (interruptFirst) stopSpeechOutput();
        const run = (idx) => {
          if (idx >= list.length) return Promise.resolve();
          return speakOnce(list[idx], { interrupt: idx === 0 && interruptFirst }).then(() => run(idx + 1));
        };
        return run(0);
      });
      return speechQueue;
    }

    function primeSpeechEngine() {
      if (speechPrimed) return Promise.resolve();
      return ensureVoicesReady().then(
        () =>
          new Promise((resolve) => {
            const primer = new SpeechSynthesisUtterance(".");
            primer.volume = 0;
            primer.onend = () => resolve();
            primer.onerror = () => resolve();
            window.speechSynthesis.speak(primer);
          })
      ).then(() => {
        speechPrimed = true;
      });
    }

    function getNextMissingIndex() {
      const seen = getSeenConnectionKeys();
      for (let i = 0; i < requiredPairs.length; i += 1) {
        const [a, b] = requiredPairs[i].split("-");
        if (!a || !b) continue;
        if (!seen.has(connectionKey(a, b))) return i;
      }
      return -1;
    }

    function promptNext({ forceSpeak = false } = {}) {
      if (!speakingActive) return;

      const idx = getNextMissingIndex();
      if (idx < 0) {
        clearHighlights();
        if (currentPromptIndex !== -2 || forceSpeak) {
          currentPromptIndex = -2;
          queueSpeech(
            [
              "All connections are complete.",
              "Now click the Check button to verify the connections.",
              "If the connections are correct, click the M C B to turn it on, then move the starter handle.",
              "Select the number of bulbs and press Add Table to record readings.",
              "After adding at least six readings, press Graph to plot the curve."
            ],
            { interruptFirst: true }
          );
        }
        return;
      }

      const [a, b] = requiredPairs[idx].split("-");
      highlightTerminals([a, b]);

      if (forceSpeak || idx !== currentPromptIndex) {
        currentPromptIndex = idx;
        const from = getTerminalLabel(a);
        const to = getTerminalLabel(b);
        queueSpeech([`Please connect ${from} to ${to}.`], { interruptFirst: true });
      }
    }

    function setSpeakingUiState(active) {
      speakingBtn.textContent = active ? "Stop Speaking" : originalLabel;
      speakingBtn.setAttribute("aria-pressed", active ? "true" : "false");
    }

    function startSpeaking() {
      if (speakingActive) return;
      speakingActive = true;
      currentPromptIndex = -1;
      setSpeakingUiState(true);

      // Avoid mixed modes: auto connect fights with guided prompts.
      if (autoConnectBtn) autoConnectBtn.disabled = true;

      speechQueue = Promise.resolve();
      stopSpeechOutput();
      primeSpeechEngine().finally(() => {
        queueSpeech(["Guided speaking started. Follow the highlighted terminals."], { interruptFirst: true }).finally(() => {
          promptNext({ forceSpeak: true });
        });
      });
    }

    function stopSpeaking() {
      speakingActive = false;
      setSpeakingUiState(false);
      if (autoConnectBtn) autoConnectBtn.disabled = false;
      clearHighlights();
      stopSpeechOutput();
      speechQueue = Promise.resolve();
      currentPromptIndex = -1;
    }

    speakingBtn.addEventListener("click", () => {
      if (speakingActive) stopSpeaking();
      else startSpeaking();
    });

    // React to new connections while guidance is active.
    jsPlumb.bind("connection", function (info) {
      if (!speakingActive) return;

      const key = connectionKey(info.sourceId, info.targetId);
      if (!requiredConnections.has(key)) {
        // Not part of the wiring plan: remove it and re-prompt.
        if (info.connection) {
          jsPlumb.deleteConnection(info.connection);
          jsPlumb.repaintEverything();
        }
        const nextIdx = getNextMissingIndex();
        if (nextIdx >= 0) {
          const [a, b] = requiredPairs[nextIdx].split("-");
          highlightTerminals([a, b]);
          queueSpeech([`Wrong connection. Please connect ${getTerminalLabel(a)} to ${getTerminalLabel(b)}.`], {
            interruptFirst: true
          });
        }
        return;
      }

      // Correct/allowed connection: move on (skips any already-connected steps).
      promptNext();
    });

    // If a required wire is removed during guidance, keep the prompt aligned.
    jsPlumb.bind("connectionDetached", function () {
      if (!speakingActive) return;
      promptNext({ forceSpeak: false });
    });

    // Reset should always stop speech and clear highlights.
    const resetBtn = findButtonByLabel("Reset");
    resetBtn?.addEventListener("click", stopSpeaking);

    window.addEventListener(CONNECTION_VERIFIED_EVENT, function () {
      if (!speakingActive) return;
      queueSpeech(["Connections verified. Click the M C B to turn it on."], { interruptFirst: true });
    });

    window.addEventListener(MCB_TURNED_OFF_EVENT, function () {
      if (!speakingActive) return;
      queueSpeech(["M C B is turned off. Turn it on to continue."], { interruptFirst: true });
    });
  })();

  // Lock every point to its initial coordinates so resizing the window cannot drift them
  const pinnedSelectors = [
    ".point",
    ".point-R", ".point-B", ".point-L", ".point-F", ".point-A",
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

// -----------------------------------------------
// Observation table + meter needle interactions
// -----------------------------------------------
(function initObservations() {
  const lampSelect = document.getElementById("number");
  const bulbs = Array.from(document.querySelectorAll(".lamp-bulb"));

  const liveA1 = document.getElementById("liveA1");
  const liveV1 = document.getElementById("liveV1");
  const liveA2 = document.getElementById("liveA2");
  const liveV2 = document.getElementById("liveV2");

  const observationBody = document.getElementById("observationBody");
  const graphBars = document.getElementById("graphBars");
  const graphPlot = document.getElementById("graphPlot");
  const graphSection = document.querySelector(".graph-section");

  const addTableBtn = findButtonByLabel("Add Table") || findButtonByLabel("Add");
  const graphBtn = findButtonByLabel("Graph");
  const resetBtn = findButtonByLabel("Reset");
  const printBtn = findButtonByLabel("Print");

  const needle1 = document.querySelector(".meter-needle1");
  const needle2 = document.querySelector(".meter-needle2");
  const needle3 = document.querySelector(".meter-needle3");
  const needle4 = document.querySelector(".meter-needle4");

  // Reading sets pulled from the legacy implementation
  const ammeter1Readings = [3, 3.6, 5.4, 6.8, 8, 10, 11.5, 13, 14.2, 15.2];
  const voltmeter1Readings = [225, 225, 225, 225, 225, 225, 225, 225, 225, 225];
  const ammeter2Readings = [1.2, 2.8, 3.2, 3.6, 5.5, 7, 8.1, 10.2, 11, 12.7];
  const voltmeter2Readings = [220, 212, 208, 205, 200, 195, 189, 184, 179, 176];

  const readingsRecorded = [];
  let selectedIndex = -1;

  function enforceReady(action) {
    if (!connectionsVerified) {
      alert("You have to check the connections first.");
      if (action === "lampSelect" && lampSelect) {
        lampSelect.value = "";
        selectedIndex = -1;
        updateBulbs(0);
        updateLiveReadings(-1);
        updateNeedles(-1);
      }
      return false;
    }
    if (!mcbOn) {
      alert("Turn on the MCB before continuing.");
      return false;
    }
    if (!starterMoved) {
      alert("You have to move starter handle from left to right");
      return false;
    }
    return true;
  }

  function setNeedleRotation(el, angleDeg) {
    if (!el) return;
    el.style.transform = `translate(-50%, -90%) rotate(${angleDeg}deg)`;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function currentToAngle(currentValue, maxCurrent = 20) {
    // Ammeter artwork scale: 0–20 A
    const minAngle = -74;
    const maxAngle = 74;
    const safeValue = clamp(currentValue, 0, maxCurrent);
    const ratio = safeValue / maxCurrent;
    return minAngle + (maxAngle - minAngle) * ratio;
  }

  function voltageToAngle(voltageValue) {
    // Voltmeter artwork scale: 0–240 V
    const minAngle = -63;
    const maxAngle = 63;
    const safeVoltage = clamp(voltageValue, 0, 240);
    const ratio = safeVoltage / 240;
    return minAngle + (maxAngle - minAngle) * ratio;
  }

  function updateBulbs(count) {
    bulbs.forEach((bulb, idx) => {
      const isOn = idx < count;
      bulb.src = isOn ? "images/on-bulb.png" : "images/off-bulb.png";
      bulb.classList.toggle("on", isOn);
      bulb.classList.toggle("off", !isOn);
    });
  }

  function updateLiveReadings(idx) {
    if (idx < 0) {
      [liveA1, liveV1, liveA2, liveV2].forEach((el) => {
        if (el) el.textContent = "--";
      });
      return;
    }
    const a1 = ammeter1Readings[idx];
    const v1 = voltmeter1Readings[idx];
    const a2 = ammeter2Readings[idx];
    const v2 = voltmeter2Readings[idx];

    if (liveA1) liveA1.textContent = `${a1.toFixed(1)} A`;
    if (liveV1) liveV1.textContent = `${v1.toFixed(0)} V`;
    if (liveA2) liveA2.textContent = `${a2.toFixed(1)} A`;
    if (liveV2) liveV2.textContent = `${v2.toFixed(0)} V`;
  }

  function updateNeedles(idx) {
    if (idx < 0) {
      // park needles at 0 reading
      setNeedleRotation(needle1, currentToAngle(0));
      setNeedleRotation(needle2, currentToAngle(0));
      setNeedleRotation(needle3, voltageToAngle(0));
      setNeedleRotation(needle4, voltageToAngle(0));
      return;
    }
    setNeedleRotation(needle1, currentToAngle(ammeter1Readings[idx]));
    setNeedleRotation(needle2, currentToAngle(ammeter2Readings[idx]));
    setNeedleRotation(needle3, voltageToAngle(voltmeter1Readings[idx]));
    setNeedleRotation(needle4, voltageToAngle(voltmeter2Readings[idx]));
  }

  function renderGraph() {
    const minPoints = 6;
    if (readingsRecorded.length < minPoints) {
      alert(`Add at least ${minPoints} readings, then press the Graph button.`);
      return;
    }

    const currents = readingsRecorded.map(r => r.current);
    const voltages = readingsRecorded.map(r => r.voltage);

    // Keep bars visible until graph is successfully drawn
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

    ensurePlotly().then(() => {
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
        xaxis: { title: "<b>Load Current (A)</b>" },
        yaxis: { title: "<b>Voltage (V)</b>" },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)"
      };

      // Hide bar fallback only after successful render
      if (graphBars) graphBars.style.display = "none";
      graphPlot.style.display = "block";

      window.Plotly.newPlot(graphPlot, [trace], layout, { displaylogo: false, responsive: true });
      stepGuide.complete("graph");
    }).catch(() => {
      alert("Unable to load graphing library. Please check your connection and try again.");
    });
  }

  function addRowToTable(idx) {
    if (!observationBody) return;

    // remove placeholder
    const placeholder = observationBody.querySelector(".placeholder-row");
    if (placeholder) placeholder.remove();

    const row = document.createElement("tr");
    const serial = readingsRecorded.length; // readingsRecorded already includes the new entry
    const a2 = ammeter2Readings[idx];
    const v2 = voltmeter2Readings[idx];

    row.innerHTML = `<td>${serial}</td><td>${a2}</td><td>${v2}</td>`;
    observationBody.appendChild(row);
  }

  function handleAddReading() {
    if (!enforceReady("addReading")) return;
    if (selectedIndex < 0) return; // no selection, do nothing
    if (readingsRecorded.length >= 10) return; // cap silently
    const load = selectedIndex + 1;
    readingsRecorded.push({
      load,
      current: ammeter2Readings[selectedIndex],
      voltage: voltmeter2Readings[selectedIndex]
    });
    addRowToTable(selectedIndex);
    stepGuide.complete("reading");
  }

  function handleSelectionChange() {
    if (!enforceReady("lampSelect")) {
      lampSelect.value = "";
      selectedIndex = -1;
      updateBulbs(0);
      updateLiveReadings(-1);
      updateNeedles(-1);
      return;
    }
    const count = parseInt(lampSelect.value, 10);
    if (isNaN(count) || count < 1 || count > 10) {
      selectedIndex = -1;
      updateBulbs(0);
      updateLiveReadings(-1);
      updateNeedles(-1);
      return;
    }
    selectedIndex = count - 1;
    updateBulbs(count);
    updateLiveReadings(selectedIndex);
    updateNeedles(selectedIndex);
  }

  function resetObservations() {
    if (window.jsPlumb) {
      if (typeof jsPlumb.deleteEveryConnection === "function") {
        jsPlumb.deleteEveryConnection();
      } else if (typeof jsPlumb.getAllConnections === "function") {
        jsPlumb.getAllConnections().forEach(c => jsPlumb.deleteConnection(c));
      }
      if (typeof jsPlumb.repaintEverything === "function") {
        jsPlumb.repaintEverything();
      }
    }
    readingsRecorded.length = 0;
    if (observationBody) {
      observationBody.innerHTML = `<tr class="placeholder-row"><td colspan="3">No readings added yet.</td></tr>`;
    }
    selectedIndex = -1;
    if (lampSelect) lampSelect.value = "";
    updateBulbs(0);
    updateLiveReadings(-1);
    updateNeedles(-1);
    if (graphBars) graphBars.style.display = "block";
    if (graphPlot) {
      graphPlot.innerHTML = "";
      graphPlot.style.display = "none";
    }
    connectionsVerified = false;
    starterMoved = false;
    mcbOn = false;
    sharedControls.setMcbState(false, { silent: true });
    const starter = sharedControls.starterHandle || document.querySelector(".starter-handle");
    if (starter) {
      starter.style.left = '16.67%';
      starter.style.top = '37.04%';
      starter.classList.remove('moved');
    }
    sharedControls.updateControlLocks();
    updateRotorSpin();
    stepGuide.reset();
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
    graphBtn.addEventListener("click", function () {
      renderGraph();
      if (graphSection && typeof graphSection.scrollIntoView === "function") {
        graphSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetObservations);
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  window.addEventListener(MCB_TURNED_OFF_EVENT, function () {
    selectedIndex = -1;
    if (lampSelect) {
      lampSelect.value = "";
      lampSelect.disabled = true;
    }
    if (addTableBtn) {
      addTableBtn.disabled = true;
    }
    updateBulbs(0);
    updateLiveReadings(-1);
    updateNeedles(-1);
  });

  // initialize defaults
  updateBulbs(0);
  updateLiveReadings(-1);
  updateNeedles(-1);
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

(function initInstructionModal() {
  const modal = document.getElementById("instructionModal");
  if (!modal) return;

  const closeBtn = modal.querySelector(".instruction-close");
  const backdrop = modal.querySelector(".instruction-overlay__backdrop");
  const openBtn = findButtonByLabel("Instructions");

  function openModal() {
    modal.classList.remove("is-hidden");
  }

  function closeModal() {
    modal.classList.add("is-hidden");
  }

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape" && !modal.classList.contains("is-hidden")) {
      closeModal();
    }
  });
})();
