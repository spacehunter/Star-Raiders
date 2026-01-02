/**
 * Enemy speed configuration for tuning
 *
 * Speeds are defined as "impulse levels" (0-9) which are multiplied by UNITS_PER_IMPULSE.
 * The smooth velocity system now handles acceleration/deceleration, so speeds can be
 * set higher without appearing jerky.
 *
 * Player reference (uses 50 units/impulse):
 *   - Player impulse 1 = 50 units/sec
 *   - Player impulse 5 = 250 units/sec
 *   - Player impulse 8 = 400 units/sec
 *   - Player impulse 9 = 450 units/sec (maximum)
 *
 * Enemy speeds designed so:
 *   - Player impulse 9 = can escape
 *   - Player impulse 8 = enemies match speed (neither gain nor lose)
 *   - Player impulse < 8 = enemies catch up
 */
export const ENEMY_CONFIG = {
  speeds: {
    // Enemies now use same UNITS_PER_IMPULSE as player for consistent speed scaling
    // Fighter pursuit speed matches player impulse 8 (400 u/s)
    FIGHTER: 8,    // 400 units/sec - matches player impulse 8
    CRUISER: 6,    // 300 units/sec - slower but still fast
    BASESTAR: 0,   // stationary
  },

  // Speed multipliers for different behaviors
  multipliers: {
    CRUISER_PATROL: 0.6,    // Cruisers patrol at 60% speed (180 u/s)
    CRUISER_BACKOFF: 0.5,   // Cruisers back off at 50% speed (150 u/s)
    CRUISER_STRAFE: 0.3,    // Cruisers strafe at 30% speed (90 u/s)
  },

  // Combat distances - comfortable engagement ranges
  distances: {
    FIGHTER_ORBIT_RADIUS: 40,      // Fighter orbit distance - tight, aggressive circling
    CRUISER_PREFERRED_MIN: 60,     // Cruiser minimum distance
    CRUISER_PREFERRED_MAX: 90,     // Cruiser maximum distance
  },

  // Units per impulse level - NOW MATCHES PLAYER
  // Same as player (50) for consistent speed comparison
  // Fighter impulse 8 = 400 units/sec (matches player impulse 8)
  UNITS_PER_IMPULSE: 50,
};

// Make globally accessible for console testing
// Usage in browser console: ENEMY_CONFIG.speeds.FIGHTER = 6
if (typeof window !== 'undefined') {
  (window as any).ENEMY_CONFIG = ENEMY_CONFIG;
}
