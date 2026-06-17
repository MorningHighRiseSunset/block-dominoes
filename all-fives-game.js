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

function init() {
    createDominoSet();
    spawnCenterDomino();
    dealDominoes();
    renderRacks();
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

function spawnCenterDomino() {
    const doubles = [0, 1, 2, 3, 4, 5, 6];
    const randomDouble = doubles[Math.floor(Math.random() * doubles.length)];
    const centerDomino = { top: randomDouble, bottom: randomDouble, id: `center-${randomDouble}` };
    
    const board = document.getElementById('board');
    const boardRect = board.getBoundingClientRect();
    
    // Store board dimensions once
    boardDimensions.width = boardRect.width;
    boardDimensions.height = boardRect.height;
    
    const centerX = (boardDimensions.width - 50) / 2;
    const centerY = (boardDimensions.height - 100) / 2;
    
    const dominoEl = createDominoElement(centerDomino, false);
    dominoEl.style.left = centerX + 'px';
    dominoEl.style.top = centerY + 'px';
    dominoEl.classList.add('center-domino');
    
    board.appendChild(dominoEl);
    
    boardDominoes.push({
        domino: centerDomino,
        x: centerX,
        y: centerY,
        isHorizontal: false,
        element: dominoEl
    });
    
    // Set board ends (all 4 directions for turning chain)
    boardEnds.left = centerDomino.top;
    boardEnds.right = centerDomino.bottom;
    boardEnds.top = centerDomino.top;
    boardEnds.bottom = centerDomino.bottom;
    
    // Set initial end positions
    endPositions.left = { x: centerX, y: centerY, isHorizontal: false };
    endPositions.right = { x: centerX, y: centerY, isHorizontal: false };
    endPositions.top = { x: centerX, y: centerY, isHorizontal: false };
    endPositions.bottom = { x: centerX, y: centerY, isHorizontal: false };
    
    showPlacementZones(centerDomino, centerX, centerY, false);
}

function dealDominoes() {
    const allDominoes = createDominoSet();
    
    const doubles = allDominoes.filter(d => d.top === d.bottom);
    const nonDoubles = allDominoes.filter(d => d.top !== d.bottom);
    
    shuffle(doubles);
    shuffle(nonDoubles);
    
    playerDominoes = [...doubles.slice(0, 2), ...nonDoubles.slice(0, 5)];
    cpuDominoes = [...doubles.slice(2, 4), ...nonDoubles.slice(5, 10)];
    
    // Remaining dominoes go to boneyard
    boneyard = [...doubles.slice(4), ...nonDoubles.slice(10)];
    
    shuffle(playerDominoes);
    shuffle(cpuDominoes);
    shuffle(boneyard);
    
    updateBoneyardCount();
    
    // Setup draw button
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
    const cpuRack = document.getElementById('cpuRack');
    
    playerRack.innerHTML = '';
    cpuRack.innerHTML = '';
    
    playerDominoes.forEach(domino => {
        const el = createDominoElement(domino, false);
        el.addEventListener('click', () => selectDomino(domino, el));
        playerRack.appendChild(el);
    });
    
    cpuDominoes.forEach(domino => {
        const el = createDominoElement(domino, false);
        cpuRack.appendChild(el);
    });
}

function selectDomino(domino, element) {
    if (!isPlayerTurn) return;
    
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedDomino = domino;
    
    // Show valid placement zones (use requestAnimationFrame to prevent layout thrashing)
    requestAnimationFrame(() => {
        if (!isShowingZones) {
            isShowingZones = true;
            showValidPlacementZones(domino);
            isShowingZones = false;
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
    checkPlayerValidMoves();
}

function checkPlayerValidMoves() {
    const hasValidMove = playerDominoes.some(domino => {
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

function showPlacementZones(centerDomino, centerX, centerY, isHorizontal) {
    const board = document.getElementById('board');
    
    // Center domino is vertical (50x100)
    // Calculate center point: centerX + 25, centerY + 50
    const dominoCenterX = centerX + 25;
    const dominoCenterY = centerY + 50;
    
    // All 4 zones for turning chain
    const zones = [
        { side: 'left', x: centerX - 100, y: dominoCenterY - 25, width: 100, height: 50 },
        { side: 'right', x: centerX + 50, y: dominoCenterY - 25, width: 100, height: 50 },
        { side: 'top', x: dominoCenterX - 25, y: centerY - 100, width: 50, height: 100 },
        { side: 'bottom', x: dominoCenterX - 25, y: centerY + 100, width: 50, height: 100 }
    ];
    
    zones.forEach(zone => {
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
                placeDomino(selectedDomino, zone.side, zone.x, zone.y, zone.side === 'left' || zone.side === 'right');
            }
        });
        
        board.appendChild(zoneEl);
    });
}

function showValidPlacementZones(domino) {
    const board = document.getElementById('board');
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    
    const validZones = [];
    
    // Check left - use stored left end position
    if (boardEnds.left !== null && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) {
        const leftPos = endPositions.left;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = leftPos.x + (leftPos.isHorizontal ? 50 : 25);
        const dominoCenterY = leftPos.y + (leftPos.isHorizontal ? 25 : 50);
        
        // Check if we need to turn (if horizontal placement would go off left edge)
        if (leftPos.x - 100 < 0) {
            // Turn: place vertically below
            validZones.push({ side: 'left', x: dominoCenterX - 25, y: leftPos.y + (leftPos.isHorizontal ? 50 : 100), width: 50, height: 100, horizontal: false });
        } else {
            // Normal horizontal placement
            validZones.push({ side: 'left', x: leftPos.x - 100, y: dominoCenterY - 25, width: 100, height: 50, horizontal: true });
        }
    }
    
    // Check right - use stored right end position
    if (boardEnds.right !== null && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) {
        const rightPos = endPositions.right;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = rightPos.x + (rightPos.isHorizontal ? 50 : 25);
        const dominoCenterY = rightPos.y + (rightPos.isHorizontal ? 25 : 50);
        const xOffset = rightPos.isHorizontal ? 100 : 50;
        
        // Check if we need to turn (if horizontal placement would go off right edge)
        if (rightPos.x + xOffset > boardDimensions.width) {
            // Turn: place vertically below
            validZones.push({ side: 'right', x: dominoCenterX - 25, y: rightPos.y + (rightPos.isHorizontal ? 50 : 100), width: 50, height: 100, horizontal: false });
        } else {
            // Normal horizontal placement
            validZones.push({ side: 'right', x: rightPos.x + xOffset, y: dominoCenterY - 25, width: 100, height: 50, horizontal: true });
        }
    }
    
    // Check top - use stored top end position
    if (boardEnds.top !== null && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) {
        const topPos = endPositions.top;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = topPos.x + (topPos.isHorizontal ? 50 : 25);
        const dominoCenterY = topPos.y + (topPos.isHorizontal ? 25 : 50);
        
        // Check if we need to turn (if vertical placement would go off top edge)
        if (topPos.y - 100 < 0) {
            // Turn: place horizontally to the right
            validZones.push({ side: 'top', x: topPos.x + (topPos.isHorizontal ? 100 : 50), y: dominoCenterY - 25, width: 100, height: 50, horizontal: true });
        } else {
            // Normal vertical placement
            validZones.push({ side: 'top', x: dominoCenterX - 25, y: topPos.y - 100, width: 50, height: 100, horizontal: false });
        }
    }
    
    // Check bottom - use stored bottom end position
    if (boardEnds.bottom !== null && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom)) {
        const bottomPos = endPositions.bottom;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = bottomPos.x + (bottomPos.isHorizontal ? 50 : 25);
        const dominoCenterY = bottomPos.y + (bottomPos.isHorizontal ? 25 : 50);
        const yOffset = bottomPos.isHorizontal ? 50 : 100;
        
        // Check if we need to turn (if vertical placement would go off bottom edge)
        if (bottomPos.y + yOffset > boardDimensions.height) {
            // Turn: place horizontally to the right
            validZones.push({ side: 'bottom', x: bottomPos.x + (bottomPos.isHorizontal ? 100 : 50), y: dominoCenterY - 25, width: 100, height: 50, horizontal: true });
        } else {
            // Normal vertical placement
            validZones.push({ side: 'bottom', x: dominoCenterX - 25, y: bottomPos.y + yOffset, width: 50, height: 100, horizontal: false });
        }
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
        checkPlayerValidMoves();
    }
}

function placeDomino(domino, side, x, y, isHorizontal) {
    const board = document.getElementById('board');
    
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    
    // Orient domino correctly so matching numbers touch
    let orientedDomino = { ...domino };
    const matchingEnd = boardEnds[side];
    
    if (isHorizontal) {
        // For horizontal placement (left/right)
        if (side === 'left') {
            // Placing on left: right side of domino touches center
            // So matching number should be bottom (right side in horizontal)
            if (domino.top === matchingEnd) {
                // Need to flip so matching is on right (bottom)
                orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
            }
        } else if (side === 'right') {
            // Placing on right: left side of domino touches center
            // So matching number should be top (left side in horizontal)
            if (domino.bottom === matchingEnd) {
                // Need to flip so matching is on left (top)
                orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
            }
        }
    } else {
        // For vertical placement (top/bottom)
        if (side === 'top') {
            // Placing on top: bottom side of domino touches center
            // So matching number should be bottom
            if (domino.top === matchingEnd) {
                // Need to flip so matching is on bottom
                orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
            }
        } else if (side === 'bottom') {
            // Placing on bottom: top side of domino touches center
            // So matching number should be top
            if (domino.bottom === matchingEnd) {
                // Need to flip so matching is on top
                orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
            }
        }
    }
    
    const dominoEl = createDominoElement(orientedDomino, isHorizontal);
    dominoEl.style.left = x + 'px';
    dominoEl.style.top = y + 'px';
    
    board.appendChild(dominoEl);
    
    boardDominoes.push({
        domino: orientedDomino,
        x: x,
        y: y,
        isHorizontal: isHorizontal,
        element: dominoEl
    });
    
    // Update board ends to the NEW exposed number (all 4 directions)
    if (side === 'left') {
        boardEnds.left = orientedDomino.top;
        endPositions.left = { x: x, y: y, isHorizontal: isHorizontal };
    } else if (side === 'right') {
        boardEnds.right = orientedDomino.bottom;
        endPositions.right = { x: x, y: y, isHorizontal: isHorizontal };
    } else if (side === 'top') {
        boardEnds.top = orientedDomino.top;
        endPositions.top = { x: x, y: y, isHorizontal: isHorizontal };
    } else if (side === 'bottom') {
        boardEnds.bottom = orientedDomino.bottom;
        endPositions.bottom = { x: x, y: y, isHorizontal: isHorizontal };
    }
    
    if (isPlayerTurn) {
        playerDominoes = playerDominoes.filter(d => d.id !== domino.id);
    } else {
        cpuDominoes = cpuDominoes.filter(d => d.id !== domino.id);
    }
    
    renderRacks();
    selectedDomino = null;
    
    isPlayerTurn = !isPlayerTurn;
    
    updateBoneyardCount();
    
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
    
    // Find valid moves for CPU using actual end positions (all 4 directions with turning)
    let validMoves = [];
    
    cpuDominoes.forEach(domino => {
        // Check left - use actual left end position
        if (boardEnds.left !== null && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) {
            const leftPos = endPositions.left;
            const dominoCenterX = leftPos.x + (leftPos.isHorizontal ? 50 : 25);
            const dominoCenterY = leftPos.y + (leftPos.isHorizontal ? 25 : 50);
            
            // Check if we need to turn
            if (leftPos.x - 100 < 0) {
                // Turn: place vertically below
                validMoves.push({ domino, side: 'left', x: dominoCenterX - 25, y: leftPos.y + (leftPos.isHorizontal ? 50 : 100), horizontal: false });
            } else {
                // Normal horizontal placement
                validMoves.push({ domino, side: 'left', x: leftPos.x - 100, y: dominoCenterY - 25, horizontal: true });
            }
        }
        
        // Check right - use actual right end position
        if (boardEnds.right !== null && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) {
            const rightPos = endPositions.right;
            const dominoCenterX = rightPos.x + (rightPos.isHorizontal ? 50 : 25);
            const dominoCenterY = rightPos.y + (rightPos.isHorizontal ? 25 : 50);
            const xOffset = rightPos.isHorizontal ? 100 : 50;
            
            // Check if we need to turn
            if (rightPos.x + xOffset > boardDimensions.width) {
                // Turn: place vertically below
                validMoves.push({ domino, side: 'right', x: dominoCenterX - 25, y: rightPos.y + (rightPos.isHorizontal ? 50 : 100), horizontal: false });
            } else {
                // Normal horizontal placement
                validMoves.push({ domino, side: 'right', x: rightPos.x + xOffset, y: dominoCenterY - 25, horizontal: true });
            }
        }
        
        // Check top - use actual top end position
        if (boardEnds.top !== null && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) {
            const topPos = endPositions.top;
            const dominoCenterX = topPos.x + (topPos.isHorizontal ? 50 : 25);
            const dominoCenterY = topPos.y + (topPos.isHorizontal ? 25 : 50);
            
            // Check if we need to turn
            if (topPos.y - 100 < 0) {
                // Turn: place horizontally to the right
                validMoves.push({ domino, side: 'top', x: topPos.x + (topPos.isHorizontal ? 100 : 50), y: dominoCenterY - 25, horizontal: true });
            } else {
                // Normal vertical placement
                validMoves.push({ domino, side: 'top', x: dominoCenterX - 25, y: topPos.y - 100, horizontal: false });
            }
        }
        
        // Check bottom - use actual bottom end position
        if (boardEnds.bottom !== null && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom)) {
            const bottomPos = endPositions.bottom;
            const dominoCenterX = bottomPos.x + (bottomPos.isHorizontal ? 50 : 25);
            const dominoCenterY = bottomPos.y + (bottomPos.isHorizontal ? 25 : 50);
            const yOffset = bottomPos.isHorizontal ? 50 : 100;
            
            // Check if we need to turn
            if (bottomPos.y + yOffset > boardDimensions.height) {
                // Turn: place horizontally to the right
                validMoves.push({ domino, side: 'bottom', x: bottomPos.x + (bottomPos.isHorizontal ? 100 : 50), y: dominoCenterY - 25, horizontal: true });
            } else {
                // Normal vertical placement
                validMoves.push({ domino, side: 'bottom', x: dominoCenterX - 25, y: bottomPos.y + yOffset, horizontal: false });
            }
        }
    });
    
    if (validMoves.length > 0) {
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        placeDomino(randomMove.domino, randomMove.side, randomMove.x, randomMove.y, randomMove.horizontal);
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

document.addEventListener('DOMContentLoaded', init);
