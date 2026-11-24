/* Gaze demo: scripted suggestions, real gaze selection with MediaPipe Face Landmarker. Tap always works as a backup. */
(function () {
  'use strict';
  var MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  var MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  var $ = function (s) { return document.querySelector(s); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    var SCENARIOS = window.TB_SCENARIOS; // defined in ../shared/scenarios.js

  var st = { scn: 0, cur: null, set: 0, phase: 'idle', said: [], ctx: '', last: '', cam: false, dwellMs: 1500, timer: null, run: 0 };
  var tg = Array.prototype.slice.call(document.querySelectorAll('.tgt'));
  var video = $('#video');

  /* ---------- Speech ---------- */
  function speak(text, silent) {
    try {
      if (!('speechSynthesis' in window)) return;
      if (!silent) window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; if (silent) u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  }

  /* ---------- Conversation flow ---------- */
  function turn() { return st.cur || SCENARIOS[st.scn].first; }
  function startScenario() { clearTimeout(st.timer); st.cur = SCENARIOS[st.scn].first; st.said = []; beginTurn(); }
  function beginTurn() {
    st.set = 0; st.phase = 'reading';
    st.ctx = turn().context || (st.said.length ? 'You just said: ' + st.said[st.said.length - 1] : '');
    render();
    st.timer = setTimeout(function () { st.phase = 'guessing'; armGaze(); render(); }, 1100);
  }
  function select(i) {
    if (st.phase !== 'guessing') return;
    if (i === 3) {
      if (st.set + 1 < turn().sets.length) { st.set++; armGaze(); render(); }
      else { st.phase = 'nomore'; render(); }
      return;
    }
    var text = turn().sets[st.set][i][0];
    var next = turn().follow && turn().follow[text];
    st.said.push(text); st.last = text; st.phase = 'spoken'; speak(text); render();
    st.timer = setTimeout(function () {
      if (next) { st.cur = next; beginTurn(); } else { st.phase = 'done'; render(); }
    }, 2400);
  }

  function render() {
    var t = turn(), opts = st.phase === 'guessing' ? t.sets[st.set] : null;
    tg.forEach(function (el, i) {
      el.classList.remove('cal', 'on', 'look'); el.style.setProperty('--p', 0);
      if (!opts) { el.classList.add('off'); return; }
      el.classList.remove('off');
      el.querySelector('.t').textContent = i < 3 ? opts[i][0] : 'None of these';
      el.querySelector('.pct').textContent = i < 3 ? opts[i][1] + '% sure' : '';
    });
    var m = '';
    if (st.phase === 'reading') m = '<p class="prompt">Reading signals…</p>';
    else if (st.phase === 'guessing') {
      m = (st.ctx ? '<p class="context">' + esc(st.ctx) + '</p>' : '') +
          '<p class="prompt">' + (st.set > 0 ? 'More ideas. ' : '') + 'Did you mean…</p>' +
          '<p class="context">' + (st.cam && gaze.cents ? 'Look at the middle, then look at your answer and hold.' : 'Tap your answer.') + '</p>';
    }
    else if (st.phase === 'spoken') m = '<p class="spoken"><small>Speaking aloud</small>' + esc(st.last) + '</p>';
    else if (st.phase === 'nomore') m = '<p class="context">No more scripted suggestions. The real app would open a full word board here.</p><div class="btnrow"><button class="ghost" data-act="again">Try again</button></div>';
    else if (st.phase === 'done') m = '<p class="prompt">Scenario finished</p><div class="btnrow"><button class="big" data-act="again">Play again</button><button class="ghost" data-act="menu">Change scenario</button></div>';
    $('#mid').innerHTML = m;
    $('#said').innerHTML = st.phase === 'calib' ? '' : st.said.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  }

  /* ---------- Gaze: features, calibration, classification, dwell ---------- */
  var NAMES = ['the middle', 'top left', 'top right', 'bottom left', 'bottom right'];
  var gaze = { cents: null, scale: null, f: null, cur: -1, acc: 0, armed: false, armTimer: null };
  var cal = { collecting: false, samples: [] };
  var landmarker = null, lastVT = -1, lastT = 0;

  function armGaze() {
    gaze.armed = false; gaze.cur = -1; gaze.acc = 0;
    clearTimeout(gaze.armTimer);
    // Normally the child looks at the middle to begin. If that is never detected, arm anyway after a pause.
    gaze.armTimer = setTimeout(function () { gaze.armed = true; }, 4000);
  }

  // Turn one camera frame into four numbers: eye direction (left-right, up-down) and head turn (left-right, up-down).
  function feature(res) {
    if (!res || !res.faceLandmarks || !res.faceLandmarks.length || !res.faceBlendshapes || !res.faceBlendshapes.length) return null;
    var b = {}; res.faceBlendshapes[0].categories.forEach(function (c) { b[c.categoryName] = c.score; });
    var lm = res.faceLandmarks[0];
    var h = ((b.eyeLookOutLeft - b.eyeLookInLeft) + (b.eyeLookInRight - b.eyeLookOutRight)) / 2;
    var v = ((b.eyeLookUpLeft + b.eyeLookUpRight) - (b.eyeLookDownLeft + b.eyeLookDownRight)) / 2;
    var w = Math.abs(lm[454].x - lm[234].x) || 1, ht = Math.abs(lm[152].y - lm[10].y) || 1;
    var yaw = (lm[1].x - (lm[234].x + lm[454].x) / 2) / w;
    var pitch = (lm[1].y - (lm[10].y + lm[152].y) / 2) / ht;
    var f = [h, v, yaw, pitch];
    return f.every(isFinite) ? f : null;
  }

  // Nearest calibrated target. Returns 0 (middle) to 4, or -1 when it is not clear.
  function classify(f) {
    var d = gaze.cents.map(function (c) {
      var s = 0; for (var i = 0; i < 4; i++) { var x = (f[i] - c[i]) / gaze.scale[i]; s += x * x; } return s;
    });
    var best = 0, second = -1;
    for (var k = 1; k < d.length; k++) { if (d[k] < d[best]) { second = best; best = k; } else if (second < 0 || d[k] < d[second]) second = k; }
    if (d[best] > 2.5) return -1;
    if ((d[second] - d[best]) / (d[second] || 1) < 0.2) return -1;
    return best;
  }

  function onFrame(f, dt) {
    if (cal.collecting) { if (f) cal.samples.push(f); return; }
    if (st.phase === 'calib') return;
    if (st.phase !== 'guessing' || !gaze.cents) { $('#status').textContent = f ? 'Face found' : 'No face found'; return; }
    var c = f ? classify(f) : -1;
    if (c === 0) { gaze.armed = true; gaze.cur = -1; gaze.acc = 0; }
    else if (c > 0 && gaze.armed) { if (c === gaze.cur) gaze.acc += dt; else { gaze.cur = c; gaze.acc = 0; } }
    else gaze.acc = Math.max(0, gaze.acc - dt * 1.5);
    var p = Math.min(1, gaze.acc / st.dwellMs);
    tg.forEach(function (el, i) { var on = gaze.armed && i === gaze.cur - 1; el.classList.toggle('look', on); el.style.setProperty('--p', on ? p : 0); });
    $('#status').textContent = !f ? 'No face found' : c < 0 ? 'Not sure where you are looking' : !gaze.armed ? 'Look at the middle to begin' : 'Looking at ' + NAMES[c];
    if (p >= 1) { var i = gaze.cur - 1; gaze.armed = false; gaze.cur = -1; gaze.acc = 0; select(i); }
  }

  function loop(now) {
    if (!st.cam) return;
    if (video.readyState >= 2 && video.currentTime !== lastVT) {
      lastVT = video.currentTime;
      var res = null; try { res = landmarker.detectForVideo(video, now); } catch (e) { res = null; }
      var raw = feature(res);
      if (!raw) gaze.f = null;
      else if (!gaze.f) gaze.f = raw;
      else gaze.f = gaze.f.map(function (x, i) { return x + 0.4 * (raw[i] - x); }); // smooth out jitter
      var dt = Math.min(200, now - (lastT || now)); lastT = now;
      onFrame(gaze.f, dt);
    }
    requestAnimationFrame(loop);
  }

  /* ---------- Choosing the camera ---------- */
  var camIds = [], camIdx = 0, SIZE = { width: { ideal: 640 }, height: { ideal: 480 } };
  function openCam(video) { return navigator.mediaDevices.getUserMedia({ video: Object.assign({}, SIZE, video), audio: false }); }
  function stopCam(stream) { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); }

  // Ask for the front (selfie) camera. Some tablets hand back the rear one anyway, so check and correct.
  async function frontStream() {
    var stream;
    try { stream = await openCam({ facingMode: { exact: 'user' } }); }
    catch (e) { stream = await openCam({ facingMode: 'user' }); }
    var track = stream.getVideoTracks()[0], set = track.getSettings ? track.getSettings() : {};
    var cams = (await navigator.mediaDevices.enumerateDevices()).filter(function (d) { return d.kind === 'videoinput'; });
    if (set.facingMode === 'environment' || /back|rear|environment/i.test(track.label)) {
      var front = cams.filter(function (d) { return /front|user|facetime|selfie/i.test(d.label); })[0];
      if (front) { stopCam(stream); stream = await openCam({ deviceId: { exact: front.deviceId } }); set = stream.getVideoTracks()[0].getSettings(); }
    }
    camIds = cams.map(function (d) { return d.deviceId; });
    camIdx = Math.max(0, camIds.indexOf(set.deviceId));
    $('#swap').hidden = camIds.length < 2;
    return stream;
  }

  // Manual override: step to the next camera on the device.
  async function switchCamera() {
    if (camIds.length < 2) return;
    camIdx = (camIdx + 1) % camIds.length;
    stopCam(video.srcObject);
    video.srcObject = await openCam({ deviceId: { exact: camIds[camIdx] } });
    await video.play();
    gaze.cents = null; gaze.f = null; // the old setup no longer matches this camera
  }

  async function startCamera() {
    if (st.cam) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot use the camera here. The page must be opened over https.');
    var stream = await frontStream();
    video.srcObject = stream; await video.play();
    $('#camrow').hidden = false; $('#status').textContent = 'Loading the face tracker';
    var mod = await import(MP + '/vision_bundle.mjs');
    var v = mod.FaceLandmarker ? mod : mod.default;
    var files = await v.FilesetResolver.forVisionTasks(MP + '/wasm');
    landmarker = await v.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true
    });
    st.cam = true; requestAnimationFrame(loop);
    return true;
  }

  // Setup: the person looks at the middle and each corner in turn while we record what that looks like for them.
  async function calibrate() {
    var run = ++st.run;
    clearTimeout(st.timer); st.phase = 'calib'; gaze.cents = null; render();
    tg.forEach(function (el) { el.classList.remove('off'); el.classList.add('cal'); el.querySelector('.t').textContent = ''; el.querySelector('.pct').textContent = ''; });
    var cents = [];
    for (var k = 0; k < 5; k++) {
      var tries = 0;
      while (true) {
        if (run !== st.run) return null;
        tg.forEach(function (el, i) { el.classList.toggle('on', i === k - 1); });
        $('#mid').innerHTML = '<p class="prompt">Setup ' + (k + 1) + ' of 5</p><p class="context">Look at the yellow dot and keep looking.</p>' + (k === 0 ? '<div class="cdot"></div>' : '');
        $('#status').textContent = 'Look at ' + NAMES[k];
        await sleep(1300);
        cal.samples = []; cal.collecting = true; await sleep(1500); cal.collecting = false;
        if (run !== st.run) return null;
        if (cal.samples.length >= 8) {
          var mean = [0, 0, 0, 0];
          cal.samples.forEach(function (s) { for (var i = 0; i < 4; i++) mean[i] += s[i] / cal.samples.length; });
          cents[k] = mean; break;
        }
        if (++tries >= 3) return false;
        $('#mid').innerHTML = '<p class="prompt">I cannot see a face</p><p class="context">Check the light, move closer and keep the device still.</p>';
        await sleep(1800);
      }
    }
    tg.forEach(function (el) { el.classList.remove('cal', 'on'); });
    // Scale each of the four numbers by how much it varied between targets, so no one number dominates.
    gaze.scale = [0, 1, 2, 3].map(function (i) {
      var vals = cents.map(function (c) { return c[i]; });
      return Math.max(Math.max.apply(null, vals) - Math.min.apply(null, vals), 0.03);
    });
    gaze.cents = cents;
    return true;
  }

  /* ---------- Screens and buttons ---------- */
  function showApp(on) { $('#app').hidden = !on; $('#intro').hidden = on; }
  function introMsg(text) { var el = $('#introMsg'); el.hidden = !text; el.textContent = text || ''; }
  function renderIntro() {
    $('#scn').innerHTML = SCENARIOS.map(function (x, i) {
      return '<button data-scn="' + i + '" aria-pressed="' + (i === st.scn) + '"><b>' + esc(x.name) + '</b><span>' + esc(x.blurb) + '</span></button>';
    }).join('');
    $('#recal').hidden = !(st.cam && gaze.cents);
    $('#startCam').textContent = st.cam && gaze.cents ? 'Start (camera is set up)' : 'Start with camera';
  }

  async function begin(withCam, forceCal) {
    introMsg(''); speak(' ', true); // unlocks speech on phones, which need a tap first
    showApp(true); st.phase = 'reading'; st.said = []; render();
    if (withCam) {
      try {
        $('#mid').innerHTML = '<p class="prompt">Starting the camera…</p><p class="context">Allow camera access when asked. The first start downloads the face tracker and can take a moment.</p>';
        await startCamera();
        if (forceCal || !gaze.cents) {
          var ok = await calibrate();
          if (ok === null) return; // setup was restarted or the menu was opened
          if (!ok) { noFace(); return; }
        }
      } catch (e) {
        showApp(false); renderIntro();
        introMsg('The camera could not start: ' + (e && e.message ? e.message : 'unknown error') + ' You can still start without the camera.');
        return;
      }
    }
    startScenario();
  }

  function noFace() { showApp(false); renderIntro(); introMsg('Setup could not see a face clearly. Check the tips below and try again, or start without the camera.'); }
  $('#swap').addEventListener('click', async function () {
    try {
      await switchCamera();
      var ok = await calibrate();
      if (ok) startScenario(); else if (ok === false) noFace();
    } catch (e) { $('#status').textContent = 'Could not switch camera'; }
  });
  $('#scn').addEventListener('click', function (e) { var b = e.target.closest('button[data-scn]'); if (b) { st.scn = +b.dataset.scn; renderIntro(); } });
  $('#dwell').addEventListener('input', function () { st.dwellMs = +this.value * 1000; $('#dwellOut').textContent = (+this.value).toFixed(1) + ' s'; });
  $('#startCam').addEventListener('click', function () { begin(true, false); });
  $('#recal').addEventListener('click', function () { begin(true, true); });
  $('#startTap').addEventListener('click', function () { begin(false, false); });
  $('#menu').addEventListener('click', function () { st.run++; clearTimeout(st.timer); st.phase = 'idle'; showApp(false); renderIntro(); });
  tg.forEach(function (el) { el.addEventListener('click', function () { select(+el.dataset.i); }); });
  $('#mid').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    if (b.dataset.act === 'again') startScenario(); else $('#menu').click();
  });

  renderIntro();
})();
