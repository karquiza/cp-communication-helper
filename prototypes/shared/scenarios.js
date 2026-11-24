/*
 * Scripted conversations used by every demo.
 *
 * Each scenario has a `first` turn. A turn has:
 *   signals  - what the app "detects": [kind, label, optional animation]. kind is look, move or sound.
 *   context  - optional line shown above the suggestions.
 *   sets     - one or more groups of three suggestions: [text, percent sure].
 *              A second group is shown when the child picks "None of these".
 *   want     - the scripted choice, shown to the presenter as a hint.
 *   follow   - the next turn for each suggestion, keyed by the suggestion text.
 */
window.TB_SCENARIOS = [
  { name: 'Asking for a drink', blurb: 'Two turns build a request. The first guess is right.',
    first: { signals: [['move', 'Right hand lifts'], ['look', 'Looks toward the kitchen'], ['sound', 'Sound: "mm"']],
      sets: [[["I'm thirsty", 62], ["I'm hungry", 24], ['I need a break', 9]]], want: "I'm thirsty",
      follow: {
        "I'm thirsty": { signals: [['look', 'Looks left and holds'], ['sound', 'Sound: "wa"']],
          sets: [[['Water, please', 71], ['Juice, please', 18], ['Milk, please', 7]]], want: 'Water, please' },
        "I'm hungry": { signals: [['look', 'Looks at the fruit bowl'], ['sound', 'Sound: "ba"']],
          sets: [[['A banana, please', 66], ['Some crackers, please', 21], ['Yogurt, please', 9]]] },
        'I need a break': { signals: [['move', 'Head turns away'], ['look', 'Eyes close briefly']],
          sets: [[['I want quiet time', 55], ['I want to lie down', 28], ['Can we go outside?', 12]]] }
      } } },
  { name: 'Answering the teacher', blurb: 'The app uses the question it heard as context.',
    first: { signals: [['look', 'Looks at the picture board'], ['sound', 'Sound: "p"'], ['move', 'Big smile', 'smile']],
      context: 'Heard nearby: "Which animal did you like best at the zoo?"',
      sets: [[['The penguins', 58], ['The parrots', 27], ['The pandas', 11]]], want: 'The penguins',
      follow: {
        'The penguins': { signals: [['move', 'Arms sway side to side']],
          sets: [[['They waddle when they walk', 49], ['They were swimming', 31], ['They were funny', 15]]], want: 'They waddle when they walk' },
        'The parrots': { signals: [['sound', 'Makes a squawk sound'], ['move', 'Big smile', 'smile']],
          sets: [[['They were so loud', 52], ['They had bright colours', 33], ['One said hello', 11]]] },
        'The pandas': { signals: [['move', 'Hand moves to mouth']],
          sets: [[['They were eating bamboo', 57], ['They were sleeping', 26], ['They were fluffy', 13]]] }
      } } },
  { name: 'Telling a joke', blurb: 'The first guesses are wrong. Maya rejects them and the app tries again.',
    first: { signals: [['move', 'Sudden arm movement'], ['sound', 'Loud sound'], ['look', 'Looks at Dad']],
      sets: [[['Something hurts', 41], ["I'm tired", 30], ['I want to go home', 19]],
             [['I want to tell a joke', 46], ['Look at that!', 28], ['I have a question', 17]]],
      want: 'I want to tell a joke', wrongFirst: true,
      follow: {
        'I want to tell a joke': { signals: [['look', 'Looks left and holds'], ['move', 'Big smile', 'smile']], context: 'Choosing from Maya\'s saved jokes',
          sets: [[["Why did the banana go to the doctor? It wasn't peeling well!", 64], ['What do you call a sleeping dinosaur? A dino-snore!', 29], ['Knock knock', 5]]],
          want: "Why did the banana go to the doctor? It wasn't peeling well!" },
        'Look at that!': { signals: [['look', 'Looks at the window'], ['move', 'Arm points']],
          sets: [[["There's a bird outside", 49], ["It's snowing", 31], ['A big truck', 14]]] },
        'I have a question': { signals: [['look', 'Looks at the clock'], ['sound', 'Sound: "wh"']],
          sets: [[['When is lunch?', 44], ['Can I go outside?', 32], ['Who is coming today?', 18]]] },
        'Something hurts': { signals: [['look', 'Looks down'], ['move', 'Hand moves to tummy']],
          sets: [[['My tummy hurts', 48], ['My head hurts', 27], ['My leg hurts', 18]]] },
        "I'm tired": { signals: [['look', 'Eyes close briefly'], ['move', 'Head rests back']],
          sets: [[['I want to lie down', 54], ['I want a cuddle', 29], ['Turn the lights down', 12]]] },
        'I want to go home': { signals: [['look', 'Looks at the door']],
          sets: [[['Can we leave soon?', 51], ['I miss my dog', 27], ['It is too loud here', 16]]] }
      } } }
];
