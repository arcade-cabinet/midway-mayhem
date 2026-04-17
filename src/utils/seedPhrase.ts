/**
 * @module utils/seedPhrase
 *
 * Human-readable seed phrases. Three-word pool (adjective + adjective + noun)
 * drawn from the Midway Mayhem brand vocabulary: circus, carnival, clown car,
 * big-top, neon, sideshow. A phrase deterministically hashes to a 32-bit seed
 * and the same seed produces the same phrase on the round-trip.
 *
 * Pool sizes are intentionally *not* powers of two — the phrase space is
 * adj1.length × adj2.length × noun.length ≈ 56 * 48 * 80 = 215,040 phrases,
 * which is enough variety to feel fresh but small enough that a short phrase
 * is human-memorable.
 */

// ─── Word pools ─────────────────────────────────────────────────────────────

/** Lead adjective — describes scale, intensity, or feeling. */
const ADJ1 = [
  'neon',
  'molten',
  'spangled',
  'electric',
  'cosmic',
  'jolly',
  'feral',
  'bombastic',
  'midnight',
  'roaring',
  'chromed',
  'glittering',
  'velvet',
  'riotous',
  'bouncing',
  'gilded',
  'wild',
  'screaming',
  'gonzo',
  'rubber',
  'tipsy',
  'frosted',
  'rocket',
  'starlit',
  'glowing',
  'burning',
  'feverish',
  'kinetic',
  'turbocharged',
  'bruised',
  'candy',
  'mirror',
  'tinsel',
  'stunt',
  'lunar',
  'slapstick',
  'dizzy',
  'haywire',
  'hypnotic',
  'luminous',
  'twinkling',
  'sugared',
  'reckless',
  'cosmic',
  'plush',
  'lightning',
  'whiplash',
  'airborne',
  'boisterous',
  'deluxe',
  'extra',
  'polka',
  'technicolor',
  'velveteen',
  'brash',
  'ruthless',
] as const;

/** Body adjective — texture, pattern, or flavor. */
const ADJ2 = [
  'polkadot',
  'striped',
  'harlequin',
  'rainbow',
  'paisley',
  'zigzag',
  'gilded',
  'spackled',
  'frosted',
  'glow',
  'splattered',
  'checkered',
  'sequined',
  'tinsel',
  'confetti',
  'smoking',
  'squeaking',
  'gum',
  'bubble',
  'popcorn',
  'caramel',
  'saltwater',
  'maraschino',
  'licorice',
  'sherbet',
  'lollipop',
  'fairground',
  'ringmaster',
  'tightrope',
  'trapeze',
  'cannonball',
  'chrome',
  'gasoline',
  'kerosene',
  'firecracker',
  'roman-candle',
  'sparkler',
  'trombone',
  'kazoo',
  'calliope',
  'marquee',
  'popcorn',
  'funnel-cake',
  'midway',
  'grand',
  'prize',
  'big-top',
  'sideshow',
] as const;

/** Noun — the anchor: vehicle, character, or hazard. */
const NOUN = [
  'jalopy',
  'bozo',
  'mayor',
  'barker',
  'juggler',
  'rumble',
  'hoop',
  'cannon',
  'unicycle',
  'stilt',
  'acrobat',
  'ringmaster',
  'tightrope',
  'trapeze',
  'parade',
  'clowncar',
  'bumpercar',
  'limo',
  'gondola',
  'carousel',
  'ferris',
  'tilt',
  'shooter',
  'ringtoss',
  'hammer',
  'gavel',
  'midway',
  'popcorn',
  'cottoncandy',
  'snowcone',
  'taffy',
  'caramel',
  'elephant',
  'seal',
  'tigercage',
  'lion',
  'monkey',
  'parrot',
  'flamingo',
  'peacock',
  'chicken',
  'goose',
  'bulldog',
  'poodle',
  'spaniel',
  'hyena',
  'pigtail',
  'bighorn',
  'jester',
  'fool',
  'harlequin',
  'pantomime',
  'tumbler',
  'contortionist',
  'pierrot',
  'auguste',
  'sideshow',
  'freakshow',
  'strongman',
  'bearded-lady',
  'sword-swallower',
  'fireeater',
  'snake-charmer',
  'magician',
  'illusionist',
  'hypnotist',
  'ventriloquist',
  'mime',
  'monkey-bars',
  'tent-pole',
  'guywire',
  'rigging',
  'spotlight',
  'bullhorn',
  'megaphone',
  'wrench',
  'pistonwheel',
  'gearbox',
  'turbo',
  'nitro',
  'jalapeno',
  'mustard',
  'ketchup',
] as const;

// ─── 32-bit hash (djb2) ─────────────────────────────────────────────────────

function hash32(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ParsedSeedPhrase {
  phrase: string;
  seed: number;
}

/**
 * Deterministically convert a phrase string to a 32-bit seed.
 * Trims, lowercases, and collapses whitespace so minor typing differences map
 * to the same seed. Empty strings fall back to a random seed.
 */
export function phraseToSeed(phrase: string): number {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, '-');
  if (normalized.length === 0) return (Math.random() * 0x100000000) >>> 0;
  return hash32(normalized);
}

/**
 * Generate a random 3-word phrase from the brand pool.
 * Optionally pass a seeded random function for deterministic generation.
 */
export function randomPhrase(rand: () => number = Math.random): string {
  const a = ADJ1[Math.floor(rand() * ADJ1.length)];
  const b = ADJ2[Math.floor(rand() * ADJ2.length)];
  const n = NOUN[Math.floor(rand() * NOUN.length)];
  return `${a}-${b}-${n}`;
}

/** Generate a phrase AND compute its seed in one call. */
export function shufflePhrase(rand: () => number = Math.random): ParsedSeedPhrase {
  const phrase = randomPhrase(rand);
  return { phrase, seed: phraseToSeed(phrase) };
}

/** Exposed for testing/coverage. */
export const _pools = { ADJ1, ADJ2, NOUN };
