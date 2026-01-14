// Client-side only configuration for presentation/rendering
// NOTE: All game logic, physics, and game state values come from the server (single source of truth)
// This file only contains client-side presentation settings that don't affect game logic
export const GameConfig = {
    // Rendering (client-only presentation settings)
    rendering: {
        nametagOffset: -14,
        healthBarOffset: 2,
        deathAnimationDuration: 300
    },
    
    // Camera (client-only presentation settings)
    camera: {
        minScale: 0.1,
        maxScale: 5,
        zoomStep: 0.1
    }
};
