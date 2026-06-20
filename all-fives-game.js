let playerDominoes = [];
let cpuDominoes = [];
let boardDominoes = [];
let boneyard = [];
let selectedDomino = null;
let isPlayerTurn = true;
let boardEnds = { left: null, right: null, top: null, bottom: null };
let endPositions = { left: null, right: null, top: null, bottom: null };
let boardDimensions = { width: 0, height: 0 };
let isShowingZones = false;
let playerScore = 0;
let cpuScore = 0;
let audioContext = null;
let camera = { x: 0, y: 0, zoom: 1 };
let cameraAnimating = false;
let cameraAnimationFrame = null;
let momentumFrame = null;
let lastPanVelocity = { x: 0, y: 0 };
const FOCUS_ZOOM = 1.35;
const BOARD_EDGE_MARGIN = 150;
let startingDomino = null;

function init() {
    initializeBoard();
    dealDominoes();
    const starter = findStarter(playerDominoes, cpuDominoes);
    startingDomino = starter.domino;
    isPlayerTurn = starter.owner === 'player';
    renderRacks();
    updateScores();
    showTurnIndicator(starter);
    setupTouchScrolling();
    initAudio();
    centerCameraOnBoard();
    updateDrawButton();

    if (!isPlayerTurn) {
        setTimeout(cpuPlay, 1500);
    }
}

function createDominoSet() {
    const dominoes = [];
    for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) {
            dominoes.push({ top: i, bottom: j, id: `${i}-${j}` });
        }
    }
    return shuffle(dominoes);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function initializeBoard() {
    const board = getBoardElement();
    if (!board) return;

    board.innerHTML = '';
    boardDominoes = [];
    boardEnds = { left: null, right: null, top: null, bottom: null };
    endPositions = { left: null, right: null, top: null, bottom: null };
    boardDimensions.width = 800;
    boardDimensions.height = 600;
    board.style.width = '800px';
    board.style.height = '600px';
}

function formatDominoLabel(domino) {
    return `${domino.top}|${domino.bottom}`;
}

function getDominoRank(domino) {
    if (domino.top === domino.bottom) {
        return 1000 + domino.top;
    }
    return domino.top + domino.bottom;
}

function findStarter(playerHand, cpuHand) {
    let bestDomino = null;
    let bestOwner = null;

    [
        { owner: 'player', hand: playerHand },
        { owner: 'cpu', hand: cpuHand }
    ].forEach(({ owner, hand }) => {
        hand.forEach(domino => {
            if (!bestDomino || getDominoRank(domino) > getDominoRank(bestDomino)) {
                bestDomino = domino;
                bestOwner = owner;
            }
        });
    });

    return { domino: bestDomino, owner: bestOwner };
}

function getFirstMovePlacement(domino) {
    const isDouble = domino.top === domino.bottom;
    const width = isDouble ? 50 : 100;
    const height = isDouble ? 100 : 50;
    const x = (boardDimensions.width - width) / 2;
    const y = (boardDimensions.height - height) / 2;

    return {
        side: 'center',
        x,
        y,
        width,
        height,
        horizontal: !isDouble
    };
}

function showTurnIndicator(starter) {
    const indicator = document.getElementById('turnIndicator');
    if (!indicator) return;

    const dominoLabel = formatDominoLabel(starter.domino);
    if (starter.owner === 'player') {
        indicator.innerHTML = `<strong>You go first!</strong>Play your <span class="starter-domino-label">${dominoLabel}</span> in the center`;
    } else {
        indicator.innerHTML = `<strong>CPU goes first</strong>CPU has the <span class="starter-domino-label">${dominoLabel}</span>`;
    }
    indicator.classList.remove('hidden');
}

function hideTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    if (indicator) indicator.classList.add('hidden');
}

function shiftBoardContent(shiftX, shiftY) {
    if (!shiftX && !shiftY) return;

    boardDominoes.forEach(placed => {
        placed.x += shiftX;
        placed.y += shiftY;
        placed.element.style.left = placed.x + 'px';
        placed.element.style.top = placed.y + 'px';
    });

    ['left', 'right', 'top', 'bottom'].forEach(side => {
        if (endPositions[side]) {
            endPositions[side].x += shiftX;
            endPositions[side].y += shiftY;
        }
    });

    document.querySelectorAll('.placement-zone').forEach(zone => {
        zone.style.left = (parseFloat(zone.style.left) + shiftX) + 'px';
        zone.style.top = (parseFloat(zone.style.top) + shiftY) + 'px';
    });
}

function compensateCameraForShift(shiftX, shiftY) {
    if (!shiftX && !shiftY) return;
    camera.x -= shiftX * camera.zoom;
    camera.y -= shiftY * camera.zoom;
    applyCamera();
}

function ensureBoardBounds(minX, minY, maxX, maxY) {
    const board = getBoardElement();
    if (!board) return { shiftX: 0, shiftY: 0 };

    let shiftX = 0;
    let shiftY = 0;
    let width = board.offsetWidth;
    let height = board.offsetHeight;
    let needsUpdate = false;

    if (minX < BOARD_EDGE_MARGIN) {
        shiftX = BOARD_EDGE_MARGIN - minX + 400;
        shiftBoardContent(shiftX, 0);
        minX += shiftX;
        maxX += shiftX;
        width += shiftX;
        needsUpdate = true;
    }

    if (minY < BOARD_EDGE_MARGIN) {
        shiftY = BOARD_EDGE_MARGIN - minY + 400;
        shiftBoardContent(0, shiftY);
        minY += shiftY;
        maxY += shiftY;
        height += shiftY;
        needsUpdate = true;
    }

    if (maxX > width - BOARD_EDGE_MARGIN) {
        width = maxX + 400;
        needsUpdate = true;
    }

    if (maxY > height - BOARD_EDGE_MARGIN) {
        height = maxY + 400;
        needsUpdate = true;
    }

    if (needsUpdate) {
        board.style.width = width + 'px';
        board.style.height = height + 'px';
        boardDimensions.width = width;
        boardDimensions.height = height;
    }

    compensateCameraForShift(shiftX, shiftY);

    return { shiftX, shiftY };
}

function getBoardContentBounds(extraZones = []) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;

    boardDominoes.forEach(placed => {
        const width = placed.isHorizontal ? 100 : 50;
        const height = placed.isHorizontal ? 50 : 100;
        minX = Math.min(minX, placed.x);
        minY = Math.min(minY, placed.y);
        maxX = Math.max(maxX, placed.x + width);
        maxY = Math.max(maxY, placed.y + height);
    });

    extraZones.forEach(zone => {
        minX = Math.min(minX, zone.x);
        minY = Math.min(minY, zone.y);
        maxX = Math.max(maxX, zone.x + zone.width);
        maxY = Math.max(maxY, zone.y + zone.height);
    });

    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
}

function dealDominoes() {
    const allDominoes = createDominoSet();

    playerDominoes = allDominoes.slice(0, 7);
    cpuDominoes = allDominoes.slice(7, 14);
    boneyard = allDominoes.slice(14);

    updateBoneyardCount();

    document.getElementById('drawBtn').addEventListener('click', drawFromBoneyard);
}

function createDominoElement(domino, isHorizontal) {
    const el = document.createElement('div');
    el.className = 'domino' + (isHorizontal ? ' horizontal' : '');
    el.dataset.id = domino.id;
    
    const topHalf = document.createElement('div');
    topHalf.className = 'domino-half';
    topHalf.appendChild(createPips(domino.top));
    
    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'domino-half';
    bottomHalf.appendChild(createPips(domino.bottom));
    
    el.appendChild(topHalf);
    el.appendChild(bottomHalf);
    
    return el;
}

function createPips(value) {
    const container = document.createElement('div');
    container.className = 'pips';
    container.dataset.value = value;
    
    for (let i = 0; i < 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        container.appendChild(pip);
    }
    
    return container;
}

function renderRacks() {
    const playerRack = document.getElementById('playerRack');

    playerRack.innerHTML = '';

    playerDominoes.forEach(domino => {
        const el = createDominoElement(domino, false);
        if (boardDominoes.length === 0 && isPlayerTurn && startingDomino && domino.id === startingDomino.id) {
            el.classList.add('starter-domino');
        }
        el.addEventListener('click', () => selectDomino(domino, el));
        playerRack.appendChild(el);
    });
}

function updateScores() {
    document.getElementById('playerScore').textContent = playerScore;
    document.getElementById('cpuScore').textContent = cpuScore;
}

function updateLastPlayedDomino(domino) {
    const lastPlayedContainer = document.getElementById('lastPlayedDomino');
    lastPlayedContainer.innerHTML = '';
    
    const topHalf = document.createElement('div');
    topHalf.className = 'last-played-domino-half';
    topHalf.appendChild(createMiniPips(domino.top));
    
    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'last-played-domino-half';
    bottomHalf.appendChild(createMiniPips(domino.bottom));
    
    lastPlayedContainer.appendChild(topHalf);
    lastPlayedContainer.appendChild(bottomHalf);
}

function createMiniPips(value) {
    const container = document.createElement('div');
    container.className = 'last-played-pips';
    container.dataset.value = value;
    
    for (let i = 0; i < 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'last-played-pip';
        container.appendChild(pip);
    }
    
    return container;
}

function calculateScore() {
    // In a turning chain, we need to count only the actual open ends
    // The current implementation tracks 4 independent ends, but we should only count
    // the ends that are actually part of the chain. For now, we'll count all non-null ends
    // but this is a simplification that may overcount in some scenarios.
    let sum = 0;
    
    // Only count ends that have been set (non-null)
    if (boardEnds.left !== null) {
        sum += boardEnds.left;
    }
    if (boardEnds.right !== null) {
        sum += boardEnds.right;
    }
    if (boardEnds.top !== null) {
        sum += boardEnds.top;
    }
    if (boardEnds.bottom !== null) {
        sum += boardEnds.bottom;
    }
    
    // In All Fives, you only score if the sum is a multiple of 5
    // Return the sum if it's a multiple of 5, otherwise return 0
    if (sum % 5 === 0 && sum > 0) {
        return sum;
    }
    return 0;
}

function selectDomino(domino, element) {
    if (!isPlayerTurn) return;
    
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedDomino = domino;
    
    // Play selection sound
    playSelectSound();
    
    // Show valid placement zones (use requestAnimationFrame to prevent layout thrashing)
    requestAnimationFrame(() => {
        if (!isShowingZones) {
            isShowingZones = true;
            showValidPlacementZones(domino);
            isShowingZones = false;
            requestAnimationFrame(() => updateZoneHintArrows());
        }
    });
}

function updateBoneyardCount() {
    document.getElementById('boneyardCount').textContent = boneyard.length;
    const drawBtn = document.getElementById('drawBtn');
    drawBtn.disabled = boneyard.length === 0 || !isPlayerTurn;
}

function drawFromBoneyard() {
    if (!isPlayerTurn || boneyard.length === 0) return;
    
    const drawnDomino = boneyard.pop();
    playerDominoes.push(drawnDomino);
    
    updateBoneyardCount();
    renderRacks();
    
    // Check if player now has valid moves
    updateDrawButton();
}

function checkPlayerValidMoves() {
    const hasValidMove = boardDominoes.length === 0
        ? (isPlayerTurn && startingDomino && playerDominoes.some(d => d.id === startingDomino.id))
        : playerDominoes.some(domino => {
            return (domino.top === boardEnds.left || domino.bottom === boardEnds.left ||
                    domino.top === boardEnds.right || domino.bottom === boardEnds.right ||
                    domino.top === boardEnds.top || domino.bottom === boardEnds.top ||
                    domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom);
        });
    
    const drawBtn = document.getElementById('drawBtn');
    
    if (!hasValidMove && boneyard.length > 0) {
        drawBtn.disabled = false;
    } else if (!hasValidMove && boneyard.length === 0) {
        // Player has no valid moves and boneyard is empty - skip turn
        isPlayerTurn = false;
        drawBtn.disabled = true;
        setTimeout(cpuPlay, 1000);
    } else {
        drawBtn.disabled = true;
    }
}

function updateDrawButton() {
    const drawBtn = document.getElementById('drawBtn');
    if (!isPlayerTurn) {
        drawBtn.disabled = true;
        return;
    }
    
    const hasValidMove = boardDominoes.length === 0
        ? (isPlayerTurn && startingDomino && playerDominoes.some(d => d.id === startingDomino.id))
        : playerDominoes.some(domino => {
            return (domino.top === boardEnds.left || domino.bottom === boardEnds.left ||
                    domino.top === boardEnds.right || domino.bottom === boardEnds.right ||
                    domino.top === boardEnds.top || domino.bottom === boardEnds.top ||
                    domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom);
        });
    
    // Enable draw button only if player has no valid moves and boneyard has dominoes
    if (!hasValidMove && boneyard.length > 0) {
        drawBtn.disabled = false;
    } else {
        drawBtn.disabled = true;
    }
}

function showValidPlacementZones(domino) {
    const board = document.getElementById('board');
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());

    if (boardDominoes.length === 0) {
        if (!isPlayerTurn || !startingDomino || domino.id !== startingDomino.id) {
            return;
        }

        const placement = getFirstMovePlacement(domino);
        ensureBoardBounds(placement.x, placement.y, placement.x + placement.width, placement.y + placement.height);

        const zoneEl = document.createElement('div');
        zoneEl.className = 'placement-zone';
        zoneEl.dataset.side = 'center';
        zoneEl.style.left = placement.x + 'px';
        zoneEl.style.top = placement.y + 'px';
        zoneEl.style.width = placement.width + 'px';
        zoneEl.style.height = placement.height + 'px';

        zoneEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedDomino) {
                placeDomino(selectedDomino, 'center', placement.x, placement.y, placement.horizontal);
            }
        });

        board.appendChild(zoneEl);
        requestAnimationFrame(() => updateZoneHintArrows());
        return;
    }

    const validZones = [];
    
    // Helper function to check if a zone overlaps with any placed domino
    function checkOverlap(zoneX, zoneY, zoneWidth, zoneHeight) {
        for (const placed of boardDominoes) {
            const placedWidth = placed.isHorizontal ? 100 : 50;
            const placedHeight = placed.isHorizontal ? 50 : 100;
            const placedRight = placed.x + placedWidth;
            const placedBottom = placed.y + placedHeight;
            const zoneRight = zoneX + zoneWidth;
            const zoneBottom = zoneY + zoneHeight;
            
            // Check if rectangles overlap
            if (!(zoneRight <= placed.x || 
                  zoneX >= placedRight || 
                  zoneBottom <= placed.y || 
                  zoneY >= placedBottom)) {
                return true; // Overlap detected
            }
        }
        return false; // No overlap
    }
    
    // Check left - use stored left end position
    if (boardEnds.left !== null && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) {
        const leftPos = endPositions.left;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = leftPos.x + (leftPos.isHorizontal ? 50 : 25);
        const dominoCenterY = leftPos.y + (leftPos.isHorizontal ? 25 : 50);
        
        // Doubles should be placed vertically (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceVertically = isDouble;
        
        if (shouldPlaceVertically) {
            // Vertical placement for doubles on left/right
            if (!checkOverlap(leftPos.x - 50, dominoCenterY - 50, 50, 100)) {
                validZones.push({ side: 'left', x: leftPos.x - 50, y: dominoCenterY - 50, width: 50, height: 100, horizontal: false });
            }
        } else {
            // Horizontal placement for non-doubles on left
            if (!checkOverlap(leftPos.x - 100, dominoCenterY - 25, 100, 50)) {
                validZones.push({ side: 'left', x: leftPos.x - 100, y: dominoCenterY - 25, width: 100, height: 50, horizontal: true });
            }
        }
    }
    
    // Check right - use stored right end position
    if (boardEnds.right !== null && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) {
        const rightPos = endPositions.right;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = rightPos.x + (rightPos.isHorizontal ? 50 : 25);
        const dominoCenterY = rightPos.y + (rightPos.isHorizontal ? 25 : 50);
        
        // Doubles should be placed vertically (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceVertically = isDouble;
        
        if (shouldPlaceVertically) {
            // Vertical placement for doubles on right
            if (!checkOverlap(rightPos.x + 50, dominoCenterY - 50, 50, 100)) {
                validZones.push({ side: 'right', x: rightPos.x + 50, y: dominoCenterY - 50, width: 50, height: 100, horizontal: false });
            }
        } else {
            // Horizontal placement for non-doubles on right
            const xOffset = rightPos.isHorizontal ? 100 : 50;
            if (!checkOverlap(rightPos.x + xOffset, dominoCenterY - 25, 100, 50)) {
                validZones.push({ side: 'right', x: rightPos.x + xOffset, y: dominoCenterY - 25, width: 100, height: 50, horizontal: true });
            }
        }
    }
    
    // Check top - use stored top end position
    if (boardEnds.top !== null && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) {
        const topPos = endPositions.top;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = topPos.x + (topPos.isHorizontal ? 50 : 25);
        const dominoCenterY = topPos.y + (topPos.isHorizontal ? 25 : 50);
        
        // Doubles should be placed horizontally (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceHorizontally = isDouble;
        
        if (shouldPlaceHorizontally) {
            // Horizontal placement for doubles on top/bottom
            if (!checkOverlap(dominoCenterX - 50, topPos.y - 50, 100, 50)) {
                validZones.push({ side: 'top', x: dominoCenterX - 50, y: topPos.y - 50, width: 100, height: 50, horizontal: true });
            }
        } else {
            // Vertical placement for non-doubles on top
            if (!checkOverlap(dominoCenterX - 25, topPos.y - 100, 50, 100)) {
                validZones.push({ side: 'top', x: dominoCenterX - 25, y: topPos.y - 100, width: 50, height: 100, horizontal: false });
            }
        }
    }
    
    // Check bottom - use stored bottom end position
    if (boardEnds.bottom !== null && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom)) {
        const bottomPos = endPositions.bottom;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = bottomPos.x + (bottomPos.isHorizontal ? 50 : 25);
        const dominoCenterY = bottomPos.y + (bottomPos.isHorizontal ? 25 : 50);
        
        // Doubles should be placed horizontally (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceHorizontally = isDouble;
        
        if (shouldPlaceHorizontally) {
            // Horizontal placement for doubles on bottom
            const yOffset = bottomPos.isHorizontal ? 50 : 100;
            if (!checkOverlap(dominoCenterX - 50, bottomPos.y + yOffset, 100, 50)) {
                validZones.push({ side: 'bottom', x: dominoCenterX - 50, y: bottomPos.y + yOffset, width: 100, height: 50, horizontal: true });
            }
        } else {
            // Vertical placement for non-doubles on bottom
            const yOffset = bottomPos.isHorizontal ? 50 : 100;
            if (!checkOverlap(dominoCenterX - 25, bottomPos.y + yOffset, 50, 100)) {
                validZones.push({ side: 'bottom', x: dominoCenterX - 25, y: bottomPos.y + yOffset, width: 50, height: 100, horizontal: false });
            }
        }
    }
    
    const contentBounds = getBoardContentBounds(validZones);
    if (contentBounds) {
        const { shiftX, shiftY } = ensureBoardBounds(
            contentBounds.minX,
            contentBounds.minY,
            contentBounds.maxX,
            contentBounds.maxY
        );
        validZones.forEach(zone => {
            zone.x += shiftX;
            zone.y += shiftY;
        });
    }

    validZones.forEach(zone => {
        const zoneEl = document.createElement('div');
        zoneEl.className = 'placement-zone';
        zoneEl.dataset.side = zone.side;
        zoneEl.style.left = zone.x + 'px';
        zoneEl.style.top = zone.y + 'px';
        zoneEl.style.width = zone.width + 'px';
        zoneEl.style.height = zone.height + 'px';
        
        zoneEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedDomino) {
                placeDomino(selectedDomino, zone.side, zone.x, zone.y, zone.horizontal);
            }
        });
        
        board.appendChild(zoneEl);
    });
    
    // If no valid zones for this domino, check if player needs to draw
    if (validZones.length === 0) {
        updateDrawButton();
    } else {
        requestAnimationFrame(() => updateZoneHintArrows());
    }
}

function placeDomino(domino, side, x, y, isHorizontal) {
    const boardEl = document.getElementById('board');
    
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    
    const dominoWidth = isHorizontal ? 100 : 50;
    const dominoHeight = isHorizontal ? 50 : 100;
    const { shiftX, shiftY } = ensureBoardBounds(x, y, x + dominoWidth, y + dominoHeight);
    x += shiftX;
    y += shiftY;
    
    let orientedDomino = { ...domino };

    if (side === 'center') {
        hideTurnIndicator();
        if (domino.top === domino.bottom) {
            orientedDomino = { ...domino };
            isHorizontal = false;
        } else {
            const high = Math.max(domino.top, domino.bottom);
            const low = Math.min(domino.top, domino.bottom);
            orientedDomino = { top: high, bottom: low, id: domino.id };
            isHorizontal = true;
        }
    } else {
        const matchingEnd = boardEnds[side];
    
        if (isHorizontal) {
            if (side === 'left') {
                if (domino.top === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            } else if (side === 'right') {
                if (domino.bottom === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            }
        } else {
            if (side === 'top') {
                if (domino.top === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            } else if (side === 'bottom') {
                if (domino.bottom === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            }
        }
    }
    
    const dominoEl = createDominoElement(orientedDomino, isHorizontal);
    dominoEl.style.left = x + 'px';
    dominoEl.style.top = y + 'px';
    
    boardEl.appendChild(dominoEl);
    
    // Play placement sound
    playDominoSound();
    
    boardDominoes.push({
        domino: orientedDomino,
        x: x,
        y: y,
        isHorizontal: isHorizontal,
        element: dominoEl
    });
    
    // Update board ends to the NEW exposed number (all 4 directions)
    if (side === 'center') {
        boardEnds.left = orientedDomino.top;
        boardEnds.right = orientedDomino.bottom;
        boardEnds.top = orientedDomino.top;
        boardEnds.bottom = orientedDomino.bottom;
        endPositions.left = { x, y, isHorizontal };
        endPositions.right = { x, y, isHorizontal };
        endPositions.top = { x, y, isHorizontal };
        endPositions.bottom = { x, y, isHorizontal };
    } else if (side === 'left') {
        boardEnds.left = orientedDomino.top;
        // For left placement, the end is at the left edge of the domino
        // Store the domino's position (top-left corner) and orientation
        endPositions.left = { x: x, y: y, isHorizontal: isHorizontal };
    } else if (side === 'right') {
        boardEnds.right = orientedDomino.bottom;
        // For right placement, the end is at the right edge of the domino
        // Store the domino's position (top-left corner) and orientation
        endPositions.right = { x: x, y: y, isHorizontal: isHorizontal };
    } else if (side === 'top') {
        boardEnds.top = orientedDomino.top;
        // For top placement, the end is at the top edge of the domino
        // Store the domino's position (top-left corner) and orientation
        endPositions.top = { x: x, y: y, isHorizontal: isHorizontal };
    } else if (side === 'bottom') {
        boardEnds.bottom = orientedDomino.bottom;
        // For bottom placement, the end is at the bottom edge of the domino
        // Store the domino's position (top-left corner) and orientation
        endPositions.bottom = { x: x, y: y, isHorizontal: isHorizontal };
    }
    
    // In a turning chain, when you place on one side, you might block adjacent sides
    // This is a simplified version - a full implementation would track chain topology
    // For now, we'll keep all 4 ends independent as per the current game design
    
    // Calculate and update score
    const score = calculateScore();
    if (isPlayerTurn) {
        playerScore += score;
        playerDominoes = playerDominoes.filter(d => d.id !== domino.id);
    } else {
        cpuScore += score;
        cpuDominoes = cpuDominoes.filter(d => d.id !== domino.id);
    }
    updateScores();
    
    // Update last played domino display
    updateLastPlayedDomino(orientedDomino);
    
    renderRacks();
    selectedDomino = null;
    
    isPlayerTurn = !isPlayerTurn;
    
    updateBoneyardCount();
    updateDrawButton();
    
    const placedWidth = isHorizontal ? 100 : 50;
    const placedHeight = isHorizontal ? 50 : 100;
    focusOnBoardPoint(x, y, placedWidth, placedHeight);
    
    if (!isPlayerTurn) {
        setTimeout(cpuPlay, 1000);
    }
}

function cpuPlay() {
    if (cpuDominoes.length === 0) {
        isPlayerTurn = true;
        updateBoneyardCount();
        return;
    }

    if (boardDominoes.length === 0) {
        const starterInCpuHand = cpuDominoes.find(d => d.id === startingDomino.id);
        if (starterInCpuHand) {
            const placement = getFirstMovePlacement(starterInCpuHand);
            placeDomino(starterInCpuHand, 'center', placement.x, placement.y, placement.horizontal);
        }
        return;
    }
    
    // Find valid moves for CPU using actual end positions (all 4 directions with turning)
    let validMoves = [];
    
    cpuDominoes.forEach(domino => {
        // Check left - use actual left end position
        if (boardEnds.left !== null && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) {
            const leftPos = endPositions.left;
            const dominoCenterX = leftPos.x + (leftPos.isHorizontal ? 50 : 25);
            const dominoCenterY = leftPos.y + (leftPos.isHorizontal ? 25 : 50);
            
            // Doubles should be placed vertically (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceVertically = isDouble;
            
            if (shouldPlaceVertically) {
                // Vertical placement for doubles on left
                validMoves.push({ domino, side: 'left', x: leftPos.x - 50, y: dominoCenterY - 50, horizontal: false });
            } else {
                // Horizontal placement for non-doubles on left
                validMoves.push({ domino, side: 'left', x: leftPos.x - 100, y: dominoCenterY - 25, horizontal: true });
            }
        }
        
        // Check right - use actual right end position
        if (boardEnds.right !== null && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) {
            const rightPos = endPositions.right;
            const dominoCenterX = rightPos.x + (rightPos.isHorizontal ? 50 : 25);
            const dominoCenterY = rightPos.y + (rightPos.isHorizontal ? 25 : 50);
            
            // Doubles should be placed vertically (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceVertically = isDouble;
            
            if (shouldPlaceVertically) {
                // Vertical placement for doubles on right
                validMoves.push({ domino, side: 'right', x: rightPos.x + 50, y: dominoCenterY - 50, horizontal: false });
            } else {
                // Horizontal placement for non-doubles on right
                const xOffset = rightPos.isHorizontal ? 100 : 50;
                validMoves.push({ domino, side: 'right', x: rightPos.x + xOffset, y: dominoCenterY - 25, horizontal: true });
            }
        }
        
        // Check top - use actual top end position
        if (boardEnds.top !== null && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) {
            const topPos = endPositions.top;
            const dominoCenterX = topPos.x + (topPos.isHorizontal ? 50 : 25);
            const dominoCenterY = topPos.y + (topPos.isHorizontal ? 25 : 50);
            
            // Doubles should be placed horizontally (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceHorizontally = isDouble;
            
            if (shouldPlaceHorizontally) {
                // Horizontal placement for doubles on top
                validMoves.push({ domino, side: 'top', x: dominoCenterX - 50, y: topPos.y - 50, width: 100, height: 50, horizontal: true });
            } else {
                // Vertical placement for non-doubles on top
                validMoves.push({ domino, side: 'top', x: dominoCenterX - 25, y: topPos.y - 100, horizontal: false });
            }
        }
        
        // Check bottom - use actual bottom end position
        if (boardEnds.bottom !== null && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom)) {
            const bottomPos = endPositions.bottom;
            const dominoCenterX = bottomPos.x + (bottomPos.isHorizontal ? 50 : 25);
            const dominoCenterY = bottomPos.y + (bottomPos.isHorizontal ? 25 : 50);
            
            // Doubles should be placed horizontally (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceHorizontally = isDouble;
            
            if (shouldPlaceHorizontally) {
                // Horizontal placement for doubles on bottom
                validMoves.push({ domino, side: 'bottom', x: dominoCenterX - 50, y: bottomPos.y + 50, width: 100, height: 50, horizontal: true });
            } else {
                // Vertical placement for non-doubles on bottom
                const yOffset = bottomPos.isHorizontal ? 50 : 100;
                validMoves.push({ domino, side: 'bottom', x: dominoCenterX - 25, y: bottomPos.y + yOffset, horizontal: false });
            }
        }
    });
    
    if (validMoves.length > 0) {
        // Prioritize highest doubles, then highest total value
        validMoves.sort((a, b) => {
            const aIsDouble = a.domino.top === a.domino.bottom;
            const bIsDouble = b.domino.top === b.domino.bottom;
            const aValue = a.domino.top + a.domino.bottom;
            const bValue = b.domino.top + b.domino.bottom;
            
            // Prefer doubles
            if (aIsDouble && !bIsDouble) return -1;
            if (!aIsDouble && bIsDouble) return 1;
            
            // If both are doubles or both are not doubles, prefer higher value
            return bValue - aValue;
        });
        
        const bestMove = validMoves[0];
        placeDomino(bestMove.domino, bestMove.side, bestMove.x, bestMove.y, bestMove.horizontal);
    } else {
        // CPU has no valid moves - draw from boneyard or skip turn
        if (boneyard.length > 0) {
            const drawnDomino = boneyard.pop();
            cpuDominoes.push(drawnDomino);
            updateBoneyardCount();
            setTimeout(cpuPlay, 500); // Try again after drawing
        } else {
            // CPU has no valid moves and boneyard is empty - skip turn
            isPlayerTurn = true;
            updateBoneyardCount();
        }
    }
}

function getBoardContainer() {
    return document.querySelector('.board-container');
}

function getCameraLayer() {
    return document.getElementById('cameraLayer');
}

function getBoardElement() {
    return document.getElementById('board');
}

function isMobileView() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function applyCamera() {
    const layer = getCameraLayer();
    if (!layer) return;
    layer.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

    if (selectedDomino && document.querySelectorAll('.placement-zone').length > 0) {
        updateZoneHintArrows();
    }
}

function boardToScreen(boardX, boardY) {
    const container = getBoardContainer();
    const board = getBoardElement();
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    const layerX = centerX - board.offsetWidth / 2 + boardX;
    const layerY = centerY - board.offsetHeight / 2 + boardY;

    return {
        x: centerX + camera.x + (layerX - centerX) * camera.zoom,
        y: centerY + camera.y + (layerY - centerY) * camera.zoom
    };
}

function isZoneVisible(x, y, width, height, margin = 12) {
    const container = getBoardContainer();
    const corners = [
        boardToScreen(x, y),
        boardToScreen(x + width, y),
        boardToScreen(x, y + height),
        boardToScreen(x + width, y + height)
    ];
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    return corners.some(corner =>
        corner.x >= margin &&
        corner.x <= cw - margin &&
        corner.y >= margin &&
        corner.y <= ch - margin
    );
}

function clearZoneHintArrows() {
    const arrows = document.getElementById('zoneHintArrows');
    if (arrows) arrows.innerHTML = '';
}

function updateZoneHintArrows() {
    clearZoneHintArrows();
    if (!isMobileView() || !selectedDomino) return;

    const container = getBoardContainer();
    const arrowsContainer = document.getElementById('zoneHintArrows');
    if (!container || !arrowsContainer) return;

    const zones = document.querySelectorAll('.placement-zone');
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const edgePadding = 28;

    zones.forEach(zone => {
        const x = parseFloat(zone.style.left);
        const y = parseFloat(zone.style.top);
        const width = parseFloat(zone.style.width);
        const height = parseFloat(zone.style.height);

        if (isZoneVisible(x, y, width, height)) return;

        const center = boardToScreen(x + width / 2, y + height / 2);
        const containerCenterX = cw / 2;
        const containerCenterY = ch / 2;
        const dx = center.x - containerCenterX;
        const dy = center.y - containerCenterY;

        let arrowX;
        let arrowY;
        let rotation;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                arrowX = cw - edgePadding;
                arrowY = Math.max(edgePadding, Math.min(ch - edgePadding, center.y));
                rotation = 0;
            } else {
                arrowX = edgePadding;
                arrowY = Math.max(edgePadding, Math.min(ch - edgePadding, center.y));
                rotation = 180;
            }
        } else if (dy > 0) {
            arrowX = Math.max(edgePadding, Math.min(cw - edgePadding, center.x));
            arrowY = ch - edgePadding;
            rotation = 90;
        } else {
            arrowX = Math.max(edgePadding, Math.min(cw - edgePadding, center.x));
            arrowY = edgePadding;
            rotation = -90;
        }

        const arrow = document.createElement('div');
        arrow.className = 'zone-hint-arrow';
        arrow.style.left = arrowX + 'px';
        arrow.style.top = arrowY + 'px';
        arrow.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        arrowsContainer.appendChild(arrow);
    });
}

function animateCameraTo(targetX, targetY, targetZoom, duration = 500) {
    stopMomentum();
    if (cameraAnimationFrame) {
        cancelAnimationFrame(cameraAnimationFrame);
        cameraAnimationFrame = null;
    }

    const start = { ...camera };
    const startTime = performance.now();
    cameraAnimating = true;

    function step(now) {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.x = start.x + (targetX - start.x) * eased;
        camera.y = start.y + (targetY - start.y) * eased;
        camera.zoom = start.zoom + (targetZoom - start.zoom) * eased;
        applyCamera();

        if (progress < 1) {
            cameraAnimationFrame = requestAnimationFrame(step);
        } else {
            cameraAnimating = false;
            cameraAnimationFrame = null;
        }
    }

    cameraAnimationFrame = requestAnimationFrame(step);
}

function focusOnBoardPoint(boardX, boardY, boardWidth, boardHeight, zoom = FOCUS_ZOOM) {
    const container = getBoardContainer();
    const board = getBoardElement();
    if (!container || !board) return;

    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    const dominoCenterX = centerX - board.offsetWidth / 2 + boardX + boardWidth / 2;
    const dominoCenterY = centerY - board.offsetHeight / 2 + boardY + boardHeight / 2;
    const targetX = -(dominoCenterX - centerX) * zoom;
    const targetY = -(dominoCenterY - centerY) * zoom;

    animateCameraTo(targetX, targetY, zoom);
}

function stopMomentum() {
    if (momentumFrame) {
        cancelAnimationFrame(momentumFrame);
        momentumFrame = null;
    }
}

function applyMomentum() {
    const friction = 0.9;
    const minVelocity = 0.4;

    function tick() {
        if (Math.abs(lastPanVelocity.x) < minVelocity && Math.abs(lastPanVelocity.y) < minVelocity) {
            momentumFrame = null;
            return;
        }

        camera.x += lastPanVelocity.x;
        camera.y += lastPanVelocity.y;
        lastPanVelocity.x *= friction;
        lastPanVelocity.y *= friction;
        applyCamera();
        momentumFrame = requestAnimationFrame(tick);
    }

    momentumFrame = requestAnimationFrame(tick);
}

function setupTouchScrolling() {
    const container = getBoardContainer();
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    function shouldIgnorePan(target) {
        return target.closest('.placement-zone') || target.closest('.rack');
    }

    function startPan(clientX, clientY) {
        if (cameraAnimating) return;
        stopMomentum();
        isPanning = true;
        lastX = clientX;
        lastY = clientY;
        lastPanVelocity = { x: 0, y: 0 };
        container.classList.add('is-panning');
    }

    function movePan(clientX, clientY) {
        if (!isPanning) return;

        const dx = clientX - lastX;
        const dy = clientY - lastY;
        camera.x += dx;
        camera.y += dy;
        lastPanVelocity = { x: dx, y: dy };
        lastX = clientX;
        lastY = clientY;
        applyCamera();
    }

    function endPan() {
        if (!isPanning) return;
        isPanning = false;
        container.classList.remove('is-panning');

        if (isMobileView()) {
            applyMomentum();
        }
    }

    container.addEventListener('mousedown', (e) => {
        if (shouldIgnorePan(e.target)) return;
        e.preventDefault();
        startPan(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        movePan(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', endPan);

    container.addEventListener('touchstart', (e) => {
        if (shouldIgnorePan(e.target)) return;
        if (e.touches.length !== 1) return;
        startPan(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!isPanning || e.touches.length !== 1) return;
        e.preventDefault();
        movePan(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    container.addEventListener('touchend', endPan);
    container.addEventListener('touchcancel', endPan);
}

function centerCameraOnBoard() {
    stopMomentum();
    if (cameraAnimationFrame) {
        cancelAnimationFrame(cameraAnimationFrame);
        cameraAnimationFrame = null;
    }
    cameraAnimating = false;
    camera = { x: 0, y: 0, zoom: 1 };
    requestAnimationFrame(() => applyCamera());
}

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

function playDominoSound() {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.log('Error playing sound:', e);
    }
}

function playSelectSound() {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.08);
    } catch (e) {
        console.log('Error playing sound:', e);
    }
}

document.addEventListener('DOMContentLoaded', init);
