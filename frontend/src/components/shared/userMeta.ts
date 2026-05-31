/**
 * Deterministic user metadata generator.
 * Given a userId string, produces a stable name, color, and initials.
 */

const ADJECTIVES = [
  'Creative', 'Swift', 'Bright', 'Clever', 'Smart', 'Vibrant',
  'Silent', 'Wise', 'Bold', 'Golden', 'Neon', 'Cosmic',
];

const ANIMALS = [
  'Panda', 'Dolphin', 'Fox', 'Koala', 'Falcon', 'Panther',
  'Owl', 'Tiger', 'Eagle', 'Octopus', 'Penguin', 'Gecko',
];

const COLORS = [
  '#d93025', // Red
  '#e8710a', // Orange
  '#f9ab00', // Yellow
  '#188038', // Green
  '#1a73e8', // Blue
  '#a142f4', // Purple
  '#e52592', // Pink
  '#129eaf', // Teal
  '#e37400', // Amber
  '#1e8e3e', // Emerald
  '#4285f4', // Light Blue
  '#9334e6', // Violet
];

export function getUserMeta(userId: string) {
  if (!userId) return { name: 'Connecting...', color: '#1a73e8', initials: '??' };

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const adj = ADJECTIVES[hash % ADJECTIVES.length];
  const anim = ANIMALS[hash % ANIMALS.length];
  const color = COLORS[hash % COLORS.length];

  return {
    name: `${adj} ${anim}`,
    color,
    initials: adj[0] + anim[0],
  };
}
