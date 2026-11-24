/* Clickable prototype: scripted flow, "My signals" teaching wizard and the grown-ups screen. No camera. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP = reduce ? 200 : 850;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var SCENARIOS = window.TB_SCENARIOS; // defined in ../shared/scenarios.js
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var KIND = { look: 'LOOK', move: 'MOVE', sound: 'SOUND' };

  var st = { scn: 0, cur: null, ctx: '', set: 0, lit: 0, phase: 'idle', said: [], last: '', timer: null, sound: true };

  function speak(text) {
    if (!st.sound) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      }
    } catch (e) { /* speech is optional */ }
  }

  function turn() { return st.cur || SCENARIOS[st.scn].first; }
  function stop() { clearTimeout(st.timer); st.timer = null; }

  function reset() { stop(); st.building = false; st.cur = null; st.ctx = ''; st.set = 0; st.lit = 0; st.phase = 'idle'; st.said = []; st.last = ''; render(); }
  function start() { st.building = false; st.cur = SCENARIOS[st.scn].first; st.said = []; sense(); }
  // Sentence builder: Maya makes her own sentence instead of choosing from scripted guesses.
  function startBuild() { stop(); st.building = true; st.builder = window.TB_Builder(); st.said = []; st.phase = 'build'; render(); }
  function buildPick(i) {
    var said = st.builder.pick(i);
    if (!said) { render(); return; }
    st.said.push(said); st.last = said; st.phase = 'spoken'; speak(said); render();
    st.timer = setTimeout(function () { st.phase = 'build'; render(); }, reduce ? 900 : 2200);
  }
  function sense() {
    stop(); st.set = 0; st.lit = 0; st.phase = 'sensing';
    st.ctx = turn().context || (st.said.length ? 'Maya just said: ' + st.said[st.said.length - 1] : '');
    render();
    (function tick() {
      st.timer = setTimeout(function () {
        st.lit++; render();
        if (st.lit < turn().signals.length) tick();
        else st.timer = setTimeout(function () { st.phase = 'guessing'; render(); }, STEP);
      }, STEP);
    })();
  }
  function choose(i) {
    var text = turn().sets[st.set][i][0];
    var next = turn().follow && turn().follow[text];
    st.said.push(text); st.last = text; st.phase = 'spoken'; speak(text); render();
    st.timer = setTimeout(function () {
      if (next) { st.cur = next; sense(); }
      else { st.phase = 'done'; render(); }
    }, reduce ? 900 : 2200);
  }
  function noneOfThese() {
    if (st.set + 1 < turn().sets.length) { st.set++; render(); }
    else { st.phase = 'nomore'; render(); }
  }

  function render() {
    var s = SCENARIOS[st.scn], t = turn(), cam = $('#cam');
    // camera
    cam.className = 'cam' + (st.phase === 'sensing' ? ' is-sensing' : '') + (st.phase === 'spoken' || st.phase === 'done' ? ' is-smile' : '');
    if (st.phase === 'sensing') {
      var cur = t.signals[Math.min(st.lit, t.signals.length - 1)];
      cam.classList.add('is-' + (cur[2] || cur[0]));
    }
    // chips
    var chips = '';
    if (st.phase !== 'idle' && st.phase !== 'done' && !st.building) {
      t.signals.forEach(function (sig, i) {
        var cls = st.phase !== 'sensing' || i < st.lit ? 'lit' : (i === st.lit ? 'now' : '');
        chips += '<span class="chip ' + cls + '"><span class="kind">' + KIND[sig[0]] + '</span>' + esc(sig[1]) + '</span>';
      });
    }
    $('#chips').innerHTML = chips;
    // context
    $('#context').innerHTML = (st.ctx && st.phase !== 'idle' && st.phase !== 'done' && !st.building) ? '<p class="context">' + esc(st.ctx) + '</p>' : '';
    // guesses area
    var g = '';
    if (st.phase === 'idle') {
      g = '<button class="big" data-act="start">' + PLAY + 'Start: ' + esc(s.name) + '</button>' +
          '<button class="ghost" data-act="build">Build my own sentence</button>' +
          '<p class="notice">Maya moves, looks or makes a sound. TalkBridge suggests what she means, and she chooses.</p>';
    } else if (st.phase === 'sensing') {
      g = '<p class="sensing">Reading Maya\'s signals…</p><div class="skel"></div><div class="skel"></div><div class="skel"></div>';
    } else if (st.phase === 'guessing') {
      g = '<p class="label">' + (st.set > 0 ? 'More ideas. Did you mean…' : 'Did you mean…') + '</p>';
      t.sets[st.set].forEach(function (o, i) {
        g += '<button class="guess' + (i === 0 ? ' top' : '') + '" data-act="choose" data-i="' + i + '">' +
             '<span class="rank">' + (i + 1) + '</span><span class="t">' + esc(o[0]) + '</span><span class="pct">' + o[1] + '%</span>' +
             '<span class="bar"><i style="width:' + o[1] + '%"></i></span></button>';
      });
      g += '<button class="none" data-act="none">None of these</button>';
    } else if (st.phase === 'spoken') {
      g = '<div class="spoken"><span class="small">Speaking aloud</span><span class="t">' + esc(st.last) + '</span><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>';
    } else if (st.phase === 'build') {
      var sentence = st.builder.text();
      g = '<p class="label">Maya\'s sentence</p>' +
          '<p class="notice" style="font-family:var(--font-display);font-size:20px;color:var(--ink)">' + (sentence ? esc(sentence) : 'Choose a first word') + '</p>';
      st.builder.options().forEach(function (o, i) {
        if (o) g += '<button class="guess' + (o.act === 'say' ? ' top' : '') + '" data-act="bpick" data-i="' + i + '"><span class="rank">' + (i + 1) + '</span><span class="t">' + esc(o.label) + '</span><span class="pct"></span></button>';
      });
      g += '<button class="ghost" data-act="bmore">More words</button><button class="none" data-act="reset">Finish</button>';
    } else if (st.phase === 'nomore') {
      g = '<p class="notice">No more scripted guesses. In the real app, this opens Maya\'s full word board so she is never stuck with the app\'s ideas.</p>' +
          '<button class="big" data-act="build">Build my own sentence</button>' +
          '<button class="ghost" data-act="retry">Try this turn again</button>';
    } else if (st.phase === 'done') {
      g = '<p class="notice">Scenario finished. Maya chose every message that was spoken.</p>' +
          '<button class="big" data-act="start">' + PLAY + 'Play again</button>';
    }
    $('#guesses').innerHTML = g;
    // transcript
    $('#saidWrap').hidden = st.said.length === 0;
    $('#said').innerHTML = st.said.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    // scenario buttons
    $('#scn').innerHTML = SCENARIOS.map(function (x, i) {
      return '<button data-scn="' + i + '" aria-pressed="' + (i === st.scn) + '"><b>' + esc(x.name) + '</b><span>' + esc(x.blurb) + '</span></button>';
    }).join('');
    // notes
    var note = '', hint = '';
    if (st.phase === 'idle') note = 'Press Start on the phone. You play Maya: when guesses appear, tap the one she means.';
    else if (st.phase === 'sensing') note = 'The app watches movement, gaze and sound together. No single signal has to be precise, which is the point for a child whose movements are jerky or variable.';
    else if (st.phase === 'guessing') {
      if (t.wrongFirst && st.set === 0) {
        note = 'The app has misread excitement as distress. A confident wrong guess is the main risk of a predictive system, so rejecting must be as easy as accepting.';
        hint = 'Maya means none of these. Tap "None of these".';
      } else {
        note = 'The app shows its three best guesses with how sure it is. In real use Maya confirms with her own Yes signal; here you tap for her.';
        hint = t.want ? 'Scripted choice: "' + t.want + '". Any other choice gets its own follow-up.' : 'Tap whichever Maya means.';
      }
    }
    else if (st.phase === 'spoken') note = 'Only a message Maya has confirmed is spoken aloud. The app never speaks a guess on its own.';
    else if (st.phase === 'build') note = 'Maya builds any sentence one word or phrase at a time. The app suggests likely next words, so a few choices make a full sentence. "Say it" speaks it aloud. These suggestions come from a small hand-written list, not a real model.';
    else if (st.phase === 'nomore') note = 'When the guesses run out, the child needs a fallback that does not depend on prediction.';
    else if (st.phase === 'done') note = 'Each confirmed message also becomes context for the next guess, which is how short signals build into sentences.';
    $('#noteText').textContent = note;
    $('#noteHint').hidden = !hint; $('#noteHint').textContent = hint;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'start') start();
    else if (b.dataset.act === 'build') startBuild();
    else if (b.dataset.act === 'bpick') buildPick(+b.dataset.i);
    else if (b.dataset.act === 'bmore') { st.builder.more(); render(); }
    else if (b.dataset.act === 'reset') reset();
    else if (b.dataset.act === 'choose') choose(+b.dataset.i);
    else if (b.dataset.act === 'none') noneOfThese();
    else if (b.dataset.act === 'retry') sense();
    else if (b.dataset.scn !== undefined) { st.scn = +b.dataset.scn; reset(); showTab('talk'); }
    else if (b.dataset.tab) showTab(b.dataset.tab);
  });

  function showTab(name) {
    ['talk', 'signals', 'adults'].forEach(function (n) { $('#scr-' + n).hidden = n !== name; });
    document.querySelectorAll('.tabs button').forEach(function (b) {
      if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  $('#soundBtn').addEventListener('click', function () {
    st.sound = !st.sound;
    this.setAttribute('aria-pressed', String(st.sound));
    this.textContent = st.sound ? 'Voice on' : 'Voice off';
    if (!st.sound) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  });

  /* ---- My signals ---- */
  var learned = [
    { kind: 'look', name: 'Looks left and holds', means: 'Yes, that one', rel: 'Reliable' },
    { kind: 'look', name: 'Looks right and holds', means: 'No, none of these', rel: 'Reliable' },
    { kind: 'move', name: 'Right hand lifts', means: 'I want to say something', rel: 'Reliable' },
    { kind: 'sound', name: 'Sound: "mm"', means: 'More, or I want', rel: 'Still learning' },
    { kind: 'move', name: 'Big smile', means: 'I like it', rel: 'Still learning' }
  ];
  var wz = null; // {step, kind, count, meaning}
  var MEANINGS = ['Stop', 'Help me', 'Again', 'I need the toilet', 'That is funny'];

  function renderSignals() {
    $('#signalList').innerHTML = learned.map(function (x) {
      return '<div class="row"><span class="name"><span class="chip lit" style="margin-right:6px"><span class="kind">' + KIND[x.kind] + '</span></span>' + esc(x.name) + '</span>' +
             '<span class="rel ' + (x.rel === 'Reliable' ? 'ok' : 'mid') + '">' + esc(x.rel) + '</span>' +
             '<span class="means">Means: ' + esc(x.means) + '</span></div>';
    }).join('');
    var w = '';
    if (!wz) w = '<button class="big" data-wz="open" style="width:100%">Teach a new signal</button>';
    else if (wz.step === 0) {
      w = '<div class="wiz"><p class="label">Step 1 of 3. What kind of signal?</p><div class="pick">' +
          ['move', 'look', 'sound'].map(function (k) { return '<button data-wz="kind" data-k="' + k + '">' + { move: 'A movement', look: 'A look', sound: 'A sound' }[k] + '</button>'; }).join('') +
          '</div><button class="ghost" data-wz="cancel">Cancel</button></div>';
    } else if (wz.step === 1) {
      w = '<div class="wiz"><p class="label">Step 2 of 3. Show it three times</p>' +
          '<p class="means">Ask Maya to make the signal, then press Record. Three examples are enough to start, so she does not get tired.</p>' +
          '<div class="dots">' + [0, 1, 2].map(function (i) { return '<i class="' + (i < wz.count ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
          '<button class="big" data-wz="rec">Record example ' + (wz.count + 1) + ' (simulated)</button>' +
          '<button class="ghost" data-wz="cancel">Cancel</button></div>';
    } else {
      w = '<div class="wiz"><p class="label">Step 3 of 3. What does it mean?</p><div class="pick">' +
          MEANINGS.map(function (m) { return '<button data-wz="mean" data-m="' + esc(m) + '" aria-pressed="' + (wz.meaning === m) + '">' + esc(m) + '</button>'; }).join('') +
          '</div><label class="label" for="meanInput">Or type your own</label>' +
          '<input class="field" id="meanInput" type="text" maxlength="40" value="' + esc(MEANINGS.indexOf(wz.meaning) < 0 ? wz.meaning : '') + '" placeholder="For example: I want my dog">' +
          '<button class="big" data-wz="save">Save signal</button><button class="ghost" data-wz="cancel">Cancel</button></div>';
    }
    $('#wizard').innerHTML = w;
  }
  $('#scr-signals').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-wz]'); if (!b) return;
    var a = b.dataset.wz;
    if (a === 'open') wz = { step: 0, kind: 'move', count: 0, meaning: '' };
    else if (a === 'cancel') wz = null;
    else if (a === 'kind') { wz.kind = b.dataset.k; wz.step = 1; }
    else if (a === 'rec') { wz.count++; if (wz.count >= 3) wz.step = 2; }
    else if (a === 'mean') wz.meaning = b.dataset.m;
    else if (a === 'save') {
      var typed = ($('#meanInput').value || '').trim();
      var meaning = typed || wz.meaning;
      if (!meaning) { $('#meanInput').focus(); return; }
      learned.unshift({ kind: wz.kind, name: 'New ' + { move: 'movement', look: 'look', sound: 'sound' }[wz.kind], means: meaning, rel: 'Still learning' });
      wz = null;
    }
    renderSignals();
  });

  /* ---- Grown-ups ---- */
  var toggles = [
    { t: 'Keep video and audio on this phone', d: 'Recordings are processed on the device and not uploaded.', on: true },
    { t: 'Save examples to improve Maya\'s model', d: 'Stores short clips of confirmed signals on this phone.', on: true },
    { t: 'Keep a log of what Maya says', d: 'Off by default. Maya\'s conversations are hers.', on: false },
    { t: 'Share anonymised data for research', d: 'Off unless a parent or guardian turns it on.', on: false }
  ];
  function renderToggles() {
    $('#toggles').innerHTML = toggles.map(function (x, i) {
      return '<div class="toggle"><span id="tg' + i + '">' + esc(x.t) + '</span><button class="switch" role="switch" aria-checked="' + x.on + '" aria-labelledby="tg' + i + '" data-tg="' + i + '"></button><span class="d">' + esc(x.d) + '</span></div>';
    }).join('');
  }
  $('#toggles').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tg]'); if (!b) return;
    toggles[+b.dataset.tg].on = !toggles[+b.dataset.tg].on; renderToggles();
  });
  $('#exportBtn').addEventListener('click', function () {
    $('#adultMsg').innerHTML = '<p class="notice">Simulated: the real app would save Maya\'s trained model as a file the family owns and can move to another app.</p>';
  });
  $('#deleteBtn').addEventListener('click', function () {
    $('#adultMsg').innerHTML = '<div class="wiz" style="border-color:var(--bad)"><p><b>Delete everything TalkBridge has learned about Maya?</b></p><p class="means">This cannot be undone. (Simulated: nothing is deleted in this demo.)</p><div class="btnrow"><button class="danger" id="delYes">Delete</button><button class="ghost" id="delNo">Keep</button></div></div>';
  });
  $('#adultMsg').addEventListener('click', function (e) {
    if (e.target.id === 'delYes') this.innerHTML = '<p class="notice">Simulated: all recordings and the trained model would now be erased from this phone.</p>';
    else if (e.target.id === 'delNo') this.innerHTML = '';
  });

  render(); renderSignals(); renderToggles();
})();
