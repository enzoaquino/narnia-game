// Room 1: Lantern Waste. PLACEHOLDER until the kids' outline arrives.
// Lucy steps out of the wardrobe into a snowy wood with a lamp-post.
// Goal: chase off the White Witch's wolves; then Mr. Tumnus gives Lucy the key.
//
// Map legend: . snow  , path  T tree  R rock  L lamp-post  W wardrobe (entrance)  X exit
export default {
  id: 'lantern-waste',
  name: 'Lantern Waste',
  map: [
    'TTTTTTTWTTTTTTTT',
    'TT.....,......TT',
    'T......,...R...T',
    'T..T...,.......T',
    'T.....,L,..T...T',
    'T......,.......T',
    'T.R....,....R..T',
    'T......,,......T',
    'T..T....,...T..T',
    'TT......,.....TT',
    'TTTTTTTTXTTTTTTT',
  ],
  entities: [
    {
      type: 'npc',
      id: 'tumnus',
      name: 'Mr. Tumnus',
      sprite: 'tumnus',
      x: 9,
      y: 4,
      dialogue: [
        'Oh! A Daughter of Eve, here in Narnia! I am Mr. Tumnus.',
        "Careful! The White Witch's wolves are prowling these woods.",
        'If you could chase them away, I could show you the way on.',
      ],
    },
    { type: 'wolf', x: 3, y: 6 },
    { type: 'wolf', x: 12, y: 3 },
    { type: 'wolf', x: 11, y: 8 },
  ],
  hooks: {
    onEnter(room) {
      if (room.attempt === 1) {
        room.say('Lucy', ['Snow? Inside a wardrobe? And a lamp-post in the middle of a wood!']);
      }
    },
    onEnemiesCleared(room) {
      room
        .npc('tumnus')
        .setDialogue([
          'You chased off the wolves! How brave you are.',
          'Here, take this key. It opens the old gate to the south.',
        ])
        .onDone(() => {
          room.giveKey();
          room.npc('tumnus').setDialogue(['Hurry along now, and mind the Witch!']);
        });
    },
  },
};
