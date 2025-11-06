const GAME_CONFIG = {
    ROWS: 20,
    COLUMNS: 10,
    BASE_SPEED: 500,
    FAST_DROP_SPEED: 33,
    MOVE_DELAY: 75,
    MOVE_REPEAT_SPEED: 50,
    LINE_GOAL: 40,
    COUNTDOWN_DURATION: 1900,
    COUNTDOWN_INTERVAL: 330
};

const PIECE_DEFINITIONS = [
    { 
        name: 'I', 
        rotations: [
            { x: [4, 5, 6, 7], y: [1, 1, 1, 1] },
            { x: [5, 5, 5, 5], y: [1, 0, -1, -2] }
        ]
    },
    { 
        name: 'J', 
        rotations: [
            { x: [4, 5, 6, 4], y: [1, 1, 1, 0] },
            { x: [5, 6, 5, 5], y: [1, -1, 0, -1] },
            { x: [4, 5, 6, 6], y: [0, 0, 0, 1] },
            { x: [5, 6, 6, 6], y: [1, 1, 0, -1] }
        ]
    },
    { 
        name: 'L', 
        rotations: [
            { x: [4, 5, 6, 6], y: [1, 1, 1, 0] },
            { x: [5, 6, 5, 5], y: [1, 1, 0, -1] },
            { x: [4, 4, 5, 6], y: [1, 0, 0, 0] },
            { x: [6, 6, 6, 5], y: [1, 0, -1, -1] }
        ]
    },
    { 
        name: 'O', 
        rotations: [
            { x: [5, 6, 5, 6], y: [1, 1, 0, 0] }
        ]
    },
    { 
        name: 'S', 
        rotations: [
            { x: [4, 5, 5, 6], y: [1, 1, 0, 0] },
            { x: [6, 5, 6, 5], y: [1, 0, 0, -1] }
        ]
    },
    { 
        name: 'T', 
        rotations: [
            { x: [4, 5, 6, 5], y: [1, 1, 1, 0] },
            { x: [5, 5, 6, 5], y: [1, 0, 0, -1] },
            { x: [5, 4, 5, 6], y: [1, 0, 0, 0] },
            { x: [5, 4, 5, 5], y: [1, 0, 0, -1] }
        ]
    },
    { 
        name: 'Z', 
        rotations: [
            { x: [5, 6, 4, 5], y: [1, 1, 0, 0] },
            { x: [5, 5, 6, 6], y: [1, 0, 0, -1] }
        ]
    }
];

// ===================================
// DOM ELEMENTS
// ===================================
const DOM = {
    gameScreen: document.getElementById('gameScreen'),
    gameContainer: document.getElementById('gameContainer'),
    lineCounter: document.getElementById('lineCounter'),
    timer: document.getElementById('timer'),
    nextContainer: document.getElementById('nextContainer'),
    holdContainer: document.getElementById('holdContainer'),
    lineCounterAndTimer: document.getElementById('lineCounterAndTimer'),
    startElement: document.getElementById('start'),
    startH2: document.getElementById('startH2')
};

// ===================================
// GAME STATE
// ===================================
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.isRunning = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.hasStarted = false;
        this.linesCleared = 0;
        this.score = 0;
        
        // Timer
        this.timerStartTime = null;
        this.timerIntervalId = null;
        
        // Board state
        this.placedBlocks = [];
        
        // Input state
        this.keys = {
            left: false,
            right: false,
            down: false,
            rotate: false,
            hardDrop: false
        };
        this.moveIntervalId = null;
    }
}

// ===================================
// PIECE CLASS
// ===================================
class Piece {
    constructor(definition) {
        this.definition = definition;
        this.name = definition.name;
        this.rotationIndex = 0;
        this.x = 0;
        this.y = 0;
        this.elements = [];
    }

    getCurrentRotation() {
        return this.definition.rotations[this.rotationIndex];
    }

    getBlockPositions() {
        const rotation = this.getCurrentRotation();
        return rotation.x.map((xOffset, i) => ({
            x: xOffset + this.x,
            y: rotation.y[i] + this.y
        }));
    }

    rotate() {
        const nextRotation = (this.rotationIndex + 1) % this.definition.rotations.length;
        const canRotate = this.canPlaceAt(this.x, this.y, nextRotation);
        
        if (canRotate) {
            this.rotationIndex = nextRotation;
            return true;
        }
        
        // Try wall kicks
        const kicks = [1, -1, 2, -2];
        for (const kick of kicks) {
            if (this.canPlaceAt(this.x + kick, this.y, nextRotation)) {
                this.x += kick;
                this.rotationIndex = nextRotation;
                return true;
            }
        }
        
        return false;
    }

    canPlaceAt(x, y, rotationIndex = this.rotationIndex) {
        const rotation = this.definition.rotations[rotationIndex];
        
        for (let i = 0; i < rotation.x.length; i++) {
            const blockX = rotation.x[i] + x;
            const blockY = rotation.y[i] + y;
            
            // Check bounds
            if (blockX < 1 || blockX > GAME_CONFIG.COLUMNS) return false;
            if (blockY > GAME_CONFIG.ROWS) return false;
            
            // Check collision with placed pieces
            if (blockY > 0 && gameState.placedBlocks.some(block => 
                block.x === blockX && block.y === blockY
            )) {
                return false;
            }
        }
        
        return true;
    }

    moveLeft() {
        if (this.canPlaceAt(this.x - 1, this.y)) {
            this.x--;
            return true;
        }
        return false;
    }

    moveRight() {
        if (this.canPlaceAt(this.x + 1, this.y)) {
            this.x++;
            return true;
        }
        return false;
    }

    moveDown() {
        if (this.canPlaceAt(this.x, this.y + 1)) {
            this.y++;
            return true;
        }
        return false;
    }

    getGhostY() {
        let ghostY = this.y;
        while (this.canPlaceAt(this.x, ghostY + 1)) {
            ghostY++;
        }
        return ghostY;
    }
}

// ===================================
// PIECE QUEUE MANAGER
// ===================================
class PieceQueue {
    constructor() {
        this.queue = [];
        this.fillQueue();
    }

    fillQueue() {
        while (this.queue.length < 5) {
            const randomIndex = Math.floor(Math.random() * PIECE_DEFINITIONS.length);
            this.queue.push(PIECE_DEFINITIONS[randomIndex]);
        }
        this.updatePreview();
    }

    getNext() {
        const definition = this.queue.shift();
        this.fillQueue();
        return new Piece(definition);
    }

    peek(index = 0) {
        return this.queue[index];
    }

    updatePreview() {
        for (let i = 0; i < 5; i++) {
            const piece = this.queue[i];
            const element = document.getElementById(`piece${i + 1}`);
            if (element && piece) {
                element.src = `assets/images/pieces/${piece.name}.png`;
            }
        }
    }
}

// ===================================
// HOLD MANAGER
// ===================================
class HoldManager {
    constructor() {
        this.heldPiece = null;
        this.canHold = true;
    }

    hold(currentPiece) {
        if (!this.canHold) return null;
        
        AudioManager.play('hold', 0.5);
        
        const temp = this.heldPiece;
        this.heldPiece = currentPiece.definition;
        this.canHold = false;
        
        this.updateDisplay();
        
        return temp ? new Piece(temp) : null;
    }

    reset() {
        this.canHold = true;
        this.updateDisplay();
    }

    updateDisplay() {
        const holdElement = document.getElementById('hold');
        if (holdElement) {
            if (this.heldPiece) {
                holdElement.src = `assets/images/pieces/${this.heldPiece.name}.png`;
                holdElement.style.filter = this.canHold ? 'none' : 'grayscale()';
            } else {
                holdElement.src = 'assets/images/blank.png';
                holdElement.style.filter = 'none';
            }
        }
    }
}

// ===================================
// RENDERER
// ===================================
class Renderer {
    static createBlock(x, y, className) {
        const block = document.createElement('div');
        block.classList.add(className);
        block.style.gridColumnStart = x;
        block.style.gridRowStart = y;
        block.style.boxShadow = 'inset 0px 3px 5px rgba(255,255,255,0.5), inset 0px -3px 5px rgba(0,0,0,0.5)';
        block.style.position = 'relative';

        const innerRing = document.createElement('div');
        innerRing.style.position = 'absolute';
        innerRing.style.top = '9px';
        innerRing.style.left = '9px';
        innerRing.style.right = '9px';
        innerRing.style.bottom = '9px';
        innerRing.style.border = '3px solid rgba(0,0,0,0.05)';
        block.appendChild(innerRing);

        return block;
    }

    static clear() {
        const elements = DOM.gameScreen.querySelectorAll('.active-piece, .ghost-piece');
        elements.forEach(el => el.remove());
    }

    static clearAll() {
        const allBlocks = DOM.gameScreen.querySelectorAll('div');
        allBlocks.forEach((block, index) => {
            setTimeout(() => {
                if (block.parentNode) {
                    block.remove();
                }
            }, 33 * index);
        });
    }

    static renderPiece(piece) {
        this.clear();
        
        // Render ghost piece
        const ghostY = piece.getGhostY();
        const rotation = piece.getCurrentRotation();
        
        rotation.x.forEach((xOffset, i) => {
            const x = xOffset + piece.x;
            const y = rotation.y[i] + ghostY;
            
            if (y > 0) {
                const block = this.createBlock(x, y, 'previewColor');
                block.classList.add('ghost-piece');
                DOM.gameScreen.appendChild(block);
            }
        });

        // Render active piece
        piece.elements = [];
        rotation.x.forEach((xOffset, i) => {
            const x = xOffset + piece.x;
            const y = rotation.y[i] + piece.y;
            
            if (y > 0) {
                const block = this.createBlock(x, y, `${piece.name}color`);
                block.classList.add('active-piece');
                DOM.gameScreen.appendChild(block);
                piece.elements.push(block);
            }
        });
    }

    static placePiece(piece) {
        const rotation = piece.getCurrentRotation();
        
        rotation.x.forEach((xOffset, i) => {
            const x = xOffset + piece.x;
            const y = rotation.y[i] + piece.y;
            
            if (y > 0) {
                const block = this.createBlock(x, y, `${piece.name}color`);
                block.setAttribute('data-placed', 'true');
                DOM.gameScreen.appendChild(block);
                gameState.placedBlocks.push({ x, y, element: block });
            }
        });
        
        this.clear();
    }

    static removeLines(lineNumbers) {
        lineNumbers.sort((a, b) => b - a);
        
        lineNumbers.forEach(line => {
            // Remove blocks on this line
            gameState.placedBlocks = gameState.placedBlocks.filter(block => {
                if (block.y === line) {
                    block.element.remove();
                    return false;
                }
                return true;
            });
            
            // Move blocks above down
            gameState.placedBlocks.forEach(block => {
                if (block.y < line) {
                    block.y++;
                    block.element.style.gridRowStart = block.y;
                }
            });
        });
    }
}

// ===================================
// AUDIO MANAGER
// ===================================
class AudioManager {
    static play(soundName, volume = 0.5) {
        const soundMap = {
            'move': 'move.mp3',
            'rotate': 'rotate.mp3',
            'hardDrop': 'hardDrop.mp3',
            'hold': 'hold.mp3',
            'single': 'single.mp3',
            'quad': 'quad.mp3',
            'countDown': 'countDown.mp3'
        };

        const filename = soundMap[soundName];
        if (!filename) return;

        const audio = new Audio(`assets/audio/${filename}`);
        audio.volume = volume;
        
        if (soundName === 'countDown') {
            audio.playbackRate = 2.7;
        }
        
        audio.play().catch(() => {
            // Ignore audio play errors
        });
    }
}

// ===================================
// TIMER
// ===================================
class Timer {
    static start() {
        gameState.timerStartTime = Date.now();
        
        gameState.timerIntervalId = setInterval(() => {
            if (!gameState.isGameOver) {
                const elapsed = Date.now() - gameState.timerStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                const milliseconds = elapsed % 1000;
                
                const secStr = seconds.toString().padStart(2, '0');
                const msStr = milliseconds.toString().padStart(3, '0');
                
                DOM.timer.innerHTML = `${minutes}:${secStr}<span class="smallerFont">.${msStr}</span>`;
            }
        }, 1);
    }

    static stop() {
        if (gameState.timerIntervalId) {
            clearInterval(gameState.timerIntervalId);
            gameState.timerIntervalId = null;
        }
    }

    static reset() {
        this.stop();
        DOM.timer.innerHTML = '0:00<span class="smallerFont">.000</span>';
    }
}

// ===================================
// LINE CLEAR HANDLER
// ===================================
class LineClearHandler {
    static check() {
        const linesToClear = [];
        
        for (let row = 1; row <= GAME_CONFIG.ROWS; row++) {
            let isComplete = true;
            
            for (let col = 1; col <= GAME_CONFIG.COLUMNS; col++) {
                if (!gameState.placedBlocks.some(block => block.x === col && block.y === row)) {
                    isComplete = false;
                    break;
                }
            }
            
            if (isComplete) {
                linesToClear.push(row);
            }
        }
        
        if (linesToClear.length > 0) {
            this.clearLines(linesToClear);
        }
    }

    static clearLines(lines) {
        const count = lines.length;
        gameState.linesCleared += count;
        
        // Update display
        DOM.lineCounter.innerHTML = `${gameState.linesCleared}<span class="smallerFont">/${GAME_CONFIG.LINE_GOAL}</span>`;
        
        // Play sound
        this.playLineClearSound(count);
        
        // Remove lines
        Renderer.removeLines(lines);
        
        // Check win condition
        if (gameState.linesCleared >= GAME_CONFIG.LINE_GOAL) {
            Game.win();
        }
    }

    static playLineClearSound(count) {
        switch (count) {
            case 1:
                AudioManager.play('single', 0.2);
                break;
            case 2:
                AudioManager.play('single', 0.3);
                break;
            case 3:
                AudioManager.play('quad', 0.2);
                break;
            case 4:
                AudioManager.play('quad', 0.4);
                break;
        }
    }

    static reset() {
        gameState.linesCleared = 0;
        DOM.lineCounter.innerHTML = `0<span class="smallerFont">/${GAME_CONFIG.LINE_GOAL}</span>`;
    }
}

// ===================================
// MAIN GAME CONTROLLER
// ===================================
class Game {
    static init() {
        this.pieceQueue = new PieceQueue();
        this.holdManager = new HoldManager();
        this.currentPiece = null;
        this.dropTimeoutId = null;
        
        this.setupInitialDisplay();
    }

    static setupInitialDisplay() {
        DOM.nextContainer.style.display = 'none';
        DOM.holdContainer.style.display = 'none';
        DOM.lineCounterAndTimer.style.display = 'none';
        DOM.gameContainer.style.display = 'none';

        setTimeout(() => {
            DOM.nextContainer.style.display = 'block';
            DOM.holdContainer.style.display = 'block';
            DOM.lineCounterAndTimer.style.display = 'block';
            DOM.gameContainer.style.display = 'flex';
        }, 1);
    }

    static start() {
        if (gameState.hasStarted) return;
        
        gameState.hasStarted = true;
        AudioManager.play('countDown', 0.2);
        LineClearHandler.reset();
        Timer.reset();
        
        this.showCountdown();
    }

    static showCountdown() {
        DOM.lineCounterAndTimer.style.opacity = '1';
        DOM.nextContainer.style.opacity = '1';
        DOM.holdContainer.style.opacity = '1';
        DOM.gameContainer.style.filter = 'blur(0px)';
        
        for (let i = 3; i >= 0; i--) {
            setTimeout(() => {
                DOM.startH2.innerHTML = i === 0 ? 'GO!' : i.toString();
            }, (3 - i) * GAME_CONFIG.COUNTDOWN_INTERVAL);
        }
        
        DOM.startElement.style.opacity = '0';
        
        setTimeout(() => {
            gameState.isRunning = true;
            Timer.start();
            this.spawnPiece();
        }, GAME_CONFIG.COUNTDOWN_DURATION);
    }

    static spawnPiece() {
        this.currentPiece = this.pieceQueue.getNext();
        this.holdManager.reset();
        
        // Check if piece can spawn
        if (!this.currentPiece.canPlaceAt(0, 0)) {
            this.gameOver();
            return;
        }
        
        Renderer.renderPiece(this.currentPiece);
        this.scheduleDrop();
    }

    static scheduleDrop() {
        if (this.dropTimeoutId) {
            clearTimeout(this.dropTimeoutId);
        }
        
        const speed = gameState.keys.down ? GAME_CONFIG.FAST_DROP_SPEED : GAME_CONFIG.BASE_SPEED;
        
        this.dropTimeoutId = setTimeout(() => {
            this.dropPiece();
        }, speed);
    }

    static dropPiece() {
        if (!gameState.isRunning || !this.currentPiece) return;
        
        if (gameState.keys.down) {
            AudioManager.play('move', 0.5);
        }
        
        const moved = this.currentPiece.moveDown();
        
        if (moved) {
            Renderer.renderPiece(this.currentPiece);
            this.scheduleDrop();
        } else {
            this.lockPiece();
        }
    }

    static lockPiece() {
        if (!this.currentPiece) return;
        
        // Check if piece is above the visible area
        const positions = this.currentPiece.getBlockPositions();
        if (positions.some(pos => pos.y <= 0)) {
            this.gameOver();
            return;
        }
        
        Renderer.placePiece(this.currentPiece);
        LineClearHandler.check();
        
        if (gameState.isRunning) {
            this.spawnPiece();
        }
    }

    static hardDrop() {
        if (!this.currentPiece || !gameState.isRunning) return;
        
        AudioManager.play('hardDrop', 0.5);
        
        while (this.currentPiece.moveDown()) {
            // Move piece to bottom
        }
        
        if (this.dropTimeoutId) {
            clearTimeout(this.dropTimeoutId);
        }
        
        this.lockPiece();
    }

    static hold() {
        if (!this.currentPiece || !gameState.isRunning) return;
        
        const swappedPiece = this.holdManager.hold(this.currentPiece);
        
        if (this.dropTimeoutId) {
            clearTimeout(this.dropTimeoutId);
        }
        
        if (swappedPiece) {
            this.currentPiece = swappedPiece;
        } else {
            this.currentPiece = this.pieceQueue.getNext();
        }
        
        Renderer.renderPiece(this.currentPiece);
        this.scheduleDrop();
    }

    static gameOver() {
        gameState.isRunning = false;
        gameState.isGameOver = true;
        
        Timer.stop();
        Renderer.clearAll();
        
        DOM.gameContainer.style.filter = 'blur(5px)';
        DOM.startH2.innerHTML = gameState.linesCleared >= GAME_CONFIG.LINE_GOAL 
            ? `Time: ${DOM.timer.innerHTML}<br><h6>Press enter to start</h6>`
            : 'Press enter to start';
        DOM.startElement.style.opacity = '1';
    }

    static win() {
        this.gameOver();
    }

    static reset() {
        if (this.dropTimeoutId) {
            clearTimeout(this.dropTimeoutId);
        }
        
        gameState.reset();
        gameState.placedBlocks = [];
        
        Renderer.clearAll();
        
        this.pieceQueue = new PieceQueue();
        this.holdManager = new HoldManager();
        this.holdManager.updateDisplay();
        this.currentPiece = null;
    }
}

// ===================================
// INPUT HANDLER
// ===================================
class InputHandler {
    static init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    }

    static handleKeyDown(event) {
        // Start game
        if (event.key === 'Enter' && !gameState.hasStarted) {
            Game.reset();
            Game.start();
            return;
        }

        // Restart game
        if (event.key === 'r' || event.key === 'R') {
            location.reload();
            return;
        }

        if (!gameState.isRunning) return;

        // Movement
        if ((event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') && !gameState.keys.left) {
            gameState.keys.left = true;
            this.moveWithDelay('left');
        }

        if ((event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') && !gameState.keys.right) {
            gameState.keys.right = true;
            this.moveWithDelay('right');
        }

        // Rotation
        if ((event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') && !gameState.keys.rotate) {
            gameState.keys.rotate = true;
            if (Game.currentPiece && Game.currentPiece.rotate()) {
                AudioManager.play('rotate', 0.5);
                Renderer.renderPiece(Game.currentPiece);
            }
        }

        // Soft drop
        if ((event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') && !gameState.keys.down) {
            gameState.keys.down = true;
            Game.scheduleDrop(); // Reschedule with faster speed
        }

        // Hard drop
        if (event.code === 'Space' && !gameState.keys.hardDrop) {
            gameState.keys.hardDrop = true;
            Game.hardDrop();
        }

        // Hold
        if (event.key === 'Shift') {
            Game.hold();
        }
    }

    static handleKeyUp(event) {
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
            gameState.keys.left = false;
            if (gameState.moveIntervalId) {
                clearInterval(gameState.moveIntervalId);
                gameState.moveIntervalId = null;
            }
        }

        if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
            gameState.keys.right = false;
            if (gameState.moveIntervalId) {
                clearInterval(gameState.moveIntervalId);
                gameState.moveIntervalId = null;
            }
        }

        if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
            gameState.keys.rotate = false;
        }

        if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
            gameState.keys.down = false;
            Game.scheduleDrop(); // Reschedule with normal speed
        }

        if (event.code === 'Space') {
            gameState.keys.hardDrop = false;
        }
    }

    static moveWithDelay(direction) {
        this.movePiece(direction);
        
        setTimeout(() => {
            if (gameState.keys[direction]) {
                gameState.moveIntervalId = setInterval(() => {
                    if (gameState.keys[direction]) {
                        this.movePiece(direction);
                    }
                }, GAME_CONFIG.MOVE_REPEAT_SPEED);
            }
        }, GAME_CONFIG.MOVE_DELAY);
    }

    static movePiece(direction) {
        if (!Game.currentPiece || !gameState.isRunning) return;
        
        let moved = false;
        
        if (direction === 'left') {
            moved = Game.currentPiece.moveLeft();
        } else if (direction === 'right') {
            moved = Game.currentPiece.moveRight();
        }
        
        if (moved) {
            AudioManager.play('move', 0.5);
            Renderer.renderPiece(Game.currentPiece);
        }
    }

    static handleTouchStart(startEvent) {
        if (!gameState.isRunning) return;
        
        const startX = startEvent.touches[0].clientX;
        const startY = startEvent.touches[0].clientY;

        document.addEventListener('touchend', (endEvent) => {
            const endX = endEvent.changedTouches[0].clientX;
            const endY = endEvent.changedTouches[0].clientY;

            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const threshold = 50;

            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
                // Horizontal swipe
                if (deltaX > 0) {
                    this.moveWithDelay('right');
                } else {
                    this.moveWithDelay('left');
                }
            } else if (Math.abs(deltaY) > threshold) {
                // Vertical swipe
                if (deltaY > 0) {
                    // Swipe down - hard drop
                    Game.hardDrop();
                }
            } else {
                // Tap - rotate
                if (Game.currentPiece && Game.currentPiece.rotate()) {
                    AudioManager.play('rotate', 0.5);
                    Renderer.renderPiece(Game.currentPiece);
                }
            }
        }, { once: true });
    }
}

// ===================================
// INITIALIZATION
// ===================================
const gameState = new GameState();

document.addEventListener('DOMContentLoaded', () => {
    Game.init();
    InputHandler.init();
});
