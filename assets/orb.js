// Lumen companion orb — a thin glass sphere with animated color blobs.
// Exposes window.LumenOrb: setState, setColors, setSize, setEnabled.
import * as THREE from './lib/three.module.js';

(function () {
  const container = document.getElementById('orb-container');
  const orbWrap = document.getElementById('orb-wrap');
  const canvas = document.getElementById('orb-canvas');
  if (!container || !canvas) return;

  const DEFAULT_COLORS = ['#ff54a3', '#9961ff', '#47a3ff', '#61f2c7', '#ff9e6b'];

  function readColors() {
    try {
      const c = JSON.parse(localStorage.getItem('orbColors'));
      if (Array.isArray(c) && c.length === 5) return c;
    } catch (e) {}
    return DEFAULT_COLORS.slice();
  }
  let orbEnabled = localStorage.getItem('orbEnabled') !== 'false';
  let orbSize = parseInt(localStorage.getItem('orbSize') || '116', 10);
  // Inner colored sphere size, as a % of the glass shell. Lower = smaller core =
  // bigger gap to the shell = "thicker" looking glass. 82 keeps the original look.
  let orbCoreScale = parseInt(localStorage.getItem('orbCoreScale') || '82', 10);
  // The core geometry has radius 0.82, so a value of 82 maps to scale 1.0.
  let coreBaseScale = (orbCoreScale / 100) / 0.82;
  let orbGlassType = localStorage.getItem('orbGlassType') || 'thin';
  // Pulsation amplitude during speech synthesis. Stored as a percentage
  // (100 = default); used as a 0–2.5 multiplier on the speaking "breath".
  let orbPulse = parseFloat(localStorage.getItem('orbPulse') || '100') / 100;
  // Radial pulse rippling across the sphere when a Heartbeat fires.
  let orbHeartbeat = localStorage.getItem('orbHeartbeat') !== 'false';
  let orbPulseColor = localStorage.getItem('orbHeartColor') || '#ff4d6d';
  // Strength (0..2 multiplier) and speed (duration in s = 1.6 * 100/speed%).
  let orbPulseStrength = parseFloat(localStorage.getItem('orbPulseStrength') || '100') / 100;
  let orbPulseSpeed = parseFloat(localStorage.getItem('orbPulseSpeed') || '100') / 100;

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, premultipliedAlpha: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.4);

  // ---- Color core ----
  const cols = readColors().map((h) => new THREE.Color(h));
  const coreUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 0.30 },
    uIntensity: { value: 1.0 },
    uAudio: { value: 0.0 },
    uPulse: { value: 0.0 },           // current pulse strength (0 when idle)
    uPulseRadius: { value: 0.0 },     // expanding ring position (0 center → ~1.1 rim)
    uPulseColor: { value: new THREE.Color(orbPulseColor) },
    uCol0: { value: cols[0] },
    uCol1: { value: cols[1] },
    uCol2: { value: cols[2] },
    uCol3: { value: cols[3] },
    uCol4: { value: cols[4] },
  };
  const coreMat = new THREE.ShaderMaterial({
    uniforms: coreUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uAudio;
      uniform float uPulse;
      uniform float uPulseRadius;
      uniform vec3 uPulseColor;
      uniform vec3 uCol0, uCol1, uCol2, uCol3, uCol4;
      varying vec3 vPos;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;

      void main() {
        float t = uTime;
        float breath = 0.5 + 0.5 * sin(t * 0.8);
        float R = 0.82 * (1.0 + 0.03 * breath);
        float sharp = mix(5.0, 7.5, uAudio);
        float mv = 0.42 + uAudio * 0.25;

        vec3 colSum = vec3(0.0);
        float total = 0.0;
        vec3 dir; float w;

        dir = normalize(vec3( 0.6,  0.5,  0.4) + vec3(sin(t*0.61+1.7), sin(t*0.52+1.0), sin(t*0.73+2.0)) * mv);
        w = exp(-sharp * pow(distance(vPos, dir * R), 2.0)); colSum += uCol0 * w; total += w;
        dir = normalize(vec3(-0.5,  0.6, -0.2) + vec3(sin(t*0.55+0.3), sin(t*0.48+2.2), sin(t*0.66+0.9)) * mv);
        w = exp(-sharp * pow(distance(vPos, dir * R), 2.0)); colSum += uCol1 * w; total += w;
        dir = normalize(vec3( 0.2, -0.5,  0.7) + vec3(sin(t*0.70+2.5), sin(t*0.50+0.7), sin(t*0.60+3.1)) * mv);
        w = exp(-sharp * pow(distance(vPos, dir * R), 2.0)); colSum += uCol2 * w; total += w;
        dir = normalize(vec3(-0.55, -0.35, 0.5) + vec3(sin(t*0.50+1.1), sin(t*0.62+2.9), sin(t*0.58+1.5)) * mv);
        w = exp(-sharp * pow(distance(vPos, dir * R), 2.0)); colSum += uCol3 * w; total += w;
        dir = normalize(vec3( 0.45, 0.15, -0.6) + vec3(sin(t*0.66+0.5), sin(t*0.54+1.8), sin(t*0.70+2.4)) * mv);
        w = exp(-sharp * pow(distance(vPos, dir * R), 2.0)); colSum += uCol4 * w; total += w;

        vec3 blob = colSum / max(total, 0.0001);
        float presence = smoothstep(0.03, 0.70, total);

        // pastel at rest, much more saturated while thinking/speaking (uAudio up)
        float pastel = 0.16 * (1.0 - 0.85 * uAudio);
        vec3 col = mix(blob, vec3(1.0), pastel);
        col = mix(col, blob, uAudio * 0.55);

        float facing = max(dot(normalize(vViewNormal), normalize(-vViewPos)), 0.0);
        col *= 0.92 + 0.14 * facing;
        col *= uIntensity * (1.0 + uAudio * 0.22);

        // transparent between blobs (frosted desktop shows through)
        float alpha = 0.10 + presence * (0.60 + uAudio * 0.22);

        // Heartbeat: a colored ring rippling radially from the front center
        // out to the rim. uPulseRadius expands over time, uPulse fades it out.
        if (uPulse > 0.001) {
          float facing = max(dot(normalize(vViewNormal), normalize(-vViewPos)), 0.0);
          float rad = 1.0 - facing;                       // 0 center → 1 rim
          float ring = smoothstep(0.22, 0.0, abs(rad - uPulseRadius));
          col += uPulseColor * ring * uPulse * 1.4;
          alpha = clamp(alpha + ring * uPulse * 0.8, 0.0, 1.0);
        }

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.82, 64, 64), coreMat);
  scene.add(core);

  // ---- Glass shell (parameterized: several glass "types") ----
  // Each glass type is just a set of rim/specular/fill parameters fed to the
  // shader, so switching is instant and animation-friendly.
  const GLASS_TYPES = {
    thin:    { opacity: 0.42, rimPower: 4.5, rimStrength: 1.0,  specPower: 60.0,  specStrength: 0.45, fill: 0.0,  iridescence: 0 },
    crystal: { opacity: 0.70, rimPower: 3.0, rimStrength: 1.35, specPower: 100.0, specStrength: 0.85, fill: 0.0,  iridescence: 0 },
    frosted: { opacity: 0.55, rimPower: 2.2, rimStrength: 0.75, specPower: 22.0,  specStrength: 0.25, fill: 0.14, iridescence: 0 },
    bubble:  { opacity: 0.60, rimPower: 3.2, rimStrength: 1.15, specPower: 80.0,  specStrength: 0.55, fill: 0.02, iridescence: 1 },
    none:    { opacity: 0.0,  rimPower: 4.5, rimStrength: 0.0,  specPower: 60.0,  specStrength: 0.0,  fill: 0.0,  iridescence: 0 },
  };
  const shellUniforms = {
    uOpacity: { value: 0.42 },
    uRimPower: { value: 4.5 },
    uRimStrength: { value: 1.0 },
    uSpecPower: { value: 60.0 },
    uSpecStrength: { value: 0.45 },
    uFill: { value: 0.0 },
    uIridescence: { value: 0.0 },
  };
  const shellMat = new THREE.ShaderMaterial({
    uniforms: shellUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity, uRimPower, uRimStrength, uSpecPower, uSpecStrength, uFill, uIridescence;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 N = normalize(vViewNormal);
        vec3 V = normalize(-vViewPos);
        // bright rim at the edge — sharpness controlled by the glass type
        float fres = pow(1.0 - max(dot(N, V), 0.0), uRimPower);
        // tight specular highlight
        vec3 L = normalize(vec3(-0.35, 0.8, 0.5));
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), uSpecPower) * uSpecStrength;
        // soap-bubble iridescence: shift rim hue with the viewing angle
        vec3 rimCol = vec3(1.0);
        if (uIridescence > 0.5) {
          rimCol = 0.55 + 0.45 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + fres * 1.4));
        }
        vec3 color = rimCol * fres * uRimStrength + vec3(1.0) * spec;
        float alpha = clamp(fres * uRimStrength * 0.7 + spec + uFill, 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 64), shellMat);
  shell.renderOrder = 1;
  scene.add(shell);

  function setGlassType(name) {
    const g = GLASS_TYPES[name] || GLASS_TYPES.thin;
    orbGlassType = GLASS_TYPES[name] ? name : 'thin';
    shellUniforms.uOpacity.value = g.opacity;
    shellUniforms.uRimPower.value = g.rimPower;
    shellUniforms.uRimStrength.value = g.rimStrength;
    shellUniforms.uSpecPower.value = g.specPower;
    shellUniforms.uSpecStrength.value = g.specStrength;
    shellUniforms.uFill.value = g.fill;
    shellUniforms.uIridescence.value = g.iridescence;
  }
  setGlassType(orbGlassType);

  // ---- Inner mini-icons (themed avatars) ----------------------------------
  // Small white symbols orbiting *inside* the glass shell. Used by themes
  // (e.g. "rubis"). Drawn on a tiny canvas → CanvasTexture → camera-facing
  // Sprite, parented to a group we spin in animate(). Empty by default, so the
  // classic orb is untouched unless a theme asks for icons.
  const iconGroup = new THREE.Group();
  iconGroup.renderOrder = 2;
  scene.add(iconGroup);

  // Each painter draws a centered white glyph on a 2D context (64×64).
  const ICON_PAINTERS = {
    sphere(c, s) {
      const g = c.createRadialGradient(s * 0.38, s * 0.36, s * 0.04, s * 0.5, s * 0.5, s * 0.46);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0.55)');
      c.fillStyle = g;
      c.beginPath(); c.arc(s * 0.5, s * 0.5, s * 0.42, 0, Math.PI * 2); c.fill();
    },
    star(c, s) {
      c.fillStyle = '#fff'; c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.18 : s * 0.45;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const x = s * 0.5 + Math.cos(a) * r, y = s * 0.5 + Math.sin(a) * r;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath(); c.fill();
    },
    moon(c, s) {
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(s * 0.5, s * 0.5, s * 0.42, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.arc(s * 0.62, s * 0.44, s * 0.36, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'source-over';
    },
    heart(c, s) {
      c.fillStyle = '#fff'; c.beginPath();
      const x = s * 0.5, y = s * 0.34, w = s * 0.42, h = s * 0.40;
      c.moveTo(x, y + h * 0.28);
      c.bezierCurveTo(x + w * 0.5, y - h * 0.45, x + w * 1.1, y + h * 0.45, x, y + h * 1.1);
      c.bezierCurveTo(x - w * 1.1, y + h * 0.45, x - w * 0.5, y - h * 0.45, x, y + h * 0.28);
      c.fill();
    },
    bolt(c, s) {
      c.fillStyle = '#fff'; c.beginPath();
      c.moveTo(s * 0.56, s * 0.08); c.lineTo(s * 0.30, s * 0.54); c.lineTo(s * 0.47, s * 0.54);
      c.lineTo(s * 0.42, s * 0.92); c.lineTo(s * 0.70, s * 0.42); c.lineTo(s * 0.52, s * 0.42);
      c.closePath(); c.fill();
    },
    diamond(c, s) {
      c.fillStyle = '#fff'; c.beginPath();
      c.moveTo(s * 0.5, s * 0.1); c.lineTo(s * 0.88, s * 0.5);
      c.lineTo(s * 0.5, s * 0.9); c.lineTo(s * 0.12, s * 0.5);
      c.closePath(); c.fill();
    },
  };

  function makeIconTexture(name, hex) {
    const s = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    (ICON_PAINTERS[name] || ICON_PAINTERS.sphere)(ctx, s);
    if (hex && hex !== '#ffffff') {
      // Tint the white glyph by multiplying with the theme color.
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, s, s);
      ctx.globalCompositeOperation = 'source-over';
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function clearInnerIcons() {
    for (let i = iconGroup.children.length - 1; i >= 0; i--) {
      const sp = iconGroup.children[i];
      iconGroup.remove(sp);
      if (sp.material) { sp.material.map?.dispose(); sp.material.dispose(); }
    }
  }

  // list: array of icon names (or empty/null to clear). color: optional hex.
  function setInnerIcons(list, color) {
    clearInnerIcons();
    if (!Array.isArray(list) || list.length === 0) return;
    const n = list.length;
    const ring = 0.46;       // orbit radius (inside the 0.82 core)
    list.forEach((name, i) => {
      const tex = makeIconTexture(name, color || '#ffffff');
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: false,
        opacity: 0.95,
      });
      const sp = new THREE.Sprite(mat);
      const a = (i / n) * Math.PI * 2;
      // Distribute on a tilted ring for a 3D "orbiting inside" feel.
      sp.position.set(Math.cos(a) * ring, Math.sin(a) * ring * 0.55, Math.sin(a) * ring * 0.7);
      sp.scale.setScalar(0.30);
      iconGroup.add(sp);
    });
  }

  // ---- Sizing ----
  function applySize(px) {
    orbSize = px;
    container.style.width = px + 'px';
    container.style.height = px + 'px';
    if (orbWrap) orbWrap.style.height = (px + 12) + 'px';
    resize();
  }
  function resize() {
    const w = container.clientWidth || 116;
    const h = container.clientHeight || 116;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  applySize(orbSize);
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(container);

  // ---- State machine ----
  let state = 'idle';
  const targets = { speed: 0.30, intensity: 1.0 };
  function setState(next) {
    state = next;
    if (next === 'thinking') { targets.speed = 1.1; targets.intensity = 1.12; }
    else if (next === 'speaking') { targets.speed = 0.7; targets.intensity = 1.18; }
    else { targets.speed = 0.30; targets.intensity = 1.0; }
    container.dataset.state = next;
  }

  // The amber/"lightning" color of the Action-mode toolbar button. While the
  // router runs a tool/action, all blobs flip to this so the user sees the orb
  // is *executing*, not merely thinking.
  const ACTION_COLOR = '#ff9e6b';
  let activePalette = readColors();   // the user's configured palette
  let actionExecuting = false;

  function applyPalette(arr) {
    coreUniforms.uCol0.value.set(arr[0]);
    coreUniforms.uCol1.value.set(arr[1]);
    coreUniforms.uCol2.value.set(arr[2]);
    coreUniforms.uCol3.value.set(arr[3]);
    coreUniforms.uCol4.value.set(arr[4]);
  }

  function setColors(hexArray) {
    if (!Array.isArray(hexArray) || hexArray.length !== 5) return;
    activePalette = hexArray.slice();
    // Don't override the action color while a tool is running; the palette is
    // restored automatically when execution ends.
    if (!actionExecuting) applyPalette(activePalette);
  }

  // Flip every blob to the action color (and energize the motion) while the
  // router executes; restore the user's palette + current state when it ends.
  function setActionExecuting(on) {
    on = !!on;
    if (on === actionExecuting) return;
    actionExecuting = on;
    if (on) {
      applyPalette([ACTION_COLOR, ACTION_COLOR, ACTION_COLOR, ACTION_COLOR, ACTION_COLOR]);
      container.dataset.action = 'executing';
      targets.speed = 1.35;
      targets.intensity = 1.28;
    } else {
      applyPalette(activePalette);
      delete container.dataset.action;
      setState(state); // re-derive speed/intensity for the current state
    }
  }

  function setSize(px) { applySize(px); }

  function setCoreScale(pct) {
    orbCoreScale = pct;
    coreBaseScale = (pct / 100) / 0.82;
  }

  function setPulse(pct) { orbPulse = pct / 100; }

  function setHeartbeat(on) { orbHeartbeat = !!on; }
  function setHeartColor(hex) {
    if (typeof hex !== 'string') return;
    orbPulseColor = hex;
    coreUniforms.uPulseColor.value.set(hex);
  }
  function setPulseStrength(pct) { orbPulseStrength = pct / 100; }
  function setPulseSpeed(pct) { orbPulseSpeed = Math.max(pct, 10) / 100; }

  // ---- Radial heartbeat pulse (a colored ring rippling across the sphere) ----
  let pulseActive = false;
  let pulseStart = 0;
  function pulseDuration() { return 1.6 / orbPulseSpeed; }
  function pulseHeart() {
    if (!orbHeartbeat || !orbEnabled) return;
    pulseStart = clock.elapsedTime;
    pulseActive = true;
  }

  function setEnabled(on) {
    orbEnabled = on;
    if (orbWrap) orbWrap.style.display = on ? '' : 'none';
    if (on) { resize(); start(); } else { stop(); }
  }

  window.LumenOrb = {
    setState, setColors, setActionExecuting, setSize, setCoreScale, setGlassType, setPulse, setEnabled,
    setHeartbeat, setHeartColor, setPulseStrength, setPulseSpeed, pulseHeart, setInnerIcons,
    DEFAULT_COLORS, GLASS_TYPES,
  };

  // ---- Eyes follow the cursor (centered while speaking) ----
  const eyesEl = document.getElementById('orb-eyes');
  const eyeTarget = { x: 0, y: 0 };
  const eyeNow = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    const r = container.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    eyeTarget.x = Math.max(-1, Math.min(1, (e.clientX - cx) / 130)) * 6.5;
    eyeTarget.y = Math.max(-1, Math.min(1, (e.clientY - cy) / 130)) * 4.8;
  });
  window.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) { eyeTarget.x = 0; eyeTarget.y = 0; }
  });

  // ---- Animation ----
  const clock = new THREE.Clock();
  let raf = null;
  let colorTime = 0;
  let audioLevel = 0;

  function voiceEnvelope(t) {
    let a = Math.abs(Math.sin(t * 8.5));
    a *= 0.55 + 0.45 * Math.sin(t * 3.1 + 1.0);
    a *= 0.6 + 0.4 * Math.sin(t * 1.6 + 0.5);
    a += 0.12 * Math.sin(t * 21.0);
    return Math.max(0, Math.min(1, a));
  }

  function animate() {
    raf = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    coreUniforms.uSpeed.value += (targets.speed - coreUniforms.uSpeed.value) * 0.05;
    coreUniforms.uIntensity.value += (targets.intensity - coreUniforms.uIntensity.value) * 0.06;

    let audioTarget;
    if (state === 'speaking') audioTarget = 0.40 + 0.60 * voiceEnvelope(t);
    else if (state === 'thinking') audioTarget = 0.40 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.0));
    else audioTarget = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.8));
    const k = state === 'speaking' ? 0.35 : 0.06;
    audioLevel += (audioTarget - audioLevel) * k;
    coreUniforms.uAudio.value = audioLevel;

    colorTime += dt * coreUniforms.uSpeed.value * 3.0;
    coreUniforms.uTime.value = colorTime;

    // Heartbeat ripple: expand the ring outward while fading it out.
    if (pulseActive) {
      const pe = (clock.elapsedTime - pulseStart) / pulseDuration();
      if (pe >= 1.0) {
        pulseActive = false;
        coreUniforms.uPulse.value = 0.0;
        coreUniforms.uPulseRadius.value = 0.0;
      } else {
        coreUniforms.uPulseRadius.value = pe * 1.1;
        coreUniforms.uPulse.value = (1.0 - pe) * orbPulseStrength;
      }
    }

    core.rotation.y += dt * 0.25;
    core.rotation.x = Math.sin(t * 0.3) * 0.12;
    shell.rotation.copy(core.rotation);

    // Spin the themed inner icons (if any) on their own slow orbit.
    if (iconGroup.children.length) {
      iconGroup.rotation.y += dt * 0.6;
      iconGroup.rotation.x = Math.sin(t * 0.4) * 0.18;
    }

    const scale = 1.0 + (state === 'speaking' ? audioLevel * 0.05 * orbPulse : Math.sin(t * 1.0) * 0.012);
    core.scale.setScalar(scale * coreBaseScale);
    shell.scale.setScalar(scale);
    container.style.setProperty('--orb-bob', `${Math.sin(t * 1.1) * 4}px`);

    // eyes: track cursor, but stay centered while speaking
    const speaking = state === 'speaking';
    const tx = speaking ? 0 : eyeTarget.x;
    const ty = speaking ? 0 : eyeTarget.y;
    eyeNow.x += (tx - eyeNow.x) * 0.12;
    eyeNow.y += (ty - eyeNow.y) * 0.12;
    if (eyesEl) eyesEl.style.transform = `translate(${eyeNow.x}px, ${eyeNow.y - 4}px)`;

    renderer.render(scene, camera);
  }

  function start() { if (!raf) { clock.start(); animate(); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (orbEnabled) start();
  });

  if (orbEnabled) start(); else setEnabled(false);
})();
