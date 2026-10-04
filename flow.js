/* =========================================================================
   FLOW FIELD — flow.js  (standalone, custom picker, 15 color modes)
   ========================================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("flowCanvas");
  var ctx    = canvas.getContext("2d");
  var TWO_PI = Math.PI * 2;

  /* -----------------------------------------------------------------------
     SEEDED RANDOM
  ----------------------------------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* -----------------------------------------------------------------------
     PERLIN NOISE
  ----------------------------------------------------------------------- */
  function makePerlin(rand) {
    var perm = new Uint8Array(256);
    for (var i = 0; i < 256; i++) perm[i] = i;
    for (var i = 255; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    var p = new Uint8Array(512);
    for (var i = 0; i < 512; i++) p[i] = perm[i & 255];

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + t * (b - a); }
    function grad(h, dx, dy) {
      switch (h & 7) {
        case 0: return  dx + dy;
        case 1: return -dx + dy;
        case 2: return  dx - dy;
        case 3: return -dx - dy;
        case 4: return  dx;
        case 5: return -dx;
        case 6: return  dy;
        default: return -dy;
      }
    }
    return function (x, y) {
      var X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      var u = fade(x), v = fade(y);
      var A = p[X] + Y, B = p[X + 1] + Y;
      return lerp(
        lerp(grad(p[A],     x,     y),   grad(p[B],     x - 1, y),   u),
        lerp(grad(p[A + 1], x,     y - 1), grad(p[B + 1], x - 1, y - 1), u),
        v
      );
    };
  }

  /* -----------------------------------------------------------------------
     COLOR HELPERS
  ----------------------------------------------------------------------- */
  function hexToRgb(hex) {
    var n = parseInt(hex.replace("#",""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(function(v){
      return ("0" + Math.round(v).toString(16)).slice(-2);
    }).join("");
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p2 = 2 * l - q;
    function hue(t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p2 + (q - p2) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p2 + (q - p2) * (2/3 - t) * 6;
      return p2;
    }
    return [Math.round(hue(h + 1/3) * 255),
            Math.round(hue(h)       * 255),
            Math.round(hue(h - 1/3) * 255)];
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r)      h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else               h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function lerpRgb(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
  }

  function multiLerp(stops, t) {
    // stops: array of rgb arrays, t in [0,1]
    if (t <= 0) return stops[0];
    if (t >= 1) return stops[stops.length - 1];
    var seg = (stops.length - 1) * t;
    var i   = Math.floor(seg);
    return lerpRgb(stops[i], stops[i + 1], seg - i);
  }

  /* -----------------------------------------------------------------------
     COLOR MODE LOGIC
  ----------------------------------------------------------------------- */
  function noiseScaleFor(fs) {
    return 0.0065 - (fs - 1) * (0.0065 - 0.0006) / 99;
  }

  function pickColor(s, x, y, W, H, rand, noiseVal) {
    // position parameter t (0–1)
    var t;
    switch (s.direction) {
      case "vertical":  t = y / H; break;
      case "diagonal":  t = (x / W + y / H) / 2; break;
      case "radial":
        var dx = x / W - 0.5, dy = y / H - 0.5;
        t = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
        break;
      case "chaotic":   t = rand(); break;
      default:          t = x / W; // horizontal
    }
    t = Math.max(0, Math.min(1, t));

    var hsl1 = rgbToHsl(s.c1[0], s.c1[1], s.c1[2]);
    var h1 = hsl1[0];

    switch (s.mode) {

      case "solid":
        return s.c1;

      case "gradient":
        return lerpRgb(s.c1, s.c2, t);

      case "tricolor":
        return t < 0.5
          ? lerpRgb(s.c1, s.c2, t * 2)
          : lerpRgb(s.c2, s.c3, (t - 0.5) * 2);

      case "multistop":
        return multiLerp([s.c1, s.c2, s.c3, s.c4], t);

      case "spectrum":
        return hslToRgb((h1 + t * 360) % 360, 72, 58);

      case "monochrome":
        return hslToRgb(h1, hsl1[1], 15 + t * 70);

      case "duotone":
        // dark extreme → light extreme; threshold at midpoint
        return t < 0.5 ? lerpRgb([10, 10, 20], s.c1, t * 2)
                       : lerpRgb(s.c1, [230, 230, 240], (t - 0.5) * 2);

      case "complementary": {
        var hComp = (h1 + 180) % 360;
        return hslToRgb(t < 0.5 ? h1 : hComp, 65, 55);
      }

      case "splitcomp": {
        var hues = [h1, (h1 + 150) % 360, (h1 + 210) % 360];
        return hslToRgb(hues[Math.floor(t * 3) % 3], 65, 55);
      }

      case "analogous": {
        var ha = (h1 - 30 + t * 60) % 360;
        if (ha < 0) ha += 360;
        return hslToRgb(ha, 68, 55);
      }

      case "triadic": {
        var hues3 = [h1, (h1 + 120) % 360, (h1 + 240) % 360];
        return hslToRgb(hues3[Math.floor(t * 3) % 3], 65, 55);
      }

      case "tetradic": {
        var hues4 = [h1, (h1+90)%360, (h1+180)%360, (h1+270)%360];
        return hslToRgb(hues4[Math.floor(t * 4) % 4], 65, 55);
      }

      case "warm": {
        // warm range: roughly 0–60° (reds, oranges, yellows)
        var hw = (s.seedOffset + t * 60) % 60;
        return hslToRgb(hw, 75, 55);
      }

      case "cool": {
        // cool range: 180–280° (cyans, blues, purples)
        var hc = 180 + (s.seedOffset + t * 100) % 100;
        return hslToRgb(hc, 65, 55);
      }

      case "noise": {
        // noiseVal is already in [-1,1]; map to full hue cycle
        var hn = ((noiseVal + 1) / 2) * 360;
        return hslToRgb(hn, 70, 55);
      }

      default:
        return s.c1;
    }
  }

  /* -----------------------------------------------------------------------
     READ STATE
  ----------------------------------------------------------------------- */
  function readState() {
    return {
      seed:        parseInt(document.getElementById("seed").value, 10) || 1,
      particles:   parseInt(document.getElementById("particles").value, 10),
      steps:       parseInt(document.getElementById("steps").value, 10),
      stepSize:    parseFloat(document.getElementById("stepSize").value),
      featureSize: parseInt(document.getElementById("featureSize").value, 10),
      curl:        parseFloat(document.getElementById("curl").value),
      lineWidth:   parseFloat(document.getElementById("lineWidth").value),
      opacity:     parseFloat(document.getElementById("opacity").value),
      mode:        document.getElementById("colorMode").value,
      direction:   document.getElementById("direction").value,
      c1:          hexToRgb(document.getElementById("color1").value),
      c2:          hexToRgb(document.getElementById("color2").value),
      c3:          hexToRgb(document.getElementById("color3").value),
      c4:          hexToRgb(document.getElementById("color4").value),
      bgColor:     document.getElementById("bgColor").value,
      bgTransparent: document.getElementById("bgTransparent").checked,
      landscape: [1600, 900],
      a17:       [1080, 2340],
      desktop:   [1920, 1080]
    };
    var W = sizes[s.size][0], H = sizes[s.size][1];
    canvas.width = W; canvas.height = H;

    if (s.bgTransparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = s.bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    var rand  = mulberry32(s.seed);
    var noise = makePerlin(rand);
    var scale = noiseScaleFor(s.featureSize);

    var cols  = Math.max(1, Math.ceil(Math.sqrt(s.particles * (W / H))));
    var rows  = Math.max(1, Math.ceil(s.particles / cols));
    var cellW = W / cols, cellH = H / rows;

    ctx.lineCap    = "round";
    ctx.lineJoin   = "round";
    ctx.lineWidth  = s.lineWidth;
    ctx.globalAlpha = s.opacity;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var px = c * cellW + rand() * cellW;
        var py = r * cellH + rand() * cellH;

        // sample noise at start for noise-driven mode & rotation jitter
        var nv = noise(px * scale, py * scale);
        var col = pickColor(s, px, py, W, H, rand, nv);

        ctx.strokeStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
        ctx.beginPath();
        var x = px, y = py;
        ctx.moveTo(x, y);
        for (var i = 0; i < s.steps; i++) {
          var a = noise(x * scale, y * scale) * TWO_PI * s.curl;
          x += Math.cos(a) * s.stepSize;
          y += Math.sin(a) * s.stepSize;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* -----------------------------------------------------------------------
     EXPORT
  ----------------------------------------------------------------------- */
  function exportPNG() {
    var seed = document.getElementById("seed").value;
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "flowfield-" + seed + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }, "image/png");
  }

  function randomSeed() {
    document.getElementById("seed").value = Math.floor(Math.random() * 900000) + 100000;
    schedule();
  }

  /* -----------------------------------------------------------------------
     SYNC DYNAMIC CONTROLS
     Show/hide color rows based on chosen mode
  ----------------------------------------------------------------------- */
  function syncDynamicControls() {
    var mode = document.getElementById("colorMode").value;
    var needs = {
      solid:         [1, 0, 0, 0],
      gradient:      [1, 1, 0, 0],
      tricolor:      [1, 1, 1, 0],
      multistop:     [1, 1, 1, 1],
      spectrum:      [1, 0, 0, 0],
      monochrome:    [1, 0, 0, 0],
      duotone:       [1, 0, 0, 0],
      complementary: [1, 0, 0, 0],
      splitcomp:     [1, 0, 0, 0],
      analogous:     [1, 0, 0, 0],
      triadic:       [1, 0, 0, 0],
      tetradic:      [1, 0, 0, 0],
      warm:          [0, 0, 0, 0],
      cool:          [0, 0, 0, 0],
      noise:         [0, 0, 0, 0]
    };
    var show = needs[mode] || [1, 0, 0, 0];
    ["color1Row", "color2Row", "color3Row", "color4Row"].forEach(function (id, i) {
      document.getElementById(id).classList.toggle("hidden", !show[i]);
    });

    // direction row only makes sense for position-based modes
    var positionBased = ["solid","gradient","tricolor","multistop","spectrum",
                         "monochrome","duotone","complementary","splitcomp",
                         "analogous","triadic","tetradic"];
    var showDir = positionBased.indexOf(mode) !== -1;
    document.getElementById("directionRow").classList.toggle("hidden", !showDir);
  }

  /* -----------------------------------------------------------------------
     CUSTOM COLOR PICKER
  ----------------------------------------------------------------------- */
  var CP = {
    overlay:   document.getElementById("colorPickerOverlay"),
    slCanvas:  document.getElementById("cpSLCanvas"),
    hueCanvas: document.getElementById("cpHueCanvas"),
    slCursor:  document.getElementById("cpSLCursor"),
    hueCursor: document.getElementById("cpHueCursor"),
    hexInput:  document.getElementById("cpHexInput"),
    hexPreview:document.getElementById("cpHexPreview"),
    presets:   document.getElementById("cpPresets"),
    title:     document.getElementById("cpTitle"),
    currentTarget: null,  // id of the hidden input being edited
    h: 0, s: 100, l: 50,  // current HSL

    PRESETS: [
      "#3b82f6","#6366f1","#a855f7","#ec4899","#f43f5e",
      "#f97316","#eab308","#22c55e","#14b8a6","#06b6d4",
      "#ffffff","#94a3b8","#475569","#1e293b","#000000",
      "#fde68a","#bbf7d0","#bfdbfe","#ddd6fe","#fce7f3"
    ]
  };

  function drawHueStrip() {
    var c = CP.hueCanvas;
    var w = c.width, h = c.height;
    // size canvas to its display size
    c.width  = c.offsetWidth  || 260;
    c.height = c.offsetHeight || 24;
    w = c.width; h = c.height;
    var grd = c.getContext("2d").createLinearGradient(0, 0, w, 0);
    for (var i = 0; i <= 12; i++) {
      grd.addColorStop(i / 12, "hsl(" + (i / 12 * 360) + ",100%,50%)");
    }
    var cx = c.getContext("2d");
    cx.fillStyle = grd;
    cx.fillRect(0, 0, w, h);
  }

  function drawSLSquare(hue) {
    var c = CP.slCanvas;
    c.width  = c.offsetWidth  || 260;
    c.height = c.offsetHeight || 200;
    var w = c.width, h = c.height;
    var cx = c.getContext("2d");
    // white → color gradient (horizontal)
    var gH = cx.createLinearGradient(0, 0, w, 0);
    gH.addColorStop(0, "hsl(" + hue + ",0%,100%)");
    gH.addColorStop(1, "hsl(" + hue + ",100%,50%)");
    cx.fillStyle = gH;
    cx.fillRect(0, 0, w, h);
    // transparent → black gradient (vertical)
    var gV = cx.createLinearGradient(0, 0, 0, h);
    gV.addColorStop(0, "rgba(0,0,0,0)");
    gV.addColorStop(1, "rgba(0,0,0,1)");
    cx.fillStyle = gV;
    cx.fillRect(0, 0, w, h);
  }

  function hslFromSLPos(x, y) {
    var w = CP.slCanvas.width  || 260;
    var h = CP.slCanvas.height || 200;
    var sx = Math.max(0, Math.min(1, x / w)); // 0=white,1=full-sat
    var ly = Math.max(0, Math.min(1, y / h)); // 0=light, 1=dark
    // convert to HSL: white→color horizontally, then darken vertically
    var lightness = (1 - ly) * (1 - sx / 2) * 100;
    var saturation = sx === 0 ? 0 : (100 * sx * (1 - ly)) / (1 - Math.abs(2 * lightness / 100 - 1) + 1e-9);
    saturation = Math.max(0, Math.min(100, saturation));
    lightness  = Math.max(0, Math.min(100, lightness));
    return { s: saturation, l: lightness };
  }

  function slPosFromHSL(s, l) {
    var w = CP.slCanvas.width  || 260;
    var h = CP.slCanvas.height || 200;
    // invert: find x (saturation) and y (lightness within that column)
    var lNorm = l / 100;
    var sNorm = s / 100;
    // x = saturation in the "white→full" axis
    var x = sNorm * (1 - Math.abs(2 * lNorm - 1)) / (2 * lNorm * (1 - lNorm) + 1e-9);
    x = Math.max(0, Math.min(1, x));
    var ly = 1 - lNorm / (1 - x / 2 + 1e-9);
    ly = Math.max(0, Math.min(1, ly));
    return { x: x * w, y: ly * h };
  }

  function updateCursors() {
    var hueW = CP.hueCanvas.width || 260;
    CP.hueCursor.style.left = (CP.h / 360 * hueW) + "px";
    var pos = slPosFromHSL(CP.s, CP.l);
    CP.slCursor.style.left = pos.x + "px";
    CP.slCursor.style.top  = pos.y + "px";
    var hex = rgbToHex.apply(null, hslToRgb(CP.h, CP.s, CP.l));
    CP.hexInput.value   = hex.slice(1);
    CP.hexPreview.style.background = hex;
  }

  function openPicker(targetId, labelText) {
    CP.currentTarget = targetId;
    CP.title.textContent = "Pick: " + labelText;

    // read current value
    var hex = document.getElementById(targetId).value || "#3b82f6";
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    CP.h = hsl[0]; CP.s = hsl[1]; CP.l = hsl[2];

    CP.overlay.classList.remove("hidden");
    // draw after a frame so canvas has rendered dimensions
    requestAnimationFrame(function () {
      drawHueStrip();
      drawSLSquare(CP.h);
      updateCursors();
      buildPresets();
    });
  }

  function buildPresets() {
    CP.presets.innerHTML = "";
    CP.PRESETS.forEach(function (hex) {
      var btn = document.createElement("button");
      btn.className = "cpPresetSwatch";
      btn.style.background = hex;
      btn.title = hex;
      btn.addEventListener("click", function () {
        var rgb = hexToRgb(hex);
        var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        CP.h = hsl[0]; CP.s = hsl[1]; CP.l = hsl[2];
        drawSLSquare(CP.h);
        updateCursors();
      });
      CP.presets.appendChild(btn);
    });
  }

  function applyPicker() {
    var hex = rgbToHex.apply(null, hslToRgb(CP.h, CP.s, CP.l));
    var hiddenInput = document.getElementById(CP.currentTarget);
    var swatchId    = CP.currentTarget + "Swatch";
    var swatch      = document.getElementById(swatchId);
    hiddenInput.value        = hex;
    if (swatch) swatch.style.background = hex;
    CP.overlay.classList.add("hidden");
    schedule();
  }

  // hue strip interaction
  function hueEventPos(e) {
    var rect = CP.hueCanvas.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function onHueChange(e) {
    e.preventDefault();
    CP.h = hueEventPos(e) * 360;
    drawSLSquare(CP.h);
    updateCursors();
  }

  CP.hueCanvas.addEventListener("mousedown",  function(e){ onHueChange(e); CP.hueCanvas.addEventListener("mousemove", onHueChange); });
  CP.hueCanvas.addEventListener("touchstart", function(e){ onHueChange(e); CP.hueCanvas.addEventListener("touchmove", onHueChange); }, {passive:false});
  document.addEventListener("mouseup",  function(){ CP.hueCanvas.removeEventListener("mousemove",  onHueChange); });
  document.addEventListener("touchend", function(){ CP.hueCanvas.removeEventListener("touchmove",  onHueChange); });

  // SL square interaction
  function slEventPos(e) {
    var rect = CP.slCanvas.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onSLChange(e) {
    e.preventDefault();
    var pos = slEventPos(e);
    var sl  = hslFromSLPos(pos.x, pos.y);
    CP.s = sl.s; CP.l = sl.l;
    updateCursors();
  }

  CP.slCanvas.addEventListener("mousedown",  function(e){ onSLChange(e); CP.slCanvas.addEventListener("mousemove", onSLChange); });
  CP.slCanvas.addEventListener("touchstart", function(e){ onSLChange(e); CP.slCanvas.addEventListener("touchmove", onSLChange); }, {passive:false});
  document.addEventListener("mouseup",  function(){ CP.slCanvas.removeEventListener("mousemove",  onSLChange); });
  document.addEventListener("touchend", function(){ CP.slCanvas.removeEventListener("touchmove",  onSLChange); });

  // hex input
  CP.hexInput.addEventListener("input", function () {
    var val = CP.hexInput.value.replace(/[^0-9a-fA-F]/g, "");
    if (val.length === 6) {
      var rgb = hexToRgb("#" + val);
      var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      CP.h = hsl[0]; CP.s = hsl[1]; CP.l = hsl[2];
      drawSLSquare(CP.h);
      updateCursors();
    }
  });

  document.getElementById("cpApply").addEventListener("click", applyPicker);
  document.getElementById("cpCancel").addEventListener("click", function () {
    CP.overlay.classList.add("hidden");
  });
  CP.overlay.addEventListener("click", function (e) {
    if (e.target === CP.overlay) CP.overlay.classList.add("hidden");
  });

  // open picker when any swatch is tapped
  document.querySelectorAll(".colorSwatch").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var targetId  = btn.getAttribute("data-target");
      var label     = btn.closest(".fieldRow").querySelector("label").textContent;
      openPicker(targetId, label);
    });
  });

  // bg swatch
  document.getElementById("bgColorSwatch").addEventListener("click", function () {
    openPicker("bgColor", "Background");
  });

  /* -----------------------------------------------------------------------
     WIRING
  ----------------------------------------------------------------------- */
  var sliders = [
    ["particles","particlesVal"],
    ["steps","stepsVal"],
    ["stepSize","stepSizeVal"],
    ["featureSize","featureSizeVal"],
    ["curl","curlVal"],
    ["lineWidth","lineWidthVal"],
    ["opacity","opacityVal"]
  ];
  sliders.forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    el.addEventListener("input", function () {
      document.getElementById(pair[1]).textContent = el.value;
      schedule();
    });
  });

  ["colorMode","direction","size"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () {
      syncDynamicControls();
      schedule();
    });
  });

  document.getElementById("bgTransparent").addEventListener("change", schedule);
  document.getElementById("seed").addEventListener("input", schedule);
  document.getElementById("btnRandomize").addEventListener("click", randomSeed);
  document.getElementById("btnGenerate").addEventListener("click", schedule);
  document.getElementById("btnExport").addEventListener("click", exportPNG);

  syncDynamicControls();
  render();

})();
