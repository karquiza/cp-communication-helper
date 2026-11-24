/*
 * Sentence builder: lets the child make any sentence, one word or short phrase at a time.
 * Used by every demo. The "prediction" here is a small hand-written word map, not a real model.
 *
 * TB_WORDS.start     - ways to begin a sentence
 * TB_WORDS.next      - likely next choices after a given word or phrase
 * TB_WORDS.fallback  - offered when there is no entry for the last word
 *
 * '@names' in a list is replaced by the names a family has added (see TB_Names below).
 */
window.TB_WORDS = {
  start: ['I want', 'I feel', 'Can we', 'I like', 'Please', 'Where is', "I don't want", 'Look at', 'Thank you', 'Hi'],
  next: {
    'I want': ['to play', 'to eat', 'a drink', 'to go', 'to see', 'my', 'a hug', 'to rest', 'more'],
    "I don't want": ['to go', 'to eat', 'that', 'to stop', 'to rest'],
    'I feel': ['happy', 'tired', 'sad', 'hungry', 'sick', 'excited', 'scared', 'bored'],
    'Can we': ['go', 'play', 'read a story', 'watch a show', 'call', 'stop'],
    'I like': ['this', 'you', '@names', 'the music', 'my', 'this game', 'that'],
    'Please': ['help me', 'stop', 'wait', 'come here', 'say it again', 'move me'],
    'Where is': ['@names', 'Mom', 'Dad', 'my', 'my friend', 'the dog'],
    'Look at': ['that', 'me', 'this', '@names', 'the dog', 'my'],
    'Thank you': ['@names', 'Mom', 'Dad', 'so much', 'for helping'],
    'Hi': ['@names', 'everyone', 'Mom', 'Dad'],
    'to see': ['@names', 'Grandma', 'my friend', 'the dog', 'you'],
    'with': ['@names', 'you', 'my friend', 'Mom', 'Dad'],
    'to play': ['outside', 'a game', 'with', 'music', 'now'],
    'play': ['outside', 'a game', 'with', 'music', 'now'],
    'to eat': ['now', 'a snack', 'fruit', 'pasta', 'something else'],
    'to go': ['outside', 'home', 'to the park', 'to bed', 'to school', 'now'],
    'go': ['outside', 'home', 'to the park', 'to school', 'now'],
    'my': ['tablet', 'blanket', 'book', 'toy', 'chair', 'dog'],
    'call': ['@names', 'Grandma', 'Mom', 'Dad', 'my friend'],
    'more': ['please', 'water', 'food', 'music', 'time'],
    'a drink': ['of water', 'of juice', 'of milk', 'please']
  },
  fallback: ['please', 'now', 'today', 'with you', 'again', 'too']
};

/* Names a family has added (people, pets). Kept in this browser only; falls back to memory if storage is blocked. */
window.TB_Names = (function () {
  var KEY = 'tb-names', mem = [];
  return {
    get: function () {
      try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(v)) mem = v.filter(function (x) { return typeof x === 'string'; }); } catch (e) { /* use memory */ }
      return mem.slice();
    },
    set: function (list) { mem = list.slice(); try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* memory only */ } }
  };
})();

window.TB_Builder = function () {
  var W = window.TB_WORDS, words = [], page = 0, names = window.TB_Names.get();
  // Swap '@names' for the family's names and drop repeats (a family may add "Mom" themselves).
  function expand(list) {
    var out = [];
    list.forEach(function (w) { (w === '@names' ? names : [w]).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }

  function text() {
    if (!words.length) return '';
    var s = words.join(' ');
    return s + (/^(Can we|Where is)/.test(s) ? '?' : '.');
  }
  // Suggestions come in pages of three. Once a sentence has started, the third slot is always "Say it".
  function pages() {
    var last = words[words.length - 1];
    var c = expand(words.length ? (W.next[last] || W.fallback) : W.start).filter(function (w) { return words.indexOf(w) < 0; });
    var per = words.length ? 2 : 3, out = [];
    for (var i = 0; i < c.length; i += per) {
      var p = c.slice(i, i + per).map(function (w) { return { label: w, word: w }; });
      if (words.length) { while (p.length < 2) p.push(null); p.push({ label: 'Say it', act: 'say' }); }
      out.push(p);
    }
    if (words.length) out.push([{ label: 'Undo last word', act: 'undo' }, { label: 'Start over', act: 'clear' }, { label: 'Say it', act: 'say' }]);
    return out;
  }
  function options() { var p = pages(); return p[page % p.length]; }

  return {
    text: text,
    options: options,                       // up to three items: {label, word} or {label, act}, or null for an empty slot
    more: function () { page++; },
    undo: function () { words.pop(); page = 0; },   // remove the last word (used by the head-shake signal)          // show the next page of suggestions
    pick: function (i) {                    // returns the finished sentence when "Say it" is chosen, otherwise null
      var o = options()[i]; if (!o) return null;
      if (o.word) { words.push(o.word); page = 0; return null; }
      if (o.act === 'undo') { words.pop(); page = 0; return null; }
      if (o.act === 'clear') { words = []; page = 0; return null; }
      var said = text(); words = []; page = 0; return said;
    }
  };
};
