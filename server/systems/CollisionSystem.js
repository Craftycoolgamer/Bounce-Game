const GameConfig = require('../config/gameConfig');

class CollisionSystem {
    constructor() {
        this.squareSize = GameConfig.square.size;
    }
    
    // Static AABB collision check (for already overlapping objects)
    checkCollision(square1, square2) {
        return square1.x < square2.x + this.squareSize &&
               square1.x + this.squareSize > square2.x &&
               square1.y < square2.y + this.squareSize &&
               square1.y + this.squareSize > square2.y;
    }
    
    // Swept AABB collision detection - prevents tunneling by checking movement path
    checkSweptCollision(square1, square2, deltaTime) {
        // Calculate relative velocity
        const relativeVx = square1.dx - square2.dx;
        const relativeVy = square1.dy - square2.dy;
        
        // If not moving relative to each other, use static collision check
        if (Math.abs(relativeVx) < 0.001 && Math.abs(relativeVy) < 0.001) {
            return this.checkCollision(square1, square2) ? { collided: true, t: 0 } : { collided: false };
        }
        
        // Expand square2 by square1's size (Minkowski sum)
        const expandedMinX = square2.x - this.squareSize;
        const expandedMaxX = square2.x + this.squareSize;
        const expandedMinY = square2.y - this.squareSize;
        const expandedMaxY = square2.y + this.squareSize;
        
        // Calculate time of collision for each axis
        let tEntryX, tExitX, tEntryY, tExitY;
        
        if (relativeVx > 0) {
            tEntryX = (expandedMinX - square1.x) / relativeVx;
            tExitX = (expandedMaxX - square1.x) / relativeVx;
        } else if (relativeVx < 0) {
            tEntryX = (expandedMaxX - square1.x) / relativeVx;
            tExitX = (expandedMinX - square1.x) / relativeVx;
        } else {
            tEntryX = -Infinity;
            tExitX = Infinity;
        }
        
        if (relativeVy > 0) {
            tEntryY = (expandedMinY - square1.y) / relativeVy;
            tExitY = (expandedMaxY - square1.y) / relativeVy;
        } else if (relativeVy < 0) {
            tEntryY = (expandedMaxY - square1.y) / relativeVy;
            tExitY = (expandedMinY - square1.y) / relativeVy;
        } else {
            tEntryY = -Infinity;
            tExitY = Infinity;
        }
        
        // Find the latest entry and earliest exit
        const tEntry = Math.max(tEntryX, tEntryY);
        const tExit = Math.min(tExitX, tExitY);
        
        // Check if collision occurs
        if (tEntry < tExit && tEntry >= 0 && tEntry <= 1) {
            return { collided: true, t: tEntry };
        }
        
        // Also check static collision (in case they're already overlapping)
        if (this.checkCollision(square1, square2)) {
            return { collided: true, t: 0 };
        }
        
        return { collided: false };
    }
    
    buildSpatialGrid(squares) {
        const cellSize = GameConfig.spatialGrid.cellSize;
        const gameWidth = GameConfig.world.width;
        const gameHeight = GameConfig.world.height;
        const gridWidth = Math.ceil(gameWidth / cellSize);
        const gridHeight = Math.ceil(gameHeight / cellSize);
        
        // Create grid
        const grid = Array(gridHeight).fill(null).map(() => 
            Array(gridWidth).fill(null).map(() => [])
        );
        
        // Assign squares to grid cells
        squares.forEach(square => {
            const cellX = Math.floor(square.x / cellSize);
            const cellY = Math.floor(square.y / cellSize);
            const clampedX = Math.max(0, Math.min(cellX, gridWidth - 1));
            const clampedY = Math.max(0, Math.min(cellY, gridHeight - 1));
            grid[clampedY][clampedX].push(square);
        });
        
        return { grid, gridWidth, gridHeight };
    }
    
    detectCollisions(squares, deltaTime) {
        const { grid, gridWidth, gridHeight } = this.buildSpatialGrid(squares);
        const collisionPairs = [];
        const processedPairs = new Set();
        
        // Check collisions using spatial grid
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = grid[y][x];
                
                // Check collisions within cell
                for (let i = 0; i < cell.length; i++) {
                    for (let j = i + 1; j < cell.length; j++) {
                        const square1 = cell[i];
                        const square2 = cell[j];
                        const pairKey = square1.id < square2.id 
                            ? `${square1.id}-${square2.id}` 
                            : `${square2.id}-${square1.id}`;
                        
                        if (!processedPairs.has(pairKey) && squares.includes(square1) && squares.includes(square2)) {
                            processedPairs.add(pairKey);
                            const collision = this.checkSweptCollision(square1, square2, deltaTime);
                            
                            if (collision.collided) {
                                // If collision occurs in the future, resolve it at the time of impact
                                if (collision.t > 0 && collision.t < 1) {
                                    const oldX1 = square1.x;
                                    const oldY1 = square1.y;
                                    const oldX2 = square2.x;
                                    const oldY2 = square2.y;
                                    
                                    square1.x = oldX1 + square1.dx * collision.t;
                                    square1.y = oldY1 + square1.dy * collision.t;
                                    square2.x = oldX2 + square2.dx * collision.t;
                                    square2.y = oldY2 + square2.dy * collision.t;
                                }
                                
                                collisionPairs.push({ square1, square2 });
                            }
                        }
                    }
                }
                
                // Check collisions with adjacent cells (right, down, down-right, down-left)
                const adjacentOffsets = [
                    [1, 0],   // right
                    [0, 1],   // down
                    [1, 1],   // down-right
                    [-1, 1]   // down-left
                ];
                
                for (const [dx, dy] of adjacentOffsets) {
                    const adjX = x + dx;
                    const adjY = y + dy;
                    
                    if (adjX >= 0 && adjX < gridWidth && adjY >= 0 && adjY < gridHeight) {
                        const adjCell = grid[adjY][adjX];
                        
                        for (const square1 of cell) {
                            for (const square2 of adjCell) {
                                const pairKey = square1.id < square2.id 
                                    ? `${square1.id}-${square2.id}` 
                                    : `${square2.id}-${square1.id}`;
                                
                                if (!processedPairs.has(pairKey) && squares.includes(square1) && squares.includes(square2)) {
                                    processedPairs.add(pairKey);
                                    const collision = this.checkSweptCollision(square1, square2, deltaTime);
                                    
                                    if (collision.collided) {
                                        if (collision.t > 0 && collision.t < 1) {
                                            const oldX1 = square1.x;
                                            const oldY1 = square1.y;
                                            const oldX2 = square2.x;
                                            const oldY2 = square2.y;
                                            
                                            square1.x = oldX1 + square1.dx * collision.t;
                                            square1.y = oldY1 + square1.dy * collision.t;
                                            square2.x = oldX2 + square2.dx * collision.t;
                                            square2.y = oldY2 + square2.dy * collision.t;
                                        }
                                        
                                        collisionPairs.push({ square1, square2 });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return collisionPairs;
    }
}

module.exports = CollisionSystem;
