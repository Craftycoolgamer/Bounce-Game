const BaseSystem = require('./BaseSystem');

class PhysicsSystem extends BaseSystem {
    constructor(game) {
        super();
        this.game = game;
    }
    
    clampVelocity(square) {
        const speed = Math.sqrt(square.dx * square.dx + square.dy * square.dy);
        if (speed > square.maxVelocity) {
            square.dx = (square.dx / speed) * square.maxVelocity;
            square.dy = (square.dy / speed) * square.maxVelocity;
        }
    }
    
    animateSquare(square, deltaTime) {
        const maxX = this.game.world.width - square.size;
        const maxY = this.game.world.height - square.size;
        
        const speedMultiplier = (square.powerups && square.powerups.speedBoost) ? square.powerups.speedBoost : 1;
        const effectiveNormalSpeed = square.normalSpeed * speedMultiplier;
        
        const currentSpeed = Math.sqrt(square.dx * square.dx + square.dy * square.dy);
        
        if (currentSpeed > effectiveNormalSpeed) {
            const timeConstant = square.frictionTime / 4.605;
            const decayFactor = Math.exp(-deltaTime / timeConstant);
            const targetSpeed = effectiveNormalSpeed + (currentSpeed - effectiveNormalSpeed) * decayFactor;
            const finalSpeed = Math.max(effectiveNormalSpeed, targetSpeed);
            
            if (currentSpeed > 0) {
                const directionX = square.dx / currentSpeed;
                const directionY = square.dy / currentSpeed;
                square.dx = directionX * finalSpeed;
                square.dy = directionY * finalSpeed;
            }
        } else if (currentSpeed > 0 && currentSpeed < effectiveNormalSpeed) {
            const directionX = square.dx / currentSpeed;
            const directionY = square.dy / currentSpeed;
            square.dx = directionX * effectiveNormalSpeed;
            square.dy = directionY * effectiveNormalSpeed;
        }
        
        square.x += square.dx;
        square.y += square.dy;
        
        // Wall bouncing
        if (square.x <= 0 || square.x >= maxX) {
            square.dx = -square.dx;
            square.x = Math.max(0, Math.min(square.x, maxX));
        }
        
        if (square.y <= 0 || square.y >= maxY) {
            square.dy = -square.dy;
            square.y = Math.max(0, Math.min(square.y, maxY));
        }
    }
    
    handleCollision(square1, square2) {
        let damage1 = square2.getEffectiveDamage();
        let damage2 = square1.getEffectiveDamage();
        
        // Apply shield reduction
        if (square1.powerups && square1.powerups.shield) {
            damage1 = Math.floor(damage1 * (1 - square1.powerups.shield));
        }
        if (square2.powerups && square2.powerups.shield) {
            damage2 = Math.floor(damage2 * (1 - square2.powerups.shield));
        }
        
        square1.health -= damage1;
        square2.health -= damage2;
        
        const died1 = square1.health <= 0;
        const died2 = square2.health <= 0;
        
        if (died1 || died2) {
            return { died1, died2 };
        }
        
        // Calculate center points
        const center1X = square1.x + square1.size / 2;
        const center1Y = square1.y + square1.size / 2;
        const center2X = square2.x + square2.size / 2;
        const center2Y = square2.y + square2.size / 2;
        
        // Calculate collision normal
        let dx = center1X - center2X;
        let dy = center1Y - center2Y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        // Handle edge case where squares are exactly on top of each other
        if (distance < 0.001) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            distance = Math.sqrt(dx * dx + dy * dy);
        }
        
        const normalX = dx / distance;
        const normalY = dy / distance;
        
        // Separate squares to prevent overlap
        const minDistance = square1.size;
        if (distance < minDistance) {
            const overlap = minDistance - distance;
            const separationAmount = (overlap + square1.separationBias) / 2;
            
            square1.x += normalX * separationAmount;
            square1.y += normalY * separationAmount;
            square2.x -= normalX * separationAmount;
            square2.y -= normalY * separationAmount;
        }
        
        // Physics constants
        const mass1 = 1.0;
        const mass2 = 1.0;
        
        // Calculate relative velocity along collision normal
        const relativeVx = square1.dx - square2.dx;
        const relativeVy = square1.dy - square2.dy;
        const relativeSpeed = relativeVx * normalX + relativeVy * normalY;
        
        // Only resolve if objects are moving towards each other
        if (relativeSpeed < 0) {
            const impulse = -(1 + square1.restitution) * relativeSpeed / (1/mass1 + 1/mass2);
            
            square1.dx += (impulse * normalX) / mass1;
            square1.dy += (impulse * normalY) / mass1;
            square2.dx -= (impulse * normalX) / mass2;
            square2.dy -= (impulse * normalY) / mass2;
        }
        
        this.clampVelocity(square1);
        this.clampVelocity(square2);
        
        return { died1: false, died2: false };
    }
}

module.exports = PhysicsSystem;
