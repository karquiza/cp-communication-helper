/* Gaze demo: scripted suggestions, real gaze selection with MediaPipe Face Landmarker. Tap always works as a backup. */
(function () {
  'use strict';
  var MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  var MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  var $ = function (s) { return document.querySelector(s); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    var SCENARIOS = window.TB_SCENARIOS; // defined in ../shared/scenarios.js

  var st = { scn: 0, cur: null, set: 0, phase: 'idle', said: [], ctx: '', last: '', cam: false, mic: false, shake: true, fromBuild: false, note: '', noteUntil: 0, dwellMs: 1500, timer: null, run: 0 };
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
  function turn() { return st.cur || (SCENARIOS[st.scn] || SCENARIOS[0]).first; }
  function startScenario() {
    clearTimeout(st.timer); st.said = [];
    if (st.scn < 0) { startBuild(); return; }   // "Build my own sentence" was chosen on the start screen
    st.cur = SCENARIOS[st.scn].first; beginTurn();
  }
  // Sentence builder: choose words one at a time. Corners 1 to 3 are suggestions, corner 4 shows more words.
  var builder = null;
  function startBuild() { clearTimeout(st.timer); builder = window.TB_Builder(); st.phase = 'build'; armGaze(); render(); }
  function buildSelect(i) {
    if (i === 3) { builder.more(); armGaze(); render(); return; }
    var said = builder.pick(i);
    if (!said) { armGaze(); render(); return; }
    st.said.push(said); st.last = said; st.fromBuild = true; st.phase = 'spoken'; speak(said); render();
    st.timer = setTimeout(function () { st.phase = 'build'; armGaze(); render(); }, 2400);
  }
  function beginTurn() {
    st.set = 0; st.phase = 'reading';
    st.ctx = turn().context || (st.said.length ? 'You just said: ' + st.said[st.said.length - 1] : '');
    render();
    st.timer = setTimeout(function () { st.phase = 'guessing'; armGaze(); render(); }, 1100);
  }
  function select(i) {
    if (st.phase === 'build') { buildSelect(i); return; }
    if (st.phase !== 'guessing') return;
    if (i === 3) {
      if (st.set + 1 < turn().sets.length) { st.set++; armGaze(); render(); }
      else { st.phase = 'nomore'; render(); }
      return;
    }
    var text = turn().sets[st.set][i][0];
    var next = turn().follow && turn().follow[text];
    st.said.push(text); st.last = text; st.fromBuild = false; st.phase = 'spoken'; speak(text); render();
    st.timer = setTimeout(function () {
      if (next) { st.cur = next; beginTurn(); } else { st.phase = 'done'; render(); }
    }, 2400);
  }

  function render() {
    var t = turn(), labels = null; // four corner labels: [text, small text], or null for an empty corner
    if (st.phase === 'guessing') labels = t.sets[st.set].map(function (o) { return [o[0], o[1] + '% sure']; }).concat([['None of these', '']]);
    else if (st.phase === 'build') {
      var o3 = builder.options();
      labels = [0, 1, 2].map(function (i) { return o3[i] ? [o3[i].label, o3[i].act ? '' : 'word'] : null; }).concat([['More words', '']]);
    }
    tg.forEach(function (el, i) {
      el.classList.remove('cal', 'on', 'look'); el.style.setProperty('--p', 0);
      el.classList.toggle('none', i === 3 && st.phase === 'guessing');
      if (!labels || !labels[i]) { el.classList.add('off'); return; }
      el.classList.remove('off');
      el.querySelector('.t').textContent = labels[i][0];
      el.querySelector('.pct').textContent = labels[i][1];
    });
    var m = '';
    if (st.phase === 'reading') m = '<p class="prompt">Reading signals…</p>';
    else if (st.phase === 'guessing') {
      m = (st.ctx ? '<p class="context">' + esc(st.ctx) + '</p>' : '') +
          '<p class="prompt">' + (st.set > 0 ? 'More ideas. ' : '') + 'Did you mean…</p>' +
          '<p class="context">' + (st.cam && gaze.cents ? 'Look at the middle, then look at your answer and hold.' : 'Tap your answer.') + '</p>';
    }
    else if (st.phase === 'build') {
      var sentence = builder.text();
      m = '<p class="context">Your sentence</p><p class="prompt">' + (sentence ? esc(sentence) : 'Choose a first word') + '</p>' +
          '<p class="context">' + (st.cam && gaze.cents ? 'Look at the middle, then look at a word and hold.' : 'Tap a word.') + '</p>';
    }
    else if (st.phase === 'spoken') m = '<p class="spoken"><small>Speaking aloud</small>' + esc(st.last) + '</p>';
    else if (st.phase === 'nomore') m = '<p class="context">No more scripted suggestions. You can build your own sentence instead.</p><div class="btnrow"><button class="big" data-act="build">Build my own sentence</button><button class="ghost" data-act="again">Try again</button></div>';
    else if (st.phase === 'done') m = '<p class="prompt">Scenario finished</p><div class="btnrow"><button class="big" data-act="again">Play again</button><button class="ghost" data-act="menu">Change scenario</button></div>';
    if (audio.an) m = m.replace('and hold.', 'then hold or make a sound.');
    if (st.cam && st.shake && st.phase === 'guessing') m += '<p class="context">Shake your head for none of these.</p>';
    if (st.note && performance.now() < st.noteUntil && (st.phase === 'guessing' || st.phase === 'build' || st.phase === 'nomore')) m = '<p class="msg">' + esc(st.note) + '</p>' + m;
    $('#mid').innerHTML = m;
    $('#said').innerHTML = st.phase === 'calib' ? '' : st.said.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  }

  /* ---------- Gaze: features, calibration, classification, dwell ---------- */
  var NAMES = ['the middle', 'top left', 'top right', 'bottom left', 'bottom right'];
  var gaze = { cents: null, scale: null, f: null, cur: -1, acc: 0, armed: false, armTimer: null, off: [0, 0, 0, 0], dsum: [0, 0, 0, 0], dn: 0 };
  var cal = { collecting: false, samples: [] };
  var landmarker = null, lastVT = -1, lastT = 0;

  function armGaze() {
    applyDrift();
    gaze.armed = false; gaze.cur = -1; gaze.acc = 0;
    audio.loudMs = 0; audio.quietUntil = performance.now() + 1000; // ignore the tail of the phone's own voice
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
  // `gaze.off` is how far the person has drifted from where they sat during setup (see "Drift" below).
  function dists(f) {
    return gaze.cents.map(function (c) {
      var s = 0; for (var i = 0; i < 4; i++) { var x = (f[i] - gaze.off[i] - c[i]) / gaze.scale[i]; s += x * x; } return s;
    });
  }
  function classify(f) {
    var d = dists(f);
    var best = 0, second = -1;
    for (var k = 1; k < d.length; k++) { if (d[k] < d[best]) { second = best; best = k; } else if (second < 0 || d[k] < d[second]) second = k; }
    if (d[best] > 2.5) return -1;
    if ((d[second] - d[best]) / (d[second] || 1) < 0.2) return -1;
    return best;
  }

  /* ---------- Drift: keep working when the person shifts position after setup ----------
     Setup records absolute numbers, so a small change of posture moves every reading the same way.
     We measure that shift whenever the person is probably looking at the middle, and subtract it. */
  function nudge(target, rate) { // move the offset part of the way towards `target` (a reading taken while looking at the middle)
    for (var i = 0; i < 4; i++) gaze.off[i] += rate * (target[i] - gaze.cents[0][i] - gaze.off[i]);
  }
  // While a message is being spoken or loaded, the person reads the middle of the screen. Use that as a free re-centre.
  function applyDrift() {
    if (gaze.cents && gaze.dn >= 10) {
      var mean = gaze.dsum.map(function (x) { return x / gaze.dn; }), d = dists(mean), best = 0;
      for (var k = 1; k < d.length; k++) if (d[k] < d[best]) best = k;
      if (best === 0) nudge(mean, 0.6); // only trust it if it still looks more like the middle than any corner
    }
    gaze.dsum = [0, 0, 0, 0]; gaze.dn = 0;
  }
  // Manual version: the "Re-centre" button. One second of looking at the middle replaces the offset outright.
  async function recentre() {
    if (!gaze.cents || cal.collecting) return;
    $('#status').textContent = 'Look at the middle of the screen';
    cal.samples = []; cal.collecting = true; await sleep(1200); cal.collecting = false;
    if (cal.samples.length < 6) { $('#status').textContent = 'No face found. Not re-centred.'; return; }
    var mean = [0, 0, 0, 0];
    cal.samples.forEach(function (s) { for (var i = 0; i < 4; i++) mean[i] += s[i] / cal.samples.length; });
    nudge(mean, 1); armGaze();
  }

  /* ---------- Head shake means "no" ----------
     Watches the head-turn number for a quick left-right-left. Three changes of direction inside 1.5 seconds count as a shake. */
  var shake = { dir: 0, ext: null, turns: [], quietUntil: 0 }, SHAKE_SIZE = 0.05;
  function shakeTick(yaw, now) {
    if (shake.ext === null) { shake.ext = yaw; return false; }
    var d = yaw - shake.ext;
    if (shake.dir === 0) { if (Math.abs(d) > SHAKE_SIZE) { shake.dir = d > 0 ? 1 : -1; shake.ext = yaw; } return false; }
    if (d * shake.dir > 0) { shake.ext = yaw; return false; }            // still turning the same way: follow it
    if (Math.abs(d) < SHAKE_SIZE) return false;                           // small wobble: ignore
    shake.dir = -shake.dir; shake.ext = yaw; shake.turns.push(now);       // the head has turned back: one change of direction
    shake.turns = shake.turns.filter(function (t) { return now - t < 1500; });
    if (shake.turns.length >= 3 && now > shake.quietUntil) { shake.turns = []; shake.quietUntil = now + 1500; return true; }
    return false;
  }
  function onShake() {
    var now = performance.now();
    if (st.phase === 'guessing') { st.note = 'Head shake seen: not these.'; st.noteUntil = now + 3500; select(3); }
    else if (st.phase === 'build' && builder.text()) { builder.undo(); st.note = 'Head shake seen: last word removed.'; st.noteUntil = now + 3500; armGaze(); render(); }
    else if (st.phase === 'spoken' && !st.fromBuild) { // "that is not what I meant": take the message back and ask again
      clearTimeout(st.timer); try { window.speechSynthesis.cancel(); } catch (e) {}
      st.said.pop(); st.note = 'Head shake seen: taken back. Choose again.'; st.noteUntil = now + 3500;
      st.phase = 'guessing'; armGaze(); render();
    }
  }

  function onFrame(f, dt, sound) {
    if (cal.collecting) { if (f) cal.samples.push(f); return; }
    if (st.phase === 'calib') return;
    if (st.shake && f && shakeTick(f[2], performance.now())) { onShake(); return; }
    if ((st.phase !== 'guessing' && st.phase !== 'build') || !gaze.cents) {
      if (f && gaze.cents && (st.phase === 'spoken' || st.phase === 'reading')) { for (var q = 0; q < 4; q++) gaze.dsum[q] += f[q]; gaze.dn++; }
      $('#status').textContent = f ? 'Face found' : 'No face found'; return;
    }
    var c = f ? classify(f) : -1;
    if (c === 0) { gaze.armed = true; gaze.cur = -1; gaze.acc = 0; nudge(f, 0.03); } // every look at the middle also corrects drift a little
    else if (c > 0 && gaze.armed) { if (c === gaze.cur) gaze.acc += dt; else { gaze.cur = c; gaze.acc = 0; } }
    else gaze.acc = Math.max(0, gaze.acc - dt * 1.5);
    var p = Math.min(1, gaze.acc / st.dwellMs);
    // Two weak signals together: a short look plus a sound chooses straight away, without waiting out the hold.
    if (sound && gaze.armed && gaze.cur > 0 && gaze.acc >= 350) p = 1;
    tg.forEach(function (el, i) { var on = gaze.armed && i === gaze.cur - 1; el.classList.toggle('look', on); el.style.setProperty('--p', on ? p : 0); });
    $('#status').textContent = !f ? 'No face found' : c < 0 ? 'Not sure where you are looking' : !gaze.armed ? 'Look at the middle to begin' : 'Looking at ' + NAMES[c] + (audio.an && c > 0 ? '. Hold, or make a sound.' : '');
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
      onFrame(gaze.f, dt, soundTick(dt, now));
    }
    requestAnimationFrame(loop);
  }

  /* ---------- Sound as a second signal ----------
     Listens for loudness only. Any deliberate sound counts; no words are recognised and nothing is recorded. */
  var audio = { ctx: null, src: null, an: null, buf: null, floor: 0.01, loudMs: 0, quietUntil: 0 };
  function initAudio() { // must run inside a tap, or phones keep the audio engine asleep
    if (!st.mic || audio.ctx) return;
    try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { st.mic = false; }
  }
  function hookAudio(stream) {
    audio.an = null; $('#meterRow').hidden = true;
    if (!st.mic || !audio.ctx || !stream.getAudioTracks().length) return;
    try {
      if (audio.src) audio.src.disconnect();
      audio.src = audio.ctx.createMediaStreamSource(stream);
      audio.an = audio.ctx.createAnalyser(); audio.an.fftSize = 1024; audio.buf = new Uint8Array(audio.an.fftSize);
      audio.src.connect(audio.an);
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      $('#meterRow').hidden = false;
    } catch (e) { audio.an = null; }
  }
  // Returns true while a deliberate sound is happening (clearly louder than the room for at least 150 ms).
  function soundTick(dt, now) {
    if (!audio.an) return false;
    audio.an.getByteTimeDomainData(audio.buf);
    var s = 0; for (var i = 0; i < audio.buf.length; i++) { var x = (audio.buf[i] - 128) / 128; s += x * x; }
    var rms = Math.sqrt(s / audio.buf.length), thr = Math.max(0.04, audio.floor * 4), loud = rms > thr;
    if (!loud) audio.floor += 0.02 * (rms - audio.floor); // follow the background noise slowly
    audio.loudMs = loud ? audio.loudMs + dt : 0;
    var m = $('#meter'); m.style.width = Math.min(100, rms / thr * 50) + '%'; m.style.background = loud ? 'var(--sun)' : 'var(--primary)';
    return audio.loudMs >= 150 && now > audio.quietUntil;
  }

  /* ---------- Choosing the camera ---------- */
  var camIds = [], camIdx = 0, SIZE = { width: { ideal: 640 }, height: { ideal: 480 } };
  async function openCam(video) {
    var v = Object.assign({}, SIZE, video);
    if (!st.mic) return navigator.mediaDevices.getUserMedia({ video: v, audio: false });
    // Camera and microphone are requested together: asking twice can make iPhones and iPads pause the first stream.
    try { return await navigator.mediaDevices.getUserMedia({ video: v, audio: true }); }
    catch (e) {
      if (!e || ['NotAllowedError', 'NotFoundError', 'NotReadableError'].indexOf(e.name) < 0) throw e;
      var s = await navigator.mediaDevices.getUserMedia({ video: v, audio: false }); // microphone refused: carry on with gaze only
      st.mic = false; return s;
    }
  }
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

  // Show which camera is in use and its picture size, to help when the preview looks wrong.
  function camInfo() {
    var t = video.srcObject && video.srcObject.getVideoTracks()[0];
    $('#caminfo').textContent = t ? (t.label || 'Camera') + ' \u00b7 ' + video.videoWidth + '\u00d7' + video.videoHeight + (t.muted ? ' \u00b7 paused by the device' : '') : '';
  }
  video.addEventListener('click', function () { var big = video.style.width !== '240px'; video.style.width = big ? '240px' : ''; video.style.height = big ? '180px' : ''; });

  // Manual override: step to the next camera on the device.
  async function switchCamera() {
    if (camIds.length < 2) return;
    camIdx = (camIdx + 1) % camIds.length;
    stopCam(video.srcObject);
    video.srcObject = await openCam({ deviceId: { exact: camIds[camIdx] } });
    await video.play(); camInfo(); hookAudio(video.srcObject);
    gaze.cents = null; gaze.f = null; // the old setup no longer matches this camera
  }

  async function startCamera() {
    if (st.cam) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot use the camera here. The page must be opened over https.');
    var stream = await frontStream();
    video.srcObject = stream; $('#camrow').hidden = false; await video.play(); camInfo(); hookAudio(stream);
    $('#status').textContent = 'Loading the face tracker';
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
    gaze.cents = cents; gaze.off = [0, 0, 0, 0]; gaze.dsum = [0, 0, 0, 0]; gaze.dn = 0;
    return true;
  }

  /* ---------- Screens and buttons ---------- */
  function showApp(on) { $('#app').hidden = !on; $('#intro').hidden = on; }
  function introMsg(text) { var el = $('#introMsg'); el.hidden = !text; el.textContent = text || ''; }
  function renderIntro() {
    $('#scn').innerHTML = SCENARIOS.map(function (x, i) {
      return '<button data-scn="' + i + '" aria-pressed="' + (i === st.scn) + '"><b>' + esc(x.name) + '</b><span>' + esc(x.blurb) + '</span></button>';
    }).join('') + '<button data-scn="-1" aria-pressed="' + (st.scn < 0) + '"><b>Build my own sentence</b><span>Choose words one at a time to say anything.</span></button>';
    $('#recal').hidden = !(st.cam && gaze.cents);
    $('#startCam').textContent = st.cam && gaze.cents ? 'Start (camera is set up)' : 'Start with camera';
  }

  async function begin(withCam, forceCal) {
    st.mic = withCam && $('#mic').checked; initAudio();
    st.shake = $('#shake').checked;
    introMsg(''); speak(' ', true); // unlocks speech on phones, which need a tap first
    showApp(true); st.phase = 'reading'; st.said = []; render();
    if (withCam) {
      try {
        $('#mid').innerHTML = '<p class="prompt">Starting the camera…</p><p class="context">Allow camera access when asked. The first start downloads the face tracker and can take a moment.</p>';
        await startCamera();
        if (st.mic && !audio.an) { // the microphone was switched on after the camera had started: reopen with both
          stopCam(video.srcObject); var s2 = await frontStream();
          video.srcObject = s2; await video.play(); camInfo(); hookAudio(s2);
        }
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
  $('#recentre').addEventListener('click', recentre);
  $('#swap').addEventListener('click', async function () {
    try {
      await switchCamera();
      var ok = await calibrate();
      if (ok) startScenario(); else if (ok === false) noFace();
    } catch (e) { $('#status').textContent = 'Could not switch camera'; }
  });
  /* ---------- Names (start screen) ---------- */
  function renderNames() {
    $('#nameList').innerHTML = window.TB_Names.get().map(function (n, i) {
      return '<li>' + esc(n) + '<button type="button" data-rm="' + i + '" aria-label="Remove ' + esc(n) + '">\u00d7</button></li>';
    }).join('');
  }
  $('#nameForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('#nameInput'), name = input.value.trim().replace(/\s+/g, ' '), list = window.TB_Names.get();
    var dup = list.some(function (x) { return x.toLowerCase() === name.toLowerCase(); });
    if (name && !dup && list.length < 12) { list.push(name); window.TB_Names.set(list); }
    input.value = ''; renderNames();
  });
  $('#nameList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-rm]'); if (!b) return;
    var list = window.TB_Names.get(); list.splice(+b.dataset.rm, 1); window.TB_Names.set(list); renderNames();
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
    if (b.dataset.act === 'again') startScenario(); else if (b.dataset.act === 'build') startBuild(); else $('#menu').click();
  });

  renderIntro(); renderNames();
})();
