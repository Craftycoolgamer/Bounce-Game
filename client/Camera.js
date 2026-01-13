import { GameConfig } from './config/gameConfig.js';

export class Camera {
    constructor(viewport, gameArea, network = null) {
        this.viewport = viewport;
        this.gameArea = gameArea;
        this.network = network; // To get server config
        
        this.panState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            translateX: 0,
            translateY: 0
        };
        
        this.zoomState = {
            scale: 1,
            minScale: GameConfig.camera.minScale,
            maxScale: GameConfig.camera.maxScale
        };
        
        this.touchState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            lastDistance: 0,
            initialScale: 1,
            initialTranslateX: 0,
            initialTranslateY: 0
        };
        
        this.initialize();
    }
    
    initialize() {
        if (!this.viewport) return;
        
        // Get world dimensions from server config (single source of truth)
        const worldWidth = this.network && this.network.getGameConfig() 
            ? this.network.getGameConfig().worldWidth 
            : 1920; // Fallback
        const worldHeight = this.network && this.network.getGameConfig() 
            ? this.network.getGameConfig().worldHeight 
            : 1080; // Fallback
        
        // Calculate initial scale to fit viewport
        const initialScale = Math.min(
            window.innerWidth / worldWidth,
            window.innerHeight / worldHeight
        );
        this.zoomState.scale = initialScale;
        
        // Center the game area initially
        this.panState.translateX = (window.innerWidth - worldWidth * initialScale) / 2;
        this.panState.translateY = (window.innerHeight - worldHeight * initialScale) / 2;
        
        this.updateTransform();
        this.setupEventListeners();
    }
    
    reinitializeWithConfig() {
        // Re-initialize camera positioning when server config is available
        // Don't call setupEventListeners() again to avoid duplicates
        if (!this.viewport || !this.network || !this.network.getGameConfig()) return;
        
        const config = this.network.getGameConfig();
        const worldWidth = config.worldWidth;
        const worldHeight = config.worldHeight;
        
        // Calculate initial scale to fit viewport
        const initialScale = Math.min(
            window.innerWidth / worldWidth,
            window.innerHeight / worldHeight
        );
        this.zoomState.scale = initialScale;
        
        // Center the game area initially
        this.panState.translateX = (window.innerWidth - worldWidth * initialScale) / 2;
        this.panState.translateY = (window.innerHeight - worldHeight * initialScale) / 2;
        
        this.updateTransform();
    }
    
    setupEventListeners() {
        // Mouse drag handlers
        this.viewport.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.viewport.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.viewport.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.viewport.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        // Mouse wheel zoom
        this.viewport.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Touch handlers for mobile
        this.viewport.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.viewport.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.viewport.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }
    
    updateTransform() {
        if (!this.gameArea) return;
        this.gameArea.style.transform = `translate(${this.panState.translateX}px, ${this.panState.translateY}px) scale(${this.zoomState.scale})`;
    }
    
    handleMouseDown(e) {
        // Don't start drag if clicking on interactive elements
        if (e.target !== this.viewport && e.target !== this.gameArea && !e.target.closest('#gameArea')) {
            return;
        }
        this.panState.isDragging = true;
        this.panState.startX = e.clientX - this.panState.translateX;
        this.panState.startY = e.clientY - this.panState.translateY;
        this.viewport.classList.add('dragging');
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        if (!this.panState.isDragging) return;
        this.panState.translateX = e.clientX - this.panState.startX;
        this.panState.translateY = e.clientY - this.panState.startY;
        this.updateTransform();
        e.preventDefault();
    }
    
    handleMouseUp(e) {
        if (this.panState.isDragging) {
            this.panState.isDragging = false;
            this.viewport.classList.remove('dragging');
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -GameConfig.camera.zoomStep : GameConfig.camera.zoomStep;
        const newScale = Math.max(
            this.zoomState.minScale,
            Math.min(this.zoomState.maxScale, this.zoomState.scale + delta)
        );
        
        // Zoom towards mouse position
        const rect = this.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate zoom point in game coordinates
        const gameX = (mouseX - this.panState.translateX) / this.zoomState.scale;
        const gameY = (mouseY - this.panState.translateY) / this.zoomState.scale;
        
        this.zoomState.scale = newScale;
        
        // Adjust pan to zoom towards mouse
        this.panState.translateX = mouseX - gameX * this.zoomState.scale;
        this.panState.translateY = mouseY - gameY * this.zoomState.scale;
        
        this.updateTransform();
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            // Single touch - pan
            const touch = e.touches[0];
            this.touchState.isDragging = true;
            this.touchState.startX = touch.clientX - this.panState.translateX;
            this.touchState.startY = touch.clientY - this.panState.translateY;
            this.viewport.classList.add('dragging');
        } else if (e.touches.length === 2) {
            // Two touches - zoom
            this.touchState.isDragging = false;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.touchState.lastDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            this.touchState.initialScale = this.zoomState.scale;
            this.touchState.initialTranslateX = this.panState.translateX;
            this.touchState.initialTranslateY = this.panState.translateY;
        }
        e.preventDefault();
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1 && this.touchState.isDragging) {
            // Single touch - pan
            const touch = e.touches[0];
            this.panState.translateX = touch.clientX - this.touchState.startX;
            this.panState.translateY = touch.clientY - this.touchState.startY;
            this.updateTransform();
        } else if (e.touches.length === 2) {
            // Two touches - zoom
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            const scaleChange = distance / this.touchState.lastDistance;
            const newScale = Math.max(
                this.zoomState.minScale,
                Math.min(this.zoomState.maxScale, this.touchState.initialScale * scaleChange)
            );
            
            // Zoom towards center of two touches
            const rect = this.viewport.getBoundingClientRect();
            const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
            const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
            
            const gameX = (centerX - this.touchState.initialTranslateX) / this.touchState.initialScale;
            const gameY = (centerY - this.touchState.initialTranslateY) / this.touchState.initialScale;
            
            this.zoomState.scale = newScale;
            this.panState.translateX = centerX - gameX * this.zoomState.scale;
            this.panState.translateY = centerY - gameY * this.zoomState.scale;
            
            this.updateTransform();
        }
        e.preventDefault();
    }
    
    handleTouchEnd(e) {
        this.touchState.isDragging = false;
        this.viewport.classList.remove('dragging');
    }
}
