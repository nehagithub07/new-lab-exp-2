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

  // endpoint options
  const endpointOptions = {
    endpoint: ["Image", { url: ringSvg, width: 26, height: 26 }],
    isSource: true,
    isTarget: true,
    maxConnections: -1,
    connector: ["Bezier", { curviness: 10 }],
    connectorStyle: { stroke: "#000", strokeWidth: 2 }
  };

  const container = document.querySelector(".top-row");
  if (container) {
    jsPlumb.setContainer(container);
  } else {
    console.warn('jsPlumb: container ".top-row" not found.');
  }

  // anchors for each point (you can tweak these)
  const anchors = {
    pointR: [1, 0.5, 1, 0],   // right side
    pointB: [0, 0.5, -1, 0],  // left side
    pointL: [1, 0.5, 1, 0],   // right
    pointF: [0, 0.5, -1, 0],  // left
    pointA: [1, 0.5, 1, 0],    // right
    pointC: [0, 0.5, -1, 0],
    pointD: [1, 0.5, 1, 0],   
  };

  // helper to safely add endpoint if element exists
  function addEndpointIfExists(id, anchor) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn("jsPlumb: element not found:", id);
      return;
    }
    // raise z-index so endpoint image stays visible above other elements
    el.style.zIndex = 2000;
    jsPlumb.addEndpoint(el, { anchor }, endpointOptions);
  }

  // add endpoints for the 5 points
  Object.keys(anchors).forEach(id => addEndpointIfExists(id, anchors[id]));

  // correct pairs used by your check logic
  const correctPairs = {
    pointR: "pointB",
    pointB: "pointR",
    pointL: "pointF",
    pointF: "pointL",
    pointA: "pointF",
    pointC: "pointA",
    pointD: "pointC"
  };

  // make clickable elements removable: ensure all connector buttons have class 'point'
  document.querySelectorAll(".point").forEach(p => {
    // ensure pointer cursor
    p.style.cursor = "pointer";
    p.addEventListener("click", function () {
      const id = this.id;
      // remove all connections where this element is source or target
      jsPlumb.getConnections({ source: id }).concat(jsPlumb.getConnections({ target: id }))
        .forEach(c => jsPlumb.deleteConnection(c));
    });
  });

  // Check button: make sure you have an element with id checkBtn (or update selector)
  const checkBtn = document.getElementById("checkBtn");
  if (checkBtn) {
    checkBtn.addEventListener("click", function () {
      const connections = jsPlumb.getAllConnections();
      if (connections.length < Object.keys(correctPairs).length) {
        alert("❌ Incomplete connection");
        return;
      }

      let correct = 0;
      connections.forEach(conn => {
        if (correctPairs[conn.sourceId] === conn.targetId) {
          conn.setPaintStyle({ stroke: "green", strokeWidth: 3 });
          correct++;
        } else {
          conn.setPaintStyle({ stroke: "red", strokeWidth: 3 });
        }
      });

      alert(
        correct === Object.keys(correctPairs).length
          ? "✅ Right Connection"
          : "❌ Correct the connection"
      );
    });
  } else {
    console.warn("No #checkBtn found — skip check button wiring.");
  }

  // optional: enable draggable
  jsPlumb.draggable(Object.keys(anchors).map(id => document.getElementById(id)).filter(Boolean));
});
