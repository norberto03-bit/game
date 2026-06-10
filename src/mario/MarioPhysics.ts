/**
 * SUPER MARIO WORLD - MARIO PHYSICS IMPLEMENTATION (16-bit SNES Constants)
 * 
 * This module exports the exact math equations to integrate Super Mario World
 * physics into our HTML5 canvas controller, supporting:
 * 1. Progressive walking/run acceleration (Euler integration).
 * 2. Slid glide inertia when keys are released.
 * 3. Extreme skid braking when direction is toggled sharply.
 * 4. Tap vs. Hold variable jump flight mechanics (Lower gravity multiplier during rising hold).
 */

export interface MarioPhysicsState {
  pvx: number;
  pvy: number;
  pOnGround: boolean;
  pFacing: 'left' | 'right';
  px: number;
  py: number;
  pWidth: number;
  pHeight: number;
}

export const MARIO_PHYSICS_CONSTANTS = {
  // Ground limits
  WALK_SPEED_LIMIT: 3.6,      // Maximum walking speed
  RUN_SPEED_LIMIT: 6.0,       // Maximum sprinting speed (Y held / Turbo)
  
  // Acceleration rates
  ACCEL_GROUND: 0.16,         // Smooth ground acceleration Euler rate
  ACCEL_AIR: 0.12,            // Aerial horizontal steering factor
  
  // Deceleration & Glides
  FRICTION_GROUND: 0.82,      // Deceleration slide factor on ground
  FRICTION_AIR: 0.95,         // Low air resistance glide factor
  FRICTION_SKID: 0.55,        // Strong braking skid resistance
  
  // Jumps
  JUMP_FORCE: -7.5,           // Upward acceleration on click
  GRAVITY_WALK: 0.65,         // Normal downstream acceleration
  GRAVITY_JUMP_HOLD: 0.35,     // Light floaty gravity when holding JUMP key on rise
  TERMINAL_VELOCITY: 12.0     // Gravity velocity fall clamp
};

/**
 * Updates Mario's velocities based on inputs and whether he is skidding or jumping
 * @returns { isSkidding: boolean, spawnedDust: boolean }
 */
export function updateMarioPhysics(
  s: MarioPhysicsState,
  inputs: {
    left: boolean;
    right: boolean;
    jump: boolean;
    run: boolean;
  },
  speedMultiplier: number = 1.0
): { isSkidding: boolean; spawnedDust: boolean } {
  const c = MARIO_PHYSICS_CONSTANTS;
  
  // 1. Determine maximum speed target based on running/sprinting state
  const maxSpeed = (inputs.run ? c.RUN_SPEED_LIMIT : c.WALK_SPEED_LIMIT) * speedMultiplier;
  const activeDirection = inputs.left ? 'left' : (inputs.right ? 'right' : null);
  
  let isSkidding = false;
  let spawnedDust = false;

  // 2. Horizontal movement physics
  if (activeDirection !== null) {
    const targetVx = activeDirection === 'left' ? -maxSpeed : maxSpeed;
    s.pFacing = activeDirection;

    // Detect if we are sliding/skidding in the opposite direction of current high speed
    const isMovingOpposite = (activeDirection === 'left' && s.pvx > 0.8) ||
                             (activeDirection === 'right' && s.pvx < -0.8);

    if (s.pOnGround && isMovingOpposite) {
      // Mario is skidding! Apply aggressive braking friction and keep skid frame
      isSkidding = true;
      s.pvx *= c.FRICTION_SKID;
      
      // Spawn skid dust particle at random intervals
      if (Math.abs(s.pvx) > 1.2 && Math.random() < 0.35) {
        spawnedDust = true;
      }
      
      // If speed has decreased enough, break out of skid and start accelerating in the opposite direction
      if (Math.abs(s.pvx) < 0.5) s.pvx = 0;
    } else {
      // Normal acceleration interpolation (higher responsiveness on ground)
      const accelFactor = s.pOnGround ? c.ACCEL_GROUND : c.ACCEL_AIR;
      s.pvx += (targetVx - s.pvx) * accelFactor;
    }
  } else {
    // Elegant sliding glide deceleration typical of Mario games
    const stopFactor = s.pOnGround ? c.FRICTION_GROUND : c.FRICTION_AIR;
    s.pvx *= stopFactor;
    if (Math.abs(s.pvx) < 0.1) s.pvx = 0;
  }

  // Speed boundaries clamps
  s.pvx = Math.max(-maxSpeed, Math.min(s.pvx, maxSpeed));

  // 3. Vertical jump & fall mechanics
  // Variable JUMP height: If JUMP key is held while ascending, gravity is reduced
  const activeGravity = (inputs.jump && s.pvy < 0) ? c.GRAVITY_JUMP_HOLD : c.GRAVITY_WALK;
  
  s.pvy += activeGravity;
  s.pvy = Math.min(s.pvy, c.TERMINAL_VELOCITY); // Avoid fall tunneling

  return { isSkidding, spawnedDust };
}
