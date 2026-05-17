(() => {
  const canvas = document.getElementById("biome");
  const ctx = canvas.getContext("2d", { alpha: false });
  const depthState = document.getElementById("depth-state");
  const zoomInButton = document.getElementById("zoom-in");
  const zoomOutButton = document.getElementById("zoom-out");
  const pulseButton = document.getElementById("pulse");

  const palette = {
    ink: "#17111d",
    lowInk: "#221b2e",
    oldLilac: "#9086aa",
    deepLilac: "#62536d",
    bruisedGreen: "#7f998b",
    paleMoss: "#a0b59a",
    wetBlue: "#7698a5",
    oldCream: "#d8c9ad",
    bone: "#eee2c8",
    coralStain: "#b77c82",
    shadow: "rgba(5, 4, 8, 0.52)"
  };

  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    time: 0,
    lastTime: performance.now(),
    camera: {
      x: 0,
      y: -88,
      zoom: 0.92,
      targetZoom: 0.92,
      targetX: 0,
      targetY: -88
    },
    pointer: {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      active: false,
      inside: false
    },
    drag: {
      active: false,
      moved: false,
      x: 0,
      y: 0
    },
    ripples: [],
    globalPulse: 0,
    observationPulse: 0,
    texture: null
  };

  const structures = [
    {
      name: "casulo-comprimido",
      x: -268,
      y: -276,
      z: 760,
      w: 108,
      h: 156,
      depth: 44,
      lean: -0.05,
      color: "#72667f",
      side: "#5f6072",
      roof: "#4c4158",
      glow: "#cfc6a7",
      phase: 0.2,
      energy: 0.12
    },
    {
      name: "ninho-sedimentar",
      x: -76,
      y: -178,
      z: 520,
      w: 152,
      h: 188,
      depth: 52,
      lean: 0.03,
      color: "#879986",
      side: "#687d78",
      roof: "#5c5663",
      glow: "#dfd5ad",
      phase: 1.7,
      energy: 0.18
    },
    {
      name: "orgao-azul",
      x: 178,
      y: -244,
      z: 640,
      w: 128,
      h: 162,
      depth: 46,
      lean: 0.08,
      color: "#678493",
      side: "#536f78",
      roof: "#46495e",
      glow: "#d9d2b8",
      phase: 2.4,
      energy: 0.1
    },
    {
      name: "coluna-fossil",
      x: 72,
      y: -18,
      z: 360,
      w: 174,
      h: 226,
      depth: 58,
      lean: -0.02,
      color: "#a6977e",
      side: "#807d72",
      roof: "#625768",
      glow: "#efe0b7",
      phase: 3.3,
      energy: 0.22
    },
    {
      name: "membrana-enferrujada",
      x: -198,
      y: 80,
      z: 390,
      w: 142,
      h: 174,
      depth: 50,
      lean: -0.07,
      color: "#a87981",
      side: "#7e6874",
      roof: "#5f5364",
      glow: "#ead2ac",
      phase: 4.1,
      energy: 0.26
    },
    {
      name: "pedra-observadora",
      x: 318,
      y: -34,
      z: 860,
      w: 104,
      h: 132,
      depth: 36,
      lean: 0.06,
      color: "#746f8d",
      side: "#586778",
      roof: "#453c52",
      glow: "#cbd6bd",
      phase: 5.6,
      energy: 0.07
    },
    {
      name: "raiz-vertical",
      x: -386,
      y: -36,
      z: 470,
      w: 98,
      h: 198,
      depth: 40,
      lean: 0.05,
      color: "#78917f",
      side: "#61776d",
      roof: "#554d59",
      glow: "#d9c8a0",
      phase: 6.2,
      energy: 0.16
    }
  ];

  const links = [
    [0, 1, "thin"],
    [1, 2, "stair"],
    [2, 3, "thin"],
    [1, 4, "stair"],
    [4, 3, "bridge"],
    [4, 6, "bridge"],
    [2, 5, "thin"]
  ];

  const fireflies = Array.from({ length: 18 }, (_, index) => ({
    seed: index * 7.41 + 3,
    anchor: structures[index % structures.length],
    orbit: 28 + (index % 5) * 8,
    depth: 8 + (index % 3) * 6,
    stain: index % 4 === 0 ? palette.coralStain : index % 3 === 0 ? palette.wetBlue : palette.oldCream
  }));

  const wetDust = Array.from({ length: 170 }, (_, index) => ({
    seed: index * 11.19 + 2,
    x: Math.random(),
    y: Math.random(),
    depth: 0.35 + Math.random() * 1.65,
    radius: 0.7 + Math.random() * 2.8,
    clots: index % 11 === 0
  }));

  const microCreatures = Array.from({ length: 18 }, (_, index) => ({
    seed: index * 9.73 + 1.5,
    anchor: structures[index % structures.length],
    localX: -0.42 + ((index * 0.37) % 0.84),
    localY: -0.42 + ((index * 0.29) % 0.84),
    size: 4 + (index % 7) * 1.3,
    temperament: index % 6,
    color: index % 5 === 0 ? palette.coralStain : index % 4 === 0 ? palette.wetBlue : index % 3 === 0 ? palette.paleMoss : palette.oldCream
  }));

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function wave(seed, speed, amount, offset = 0) {
    return Math.sin(state.time * speed + seed) * amount + offset;
  }

  function makeTexture() {
    const size = 160;
    const textureCanvas = document.createElement("canvas");
    const textureContext = textureCanvas.getContext("2d");
    textureCanvas.width = size;
    textureCanvas.height = size;
    const image = textureContext.createImageData(size, size);

    for (let i = 0; i < image.data.length; i += 4) {
      const grain = 120 + Math.random() * 70;
      image.data[i] = grain;
      image.data[i + 1] = grain * 0.95;
      image.data[i + 2] = grain * 0.84;
      image.data[i + 3] = 10 + Math.random() * 26;
    }

    textureContext.putImageData(image, 0, 0);
    return ctx.createPattern(textureCanvas, "repeat");
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(320, window.innerWidth);
    state.height = Math.max(320, window.innerHeight);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.pointer.x = state.width / 2;
    state.pointer.y = state.height / 2;
    state.texture = makeTexture();
  }

  function project(x, y, z, lift = 0) {
    const focus = 820;
    const scale = (focus / (focus + z)) * state.camera.zoom;
    const pointerDriftX = ((state.pointer.x / state.width) - 0.5) * 34 * (1 - scale);
    const pointerDriftY = ((state.pointer.y / state.height) - 0.5) * 24 * (1 - scale);

    return {
      x: state.width * 0.5 + (x - state.camera.x) * scale + pointerDriftX,
      y: state.height * 0.52 + (y - state.camera.y - lift) * scale + pointerDriftY,
      s: scale,
      a: clamp(0.2 + scale * 1.1, 0.18, 1)
    };
  }

  function screenToWorld(x, y, z = 520) {
    const focus = 820;
    const scale = (focus / (focus + z)) * state.camera.zoom;
    return {
      x: (x - state.width * 0.5) / scale + state.camera.x,
      y: (y - state.height * 0.52) / scale + state.camera.y
    };
  }

  function colorWithAlpha(hex, alpha) {
    const clean = hex.replace("#", "");
    const value = parseInt(clean, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const corner = clamp(radius, 0, Math.min(width, height) / 2);

    if (context.roundRect) {
      context.roundRect(x, y, width, height, corner);
      return;
    }

    context.moveTo(x + corner, y);
    context.lineTo(x + width - corner, y);
    context.quadraticCurveTo(x + width, y, x + width, y + corner);
    context.lineTo(x + width, y + height - corner);
    context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
    context.lineTo(x + corner, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - corner);
    context.lineTo(x, y + corner);
    context.quadraticCurveTo(x, y, x + corner, y);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, state.height);
    sky.addColorStop(0, "#06060d");
    sky.addColorStop(0.33, "#11101c");
    sky.addColorStop(0.62, "#172226");
    sky.addColorStop(1, "#071016");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.width, state.height);

    drawVoidStrata();
    drawMistLines();
    drawDistantThreads();
    drawOcean();
    drawWetDust();

    ctx.save();
    ctx.globalAlpha = 0.48;
    ctx.fillStyle = state.texture;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  function drawVoidStrata() {
    const count = 7;
    for (let i = 0; i < count; i += 1) {
      const seed = i * 1.9;
      const x = state.width * (0.12 + i * 0.13) + wave(seed, 0.00008, 18);
      const y = state.height * (0.18 + (i % 3) * 0.18) + wave(seed + 2, 0.0001, 20);
      const width = 54 + (i % 4) * 22;
      const height = 170 + (i % 3) * 70;
      const alpha = i % 2 === 0 ? 0.12 : 0.09;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 2 === 0 ? "#ecdfc3" : "#07070b";
      ctx.beginPath();
      ctx.moveTo(x, y - height * 0.5);
      ctx.bezierCurveTo(x - width, y - height * 0.18, x - width * 0.65, y + height * 0.28, x - width * 0.18, y + height * 0.52);
      ctx.bezierCurveTo(x + width * 0.46, y + height * 0.3, x + width * 0.72, y - height * 0.18, x, y - height * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMistLines() {
    for (let i = 0; i < 12; i += 1) {
      const y = state.height * (0.08 + i * 0.075) + wave(i, 0.00012, 12);
      const alpha = 0.07 + (i % 3) * 0.025;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = i % 2 === 0 ? palette.oldCream : palette.wetBlue;
      ctx.lineWidth = 1 + (i % 4) * 0.25;
      ctx.beginPath();
      ctx.moveTo(-40, y);
      for (let x = -40; x <= state.width + 80; x += 120) {
        const offset = Math.sin(x * 0.01 + state.time * 0.00018 + i) * 16;
        ctx.quadraticCurveTo(x + 56, y + offset, x + 120, y + Math.sin(x * 0.006 + i) * 9);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDistantThreads() {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#b5c8b0";
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 97 + wave(i, 0.00009, 25)) % (state.width + 160) - 80;
      const top = state.height * 0.08 + (i % 5) * 23;
      const length = 80 + (i % 4) * 34;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.bezierCurveTo(x + wave(i, 0.001, 10), top + length * 0.32, x - wave(i + 2, 0.0011, 8), top + length * 0.72, x + wave(i + 3, 0.0008, 7), top + length);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOcean() {
    const breath = Math.sin(state.time * 0.00042) * 15 + Math.sin(state.time * 0.00011) * 25;
    const horizon = state.height * 0.72 + breath;
    const surge = 0.5 + Math.sin(state.time * 0.00028) * 0.5;
    const gradient = ctx.createLinearGradient(0, horizon - 70, 0, state.height);

    gradient.addColorStop(0, "rgba(32, 49, 54, 0.12)");
    gradient.addColorStop(0.18, "rgba(45, 70, 73, 0.36)");
    gradient.addColorStop(0.58, "rgba(7, 18, 26, 0.9)");
    gradient.addColorStop(1, "rgba(4, 10, 17, 0.96)");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= state.width + 80; x += 80) {
      const y = horizon + Math.sin(x * 0.009 + state.time * 0.00062) * 12 + Math.sin(x * 0.021 - state.time * 0.00028) * 5;
      ctx.quadraticCurveTo(x + 40, y - 12, x + 80, y);
    }
    ctx.lineTo(state.width, state.height);
    ctx.lineTo(0, state.height);
    ctx.closePath();
    ctx.fill();

    for (let band = 0; band < 7; band += 1) {
      const y = horizon + 22 + band * 32 + Math.sin(state.time * 0.00035 + band) * 11;
      ctx.globalAlpha = 0.09 + band * 0.012;
      ctx.strokeStyle = band % 2 === 0 ? palette.wetBlue : palette.bruisedGreen;
      ctx.lineWidth = 1 + band * 0.14;
      ctx.beginPath();
      ctx.moveTo(-80, y);
      for (let x = -80; x <= state.width + 120; x += 100) {
        const offset = Math.sin(x * 0.012 + state.time * (0.00022 + band * 0.00002)) * (18 - band);
        ctx.quadraticCurveTo(x + 50, y + offset, x + 100, y + Math.sin(x * 0.006 + band) * 8);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 0.12 + surge * 0.12;
    ctx.fillStyle = palette.oldCream;
    for (let i = 0; i < 9; i += 1) {
      const x = ((i * 179 + state.time * 0.009) % (state.width + 180)) - 90;
      const y = horizon + 90 + (i % 4) * 42 + Math.sin(state.time * 0.0004 + i) * 16;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + (i % 3) * 12, 3 + (i % 2) * 2, Math.sin(i) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#04060b";
    for (let i = 0; i < 3; i += 1) {
      const x = state.width * (0.24 + i * 0.23) + Math.sin(state.time * 0.00008 + i) * 48;
      const y = horizon + state.height * (0.17 + i * 0.055);
      const width = state.width * (0.16 + i * 0.04);
      const height = 48 + i * 22;
      ctx.beginPath();
      ctx.ellipse(x, y, width, height, Math.sin(state.time * 0.0001 + i) * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWetDust() {
    const wind = Math.sin(state.time * 0.00018) * 42 + Math.sin(state.time * 0.00051) * 18;

    ctx.save();
    for (const mote of wetDust) {
      const drift = state.time * (0.002 + mote.depth * 0.0008);
      const x = ((mote.x * state.width + wind * mote.depth + drift + Math.sin(state.time * 0.0003 + mote.seed) * 26) % (state.width + 80)) - 40;
      const y = ((mote.y * state.height + state.time * (0.001 + mote.depth * 0.0007)) % (state.height + 80)) - 40;
      const nearPointer = state.pointer.inside ? 1 - clamp(Math.hypot(x - state.pointer.x, y - state.pointer.y) / 180, 0, 1) : 0;
      const alpha = (mote.clots ? 0.1 : 0.045) + nearPointer * 0.05;
      const radius = mote.radius * (mote.clots ? 2.6 : 1) * (0.8 + Math.sin(state.time * 0.001 + mote.seed) * 0.18);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = mote.clots ? palette.paleMoss : palette.oldCream;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.8, radius * 0.78, Math.sin(mote.seed) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWorld() {
    const sortedLinks = links
      .map(([a, b, type]) => ({ a: structures[a], b: structures[b], type }))
      .sort((left, right) => ((right.a.z + right.b.z) / 2) - ((left.a.z + left.b.z) / 2));

    sortedLinks.forEach(drawBridge);

    [...structures]
      .sort((a, b) => b.z - a.z)
      .forEach(drawStructure);

    drawFireflies();
    drawMicroCreatures();
    drawRipples();
    drawForegroundVeils();
  }

  function structureCenter(item) {
    const breath = wave(item.phase, 0.001, 10) + item.energy * 10;
    return project(item.x, item.y, item.z, breath);
  }

  function drawBridge({ a, b, type }) {
    const start = structureCenter(a);
    const end = structureCenter(b);
    const alpha = clamp((start.a + end.a) * 0.34, 0.12, 0.5);
    const stepCount = type === "thin" ? 6 : type === "stair" ? 10 : 8;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colorWithAlpha(type === "stair" ? palette.oldCream : palette.bruisedGreen, 0.62);
    ctx.lineWidth = Math.max(1, (start.s + end.s) * 1.8);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(
      lerp(start.x, end.x, 0.34),
      lerp(start.y, end.y, 0.34) + wave(a.phase + b.phase, 0.0008, 18),
      lerp(start.x, end.x, 0.66),
      lerp(start.y, end.y, 0.66) + wave(a.phase - b.phase, 0.00075, 16),
      end.x,
      end.y
    );
    ctx.stroke();

    ctx.strokeStyle = colorWithAlpha(type === "stair" ? palette.paleMoss : palette.ink, 0.28);
    for (let i = 1; i < stepCount; i += 1) {
      const t = i / stepCount;
      const px = lerp(start.x, end.x, t);
      const py = lerp(start.y, end.y, t) + Math.sin(i + state.time * 0.0004) * 4;
      const plank = 3 + (start.s + end.s) * 7;
      ctx.beginPath();
      ctx.moveTo(px - nx * plank, py - ny * plank);
      ctx.lineTo(px + nx * plank, py + ny * plank);
      ctx.stroke();

      if (type !== "thin" && i % 2 === 0) {
        ctx.fillStyle = colorWithAlpha(palette.oldCream, 0.13);
        ctx.beginPath();
        ctx.ellipse(px, py, plank * 0.38, plank * 0.22, Math.atan2(dy, dx), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawStructure(item) {
    const p = structureCenter(item);
    const hover = pointerInfluence(p, item);
    const pulse = item.energy + hover * 0.35 + state.globalPulse * 0.15;
    const scaleBreath = 1 + wave(item.phase, 0.0009, 0.024) + pulse * 0.025;
    const width = item.w * p.s * scaleBreath;
    const height = item.h * p.s * scaleBreath;
    const depth = item.depth * p.s;
    const wobble = wave(item.phase, 0.0012, 3.8) * p.s;
    const lean = item.lean * width;
    const x = p.x;
    const y = p.y;
    const frontPoints = organicStructurePoints(x + lean, y, width, height, item.phase, pulse, p.s);
    const sidePoints = frontPoints.map((point, index) => ({
      x: point.x + depth * (0.62 + Math.sin(index + item.phase) * 0.05),
      y: point.y + depth * (0.34 + Math.cos(index * 0.7 + item.phase) * 0.04)
    }));
    const bounds = {
      topLeft: { x: x - width * 0.5 + lean, y: y - height * 0.5 },
      topRight: { x: x + width * 0.5 + lean, y: y - height * 0.5 },
      bottomRight: { x: x + width * 0.5, y: y + height * 0.5 },
      bottomLeft: { x: x - width * 0.5, y: y + height * 0.5 }
    };

    ctx.save();
    ctx.globalAlpha = p.a;

    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.ellipse(x + depth * 0.25, y + height * 0.6, width * 0.42, Math.max(5, height * 0.09), 0, 0, Math.PI * 2);
    ctx.fill();

    drawTethers(item, p, width, height, pulse);

    ctx.fillStyle = colorWithAlpha(item.side, 0.88);
    ctx.beginPath();
    drawOrganicPath(sidePoints);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colorWithAlpha(item.color, 0.94);
    ctx.beginPath();
    drawOrganicPath(frontPoints);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colorWithAlpha(item.roof, 0.58);
    ctx.beginPath();
    ctx.ellipse(x + lean * 0.18, y - height * 0.45 + wobble, width * 0.38, height * 0.18, item.lean + wave(item.phase, 0.0008, 0.08), 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    drawSedimentBands(item, p, { x, y, width, height, pulse });
    drawSurfaceStains(item, p, bounds, pulse);
    drawWindows(item, p, { x, y, width, height, pulse });
    drawCloseDetails(item, p, bounds, pulse);
    drawEmbeddedEcology(item, p, bounds, pulse);

    ctx.strokeStyle = colorWithAlpha(palette.oldCream, 0.18 + pulse * 0.16);
    ctx.lineWidth = Math.max(0.7, p.s * 1.1);
    ctx.beginPath();
    drawOrganicPath(frontPoints);
    ctx.closePath();
    ctx.stroke();

    item.energy *= 0.986;
    ctx.restore();
  }

  function organicStructurePoints(x, y, width, height, phase, pulse, scale) {
    const points = [];
    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      const mutation = 1 + Math.sin(angle * 3 + phase + state.time * 0.00045) * 0.08 + Math.sin(angle * 5 - phase) * 0.035;
      const lift = Math.max(0, Math.cos(angle)) * pulse * 7 * scale;
      points.push({
        x: x + Math.cos(angle) * width * 0.5 * mutation + Math.sin(angle * 2 + phase) * 4 * scale,
        y: y + Math.sin(angle) * height * 0.5 * (1 + pulse * 0.02) - lift
      });
    }
    return points;
  }

  function drawOrganicPath(points) {
    if (!points.length) {
      return;
    }

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length; i += 1) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const midX = (current.x + next.x) * 0.5;
      const midY = (current.y + next.y) * 0.5;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
  }

  function drawSedimentBands(item, point, box) {
    ctx.save();
    ctx.globalAlpha *= 0.22 + box.pulse * 0.18;
    ctx.strokeStyle = colorWithAlpha(palette.ink, 0.58);
    ctx.lineWidth = Math.max(0.65, point.s * 1.2);
    for (let i = 0; i < 8; i += 1) {
      const y = box.y - box.height * 0.36 + (i / 7) * box.height * 0.72 + wave(item.phase + i, 0.0007, 2.5) * point.s;
      ctx.beginPath();
      ctx.moveTo(box.x - box.width * 0.38, y);
      ctx.bezierCurveTo(
        box.x - box.width * 0.12,
        y + wave(i, 0.001, 8) * point.s,
        box.x + box.width * 0.14,
        y - wave(i + item.phase, 0.001, 7) * point.s,
        box.x + box.width * 0.39,
        y + wave(i + 4, 0.0009, 5) * point.s
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function pointerInfluence(point, item) {
    if (!state.pointer.inside) {
      return 0;
    }

    const distance = Math.hypot(state.pointer.x - point.x, state.pointer.y - point.y);
    const radius = 70 + item.w * point.s * 0.38;
    return clamp(1 - distance / radius, 0, 1);
  }

  function drawTethers(item, point, width, height, pulse) {
    ctx.save();
    ctx.strokeStyle = colorWithAlpha(palette.paleMoss, 0.22 + pulse * 0.14);
    ctx.lineWidth = Math.max(0.7, point.s);
    for (let i = 0; i < 4; i += 1) {
      const offset = (i - 1.5) * width * 0.22;
      ctx.beginPath();
      ctx.moveTo(point.x + offset, point.y - height * 0.48);
      ctx.bezierCurveTo(
        point.x + offset + wave(item.phase + i, 0.001, 18) * point.s,
        point.y - height * 0.88,
        point.x + offset - wave(item.phase + i + 1, 0.0011, 24) * point.s,
        point.y - height * 1.35,
        point.x + offset * 0.6,
        point.y - height * 1.7
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSurfaceStains(item, point, shape, pulse) {
    const width = Math.abs(shape.topRight.x - shape.topLeft.x);
    const height = Math.abs(shape.bottomLeft.y - shape.topLeft.y);

    ctx.save();
    ctx.globalAlpha *= 0.55;
    for (let i = 0; i < 10; i += 1) {
      const tx = shape.topLeft.x + width * ((i * 0.27 + item.phase) % 1);
      const ty = shape.topLeft.y + height * ((i * 0.19 + 0.25) % 1);
      const stainWidth = (8 + (i % 4) * 5) * point.s * (1 + pulse * 0.5);
      const stainHeight = (14 + (i % 3) * 9) * point.s;
      ctx.fillStyle = colorWithAlpha(i % 3 === 0 ? palette.coralStain : i % 2 === 0 ? palette.oldCream : palette.bruisedGreen, 0.16);
      ctx.beginPath();
      ctx.ellipse(tx + wave(i + item.phase, 0.0009, 3), ty, stainWidth, stainHeight, item.lean, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWindows(item, point, box) {
    const fissureCount = item.h > 170 ? 7 : 5;
    const glowAmount = 0.28 + box.pulse * 0.45 + wave(item.phase, 0.0014, 0.1);

    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < fissureCount; i += 1) {
      const tx = -0.35 + ((i * 0.23 + item.phase * 0.07) % 0.7);
      const top = box.y - box.height * 0.34 + (i / fissureCount) * box.height * 0.68;
      const startX = box.x + box.width * tx + wave(item.phase + i, 0.001, 3) * point.s;
      const length = (24 + (i % 4) * 9) * point.s * (1 + box.pulse * 0.24);

      ctx.strokeStyle = colorWithAlpha(item.glow, 0.22 + glowAmount * 0.34);
      ctx.lineWidth = Math.max(1.2, point.s * (1.8 + (i % 3) * 0.55));
      ctx.shadowBlur = 10 * point.s + box.pulse * 14;
      ctx.shadowColor = item.glow;
      ctx.beginPath();
      ctx.moveTo(startX, top);
      ctx.bezierCurveTo(
        startX + wave(i, 0.001, 8) * point.s,
        top + length * 0.25,
        startX - wave(i + item.phase, 0.0012, 7) * point.s,
        top + length * 0.62,
        startX + wave(i + 5, 0.001, 5) * point.s,
        top + length
      );
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (state.camera.zoom > 1.18) {
        ctx.fillStyle = colorWithAlpha(item.glow, 0.2 + box.pulse * 0.12);
        ctx.beginPath();
        ctx.ellipse(startX + wave(i, 0.0011, 5) * point.s, top + length * 0.55, 2.5 * point.s, 5.5 * point.s, item.lean, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawCloseDetails(item, point, shape, pulse) {
    if (state.camera.zoom < 1.08 || point.s < 0.45) {
      return;
    }

    const detail = clamp((state.camera.zoom - 1.05) / 0.65, 0, 1);
    const width = Math.abs(shape.topRight.x - shape.topLeft.x);
    const height = Math.abs(shape.bottomLeft.y - shape.topLeft.y);

    ctx.save();
    ctx.globalAlpha *= 0.2 + detail * 0.42;
    ctx.strokeStyle = colorWithAlpha(palette.ink, 0.46);
    ctx.lineWidth = Math.max(0.5, point.s * 0.8);

    for (let i = 0; i < 12; i += 1) {
      const sx = shape.topLeft.x + width * ((i * 0.31 + item.phase * 0.1) % 1);
      const sy = shape.topLeft.y + height * ((i * 0.21 + 0.13) % 1);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(
        sx + wave(i, 0.0012, 9) * point.s,
        sy + 9 * point.s,
        sx - wave(i + item.phase, 0.0011, 14) * point.s,
        sy + 20 * point.s,
        sx + wave(i + 4, 0.001, 8) * point.s,
        sy + (32 + pulse * 8) * point.s
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEmbeddedEcology(item, point, shape, pulse) {
    const reveal = clamp((state.camera.zoom - 0.98) / 0.72, 0, 1);
    if (reveal <= 0 || point.s < 0.35) {
      return;
    }

    const width = Math.abs(shape.topRight.x - shape.topLeft.x);
    const height = Math.abs(shape.bottomLeft.y - shape.topLeft.y);

    ctx.save();
    ctx.globalAlpha *= reveal * 0.48;
    for (let i = 0; i < 24; i += 1) {
      const px = shape.topLeft.x + width * ((i * 0.17 + item.phase * 0.11) % 1);
      const py = shape.topLeft.y + height * ((i * 0.23 + 0.19) % 1);
      const observed = state.pointer.inside ? 1 - clamp(Math.hypot(px - state.pointer.x, py - state.pointer.y) / 95, 0, 1) : 0;
      const radius = (1.2 + (i % 5) * 0.45 + observed * 1.8) * point.s;

      ctx.fillStyle = colorWithAlpha(i % 4 === 0 ? palette.coralStain : i % 3 === 0 ? palette.paleMoss : palette.oldCream, 0.2 + observed * 0.28 + pulse * 0.08);
      ctx.beginPath();
      ctx.ellipse(px + wave(i, 0.0009, 3) * point.s, py + wave(i + item.phase, 0.0008, 2) * point.s, radius * 1.9, radius * 0.72, Math.sin(i + item.phase), 0, Math.PI * 2);
      ctx.fill();

      if (state.camera.zoom > 1.36 && i % 3 === 0) {
        ctx.strokeStyle = colorWithAlpha(palette.ink, 0.28);
        ctx.lineWidth = Math.max(0.4, point.s * 0.55);
        ctx.beginPath();
        ctx.moveTo(px - radius * 2, py);
        ctx.quadraticCurveTo(px, py - radius * (2 + observed), px + radius * 2.3, py + radius * 0.8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawMicroCreatures() {
    const reveal = clamp((state.camera.zoom - 0.78) / 0.78, 0, 1);
    if (reveal <= 0.02) {
      return;
    }

    ctx.save();
    for (const creature of microCreatures) {
      const anchor = creature.anchor;
      const localWander = creature.temperament === 3 && state.pointer.inside
        ? state.observationPulse * 9
        : Math.sin(state.time * 0.00045 + creature.seed) * 10;
      const anchorWidth = anchor.w * creature.localX;
      const anchorHeight = anchor.h * creature.localY;
      const base = project(
        anchor.x + anchorWidth * 0.52 + localWander,
        anchor.y + anchorHeight * 0.48 + Math.cos(state.time * 0.0005 + creature.seed) * 8,
        anchor.z - 24,
        0
      );

      const distance = state.pointer.inside ? Math.hypot(base.x - state.pointer.x, base.y - state.pointer.y) : 999;
      const observed = clamp(1 - distance / 118, 0, 1);
      let alpha = reveal * base.a * 0.42;
      let moveX = Math.sin(state.time * 0.0007 + creature.seed) * 5 * base.s;
      let moveY = Math.cos(state.time * 0.00054 + creature.seed) * 4 * base.s;
      let inflation = 1;

      if (observed > 0) {
        if (creature.temperament === 0) {
          alpha *= 1 - observed * 0.72;
          moveX -= observed * 18 * base.s;
        } else if (creature.temperament === 1) {
          moveX += (state.pointer.x - base.x) * observed * 0.045;
          moveY += (state.pointer.y - base.y) * observed * 0.03;
          alpha += observed * 0.18;
        } else if (creature.temperament === 2) {
          inflation += observed * 1.55;
          alpha += observed * 0.16;
        } else if (creature.temperament === 3) {
          moveX = 0;
          moveY = 0;
          alpha += observed * 0.08;
        } else if (creature.temperament === 4) {
          alpha *= 1 - observed * 0.42;
          moveY += observed * 13 * base.s;
        } else {
          alpha += observed * 0.22;
        }
      }

      drawCreatureShape(creature, base.x + moveX, base.y + moveY, creature.size * base.s * inflation, alpha, observed);
    }
    ctx.restore();
  }

  function drawCreatureShape(creature, x, y, size, alpha, observed) {
    if (alpha <= 0.01 || size <= 0.5) {
      return;
    }

    const angle = Math.sin(state.time * 0.00018 + creature.seed) * 0.25;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 0.82);
    ctx.translate(x, y);
    ctx.rotate(angle);

    const pulse = 1 + Math.sin(state.time * 0.0003 + creature.seed) * 0.03;

    const bodyLength = size * (1.6 + (creature.temperament % 3) * 0.25) * pulse;
    const bodyHeight = size * (0.7 + (creature.temperament % 2) * 0.18);

    const grad = ctx.createRadialGradient(
      -bodyLength * 0.15,
      -bodyHeight * 0.08,
      size * 0.15,
      0,
      0,
      bodyLength
    );

    grad.addColorStop(0, colorWithAlpha(palette.oldCream, 0.42));
    grad.addColorStop(1, colorWithAlpha(creature.color, 0.82));

    ctx.fillStyle = grad;

    ctx.beginPath();

    for (let i = 0; i < 20; i += 1) {
      const t = i / 20;
      const a = t * Math.PI * 2;

      const deform =
        1 +
        Math.sin(a * 3 + creature.seed) * 0.18 +
        Math.cos(a * 5 + state.time * 0.0002) * 0.08;

      const px = Math.cos(a) * bodyLength * deform;
      const py = Math.sin(a) * bodyHeight * deform;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha *= 0.45;
    ctx.strokeStyle = colorWithAlpha(palette.ink, 0.42);
    ctx.lineWidth = Math.max(0.5, size * 0.08);

    for (let i = 0; i < 4; i += 1) {
      const lx = -bodyLength * 0.15 + i * bodyLength * 0.25;
      const ly = bodyHeight * 0.3;

      ctx.beginPath();
      ctx.moveTo(lx, ly);

      ctx.quadraticCurveTo(
        lx + Math.sin(i + creature.seed) * size * 0.5,
        ly + size * (0.8 + i * 0.08),
        lx + Math.cos(i) * size * 0.8,
        ly + size * 1.6
      );

      ctx.stroke();
    }

    if (observed > 0.18) {
      ctx.globalAlpha *= 0.8;

      const eyeX = bodyLength * 0.2;
      const eyeY = -bodyHeight * 0.08;

      ctx.fillStyle = colorWithAlpha("#e8f0ff", 0.75);

      ctx.beginPath();
      ctx.arc(eyeX, eyeY, size * 0.16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colorWithAlpha(palette.ink, 0.7);

      ctx.beginPath();
      ctx.arc(
        eyeX + Math.sin(state.time * 0.0012) * size * 0.03,
        eyeY,
        size * 0.07,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.globalAlpha *= 0.25;

    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = colorWithAlpha(
        i % 2 === 0 ? palette.paleMoss : palette.oldCream,
        0.14
      );

      ctx.beginPath();

      ctx.ellipse(
        Math.sin(i * 1.2 + creature.seed) * bodyLength * 0.2,
        Math.cos(i * 1.7 + creature.seed) * bodyHeight * 0.25,
        size * (0.12 + i * 0.03),
        size * 0.05,
        Math.sin(i),
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();
  }

  function drawFireflies() {
    ctx.save();
    for (const mote of fireflies) {
      const anchor = mote.anchor;
      const angle = state.time * 0.00022 + mote.seed;
      const wobble = Math.sin(state.time * 0.00031 + mote.seed) * mote.depth;
      const p = project(
        anchor.x + Math.cos(angle) * mote.orbit + wobble,
        anchor.y - 44 + Math.sin(angle * 0.8) * mote.orbit * 0.45,
        anchor.z - 35,
        0
      );

      if (p.s < 0.28) {
        continue;
      }

      const size = (3.5 + Math.sin(angle * 3) * 1.2) * p.s;
      ctx.globalAlpha = clamp(0.18 + anchor.energy * 0.5 + p.s * 0.3, 0.12, 0.72);
      ctx.fillStyle = colorWithAlpha(mote.stain, 0.9);
      ctx.beginPath();
      ctx.ellipse(p.x - size * 0.45, p.y, size, size * 0.42, angle, 0, Math.PI * 2);
      ctx.ellipse(p.x + size * 0.45, p.y, size, size * 0.42, -angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRipples() {
    const now = state.time;
    state.ripples = state.ripples.filter((ripple) => now - ripple.started < 4200);

    ctx.save();
    for (const ripple of state.ripples) {
      const age = now - ripple.started;
      const t = age / 4200;
      const radius = 24 + t * 310;
      const alpha = (1 - t) * 0.28;
      ctx.strokeStyle = colorWithAlpha(ripple.color, alpha);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, radius * 1.18, radius * 0.56, ripple.tilt, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawForegroundVeils() {
    const close = clamp((state.camera.zoom - 1.1) / 0.75, 0, 1);
    if (close <= 0) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = close * 0.34;
    ctx.strokeStyle = colorWithAlpha(palette.oldCream, 0.42);
    ctx.lineWidth = 1.2;

    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 === 0 ? -20 : state.width + 20;
      const y = state.height * (0.18 + (i % 5) * 0.14);
      ctx.beginPath();
      ctx.moveTo(side, y);
      ctx.bezierCurveTo(
        state.width * (i % 2 === 0 ? 0.18 : 0.82),
        y + wave(i, 0.0011, 32),
        state.width * (i % 2 === 0 ? 0.28 : 0.72),
        y + 120 + wave(i + 2, 0.001, 24),
        state.width * (i % 2 === 0 ? 0.1 : 0.9),
        y + 220
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function activateAt(x, y) {
    const colors = [palette.oldCream, palette.bruisedGreen, palette.coralStain, palette.wetBlue];
    state.ripples.push({
      x,
      y,
      started: state.time,
      tilt: Math.sin(state.time * 0.0007) * 0.4,
      color: colors[Math.floor(state.time / 700) % colors.length]
    });

    let nearest = null;
    let nearestDistance = Infinity;

    for (const item of structures) {
      const point = structureCenter(item);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = item;
      }
    }

    if (nearest) {
      nearest.energy = Math.min(1.4, nearest.energy + 0.85);
      for (const [a, b] of links) {
        const first = structures[a];
        const second = structures[b];
        if (first === nearest) {
          second.energy = Math.max(second.energy, 0.42);
        }
        if (second === nearest) {
          first.energy = Math.max(first.energy, 0.42);
        }
      }
    }

    state.globalPulse = 1;
    state.observationPulse = 1;
  }

  function updateDepthLabel() {
    if (state.camera.targetZoom < 0.85) {
      depthState.value = "distancia: oceano e verticalidade";
    } else if (state.camera.targetZoom < 1.24) {
      depthState.value = "proximidade: estruturas sedimentares";
    } else {
      depthState.value = "muito perto: ecologia micro revelada";
    }
  }

  function setZoom(nextZoom) {
    state.camera.targetZoom = clamp(nextZoom, 0.64, 1.72);
    updateDepthLabel();
  }

  function handlePointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.pointer.x = event.clientX - rect.left;
    state.pointer.y = event.clientY - rect.top;
    state.pointer.inside = true;
    const world = screenToWorld(state.pointer.x, state.pointer.y);
    state.pointer.worldX = world.x;
    state.pointer.worldY = world.y;

    if (state.drag.active) {
      const dx = state.pointer.x - state.drag.x;
      const dy = state.pointer.y - state.drag.y;
      if (Math.hypot(dx, dy) > 3) {
        state.drag.moved = true;
      }
      state.camera.targetX -= dx / Math.max(0.35, state.camera.zoom * 0.8);
      state.camera.targetY -= dy / Math.max(0.35, state.camera.zoom * 0.8);
      state.drag.x = state.pointer.x;
      state.drag.y = state.pointer.y;
    }
  }

  function handlePointerDown(event) {
    handlePointerMove(event);
    state.drag.active = true;
    state.drag.moved = false;
    state.drag.x = state.pointer.x;
    state.drag.y = state.pointer.y;
    state.pointer.active = true;
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event) {
    handlePointerMove(event);
    if (!state.drag.moved) {
      activateAt(state.pointer.x, state.pointer.y);
    }
    state.drag.active = false;
    state.pointer.active = false;
    canvas.releasePointerCapture(event.pointerId);
  }

  function tick(now) {
    const delta = Math.min(64, now - state.lastTime);
    state.lastTime = now;
    state.time += delta;

    state.camera.zoom = lerp(state.camera.zoom, state.camera.targetZoom, 0.045);
    state.camera.x = lerp(state.camera.x, state.camera.targetX, 0.035);
    state.camera.y = lerp(state.camera.y, state.camera.targetY, 0.035);
    state.globalPulse *= 0.982;
    state.observationPulse *= 0.968;

    drawBackground();
    drawWorld();

    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = state.texture;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();

    requestAnimationFrame(tick);
  }

  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", () => {
    state.drag.active = false;
    state.pointer.active = false;
  });
  canvas.addEventListener("pointerleave", () => {
    state.pointer.inside = false;
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    setZoom(state.camera.targetZoom - event.deltaY * 0.0012);
  }, { passive: false });

  zoomInButton.addEventListener("click", () => setZoom(state.camera.targetZoom + 0.18));
  zoomOutButton.addEventListener("click", () => setZoom(state.camera.targetZoom - 0.18));
  pulseButton.addEventListener("click", () => activateAt(state.width * 0.5, state.height * 0.52));

  window.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(state.camera.targetZoom + 0.18);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setZoom(state.camera.targetZoom - 0.18);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      activateAt(state.pointer.x || state.width * 0.5, state.pointer.y || state.height * 0.52);
    } else if (event.key === "0") {
      event.preventDefault();
      state.camera.targetX = 0;
      state.camera.targetY = -88;
      setZoom(0.92);
    }
  });

  window.addEventListener("resize", resize);

  window.__mindBiomeStatus = () => {
    const sampleSize = 7;
    const pixels = [];
    for (let y = 0; y < sampleSize; y += 1) {
      for (let x = 0; x < sampleSize; x += 1) {
        const sx = Math.floor((x + 0.5) * state.width / sampleSize);
        const sy = Math.floor((y + 0.5) * state.height / sampleSize);
        const data = ctx.getImageData(sx * state.dpr, sy * state.dpr, 1, 1).data;
        pixels.push(`${data[0]},${data[1]},${data[2]}`);
      }
    }
    return {
      width: state.width,
      height: state.height,
      zoom: Number(state.camera.zoom.toFixed(3)),
      ripples: state.ripples.length,
      uniqueSamples: new Set(pixels).size,
      structures: structures.length
    };
  };

  resize();
  requestAnimationFrame(tick);
})();
