// Client-side only configuration
// Note: Square/powerup sizes and world dimensions come from server (single source of truth)
export const GameConfig = {
    // Rendering (client-only settings)
    rendering: {
        nametagOffset: -14,
        healthBarOffset: 2,
        deathAnimationDuration: 300
    },
    
    // Camera (client-only settings)
    camera: {
        minScale: 0.1,
        maxScale: 5,
        zoomStep: 0.1
    }
};
