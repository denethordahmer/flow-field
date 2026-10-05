/* =========================================================================
   FLOW FIELD GENERATOR — flow.js (Matched strictly to index.html)
   ========================================================================= */

(function () {
  "use strict";

  // Canvas
  const canvas = document.getElementById("flowCanvas");
  const ctx = canvas.getContext("2d");
  const CANVAS_SIZE = 1500;
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  // Range Inputs
  const particles = document.getElementById("particles");
  const steps = document.getElementById("steps");
  const stepSize = document.getElementById("stepSize");
  const featureSize = document.getElementById("featureSize");
  const curl = document.getElementById("curl");
  const lineWidth = document.getElementById("lineWidth");
  const opacity = document.getElementById("opacity");

  // Value Badges
  const particlesVal = document.getElementById("particlesVal");
  const stepsVal = document.getElementById("stepsVal");
  const stepSizeVal = document.getElementById("stepSizeVal");
  const featureSizeVal = document.getElementById("featureSizeVal");
  const curlVal = document.getElementById("curlVal");
  const lineWidthVal = document.getElementById("lineWidthVal");
  const opacityVal = document.getElementById("opacityVal");

  // Config Selects & Options
  const colorMode = document.getElementById("colorMode");
  const direction = document.getElementById("direction");
  const seedInput = document.getElementById("seed");
  const bgTransparent = document.getElementById("bgTransparent");

  // Buttons
  const btnRandomize = document.getElementById("btnRandomize");
  const btnGenerate = document.getElementById("btnGenerate");
  const btnExport = document.getElementById("btnExport");

  // Color Pickers & Swatches
  const colorSwatches = document.querySelectorAll(".colorSwatch");
  const colorPickerOverlay = document.getElementById("colorPickerOverlay");
  const cpCancel = document.getElementById("cpCancel");
  const cpApply = document.getElementById("cpApply");

  let activeSwatchTarget = null;

  function updateValueBadges() {
    if (particlesVal) particlesVal.textContent = particles.value;
    if (stepsVal) stepsVal.textContent = steps.value;
    if (stepSizeVal) stepSizeVal.textContent = stepSize.value;
    if (featureSizeVal) featureSizeVal.textContent = featureSize.value;
    if (curlVal) curlVal.textContent = curl.value;
    if (lineWidthVal) lineWidthVal.textContent = lineWidth.value;
    if (opacityVal) opacityVal.textContent = opacity.value;
  }

  function getSeed() {
    return parseInt(seedInput.value, 10) || 1;
  }

  function pseudoNoise(x, y, scale, bendFactor, currentSeed) {
    const nx = x * scale * 0.002;
    const ny = y * scale * 0.002;
    return (Math.sin(nx + currentSeed) + Math.cos(ny + currentSeed)) * Math.PI * bendFactor;
  }

  function renderFlowField() {
    const curSeed = getSeed();
    const bgColorVal = document.getElementById("bgColor")?.value || "#0d0f16";
    const transparent = bgTransparent?.checked;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (!transparent) {
      ctx.fillStyle = bgColorVal;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }

    const numParticles = parseInt(particles.value, 10);
    const flowSteps = parseInt(steps.value, 10);
    const stepLen = parseFloat(stepSize.value);
    const featScale = parseFloat(featureSize.value);
    const curlValNum = parseFloat(curl.value);
    const lineW = parseFloat(lineWidth.value);
    const opVal = parseFloat(opacity.value);

    ctx.lineWidth = lineW;

    const color1 = document.getElementById("color1")?.value || "#3b82f6";
    ctx.strokeStyle = hexToRgba(color1, opVal);

    // Seeded Random Particle Rendering
    let localSeed = curSeed;
    function rand() {
      localSeed = (localSeed * 9301 + 49297) % 233280;
      return localSeed / 233280;
    }

    for (let i = 0; i < numParticles; i++) {
      let x = rand() * CANVAS_SIZE;
      let y = rand() * CANVAS_SIZE;

      ctx.beginPath();
      ctx.moveTo(x, y);

      for (let j = 0; j < flowSteps; j++) {
        const angle = pseudoNoise(x, y, 101 - featScale, curlValNum, curSeed);
        x += Math.cos(angle) * stepLen * 2;
        y += Math.sin(angle) * stepLen * 2;

        if (x < 0 || x > CANVAS_SIZE || y < 0 || y > CANVAS_SIZE) break;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function hexToRgba(hex, alpha) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  // True Smart Randomize (Dimensions Strictly Locked)
  function randomizeAll() {
    seedInput.value = Math.floor(Math.random() * 99999);
    particles.value = Math.floor(600 + Math.random() * 2400);
    steps.value = Math.floor(30 + Math.random() * 120);
    stepSize.value = Math.floor(1 + Math.random() * 8);
    featureSize.value = Math.floor(20 + Math.random() * 70);
    curl.value = (0.2 + Math.random() * 1.8).toFixed(2);
    lineWidth.value = (0.5 + Math.random() * 2.5).toFixed(1);
    opacity.value = (0.2 + Math.random() * 0.7).toFixed(2);

    updateValueBadges();
    renderFlowField();
  }

  // Color Swatch Dialog Trigger
  function setupColorPicker() {
    colorSwatches.forEach(swatch => {
      swatch.addEventListener("click", () => {
        activeSwatchTarget = swatch;
        colorPickerOverlay.classList.remove("hidden");
      });
    });

    if (cpCancel) cpCancel.addEventListener("click", () => colorPickerOverlay.classList.add("hidden"));
    if (cpApply) cpApply.addEventListener("click", () => {
      colorPickerOverlay.classList.add("hidden");
      renderFlowField();
    });
  }

  // Prevent Vertical Scroll Drag Conflict
  function preventScrollSliderConflict() {
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
      let active = false;
      slider.addEventListener("touchstart", () => { active = true; }, { passive: true });
      slider.addEventListener("touchend", () => { active = false; }, { passive: true });
      slider.addEventListener("touchmove", (e) => {
        if (!active) e.stopPropagation();
      }, { passive: true });
    });
  }

  function bindEvents() {
    const inputs = [particles, steps, stepSize, featureSize, curl, lineWidth, opacity];
    inputs.forEach(input => {
      if (input) {
        input.addEventListener("input", () => {
          updateValueBadges();
          renderFlowField();
        });
      }
    });

    if (colorMode) colorMode.addEventListener("change", renderFlowField);
    if (direction) direction.addEventListener("change", renderFlowField);
    if (seedInput) seedInput.addEventListener("input", renderFlowField);
    if (bgTransparent) bgTransparent.addEventListener("change", renderFlowField);

    if (btnRandomize) btnRandomize.addEventListener("click", randomizeAll);
    if (btnGenerate) btnGenerate.addEventListener("click", renderFlowField);

    if (btnExport) {
      btnExport.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `flow-field-seed-${seedInput.value}.png`;
        a.click();
      });
    }
  }

  function init() {
    bindEvents();
    setupColorPicker();
    preventScrollSliderConflict();
    updateValueBadges();
    renderFlowField();
  }

  init();
})();
