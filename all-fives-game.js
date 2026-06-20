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

function init() {
    createDominoSet();
    spawnCenterDomino();
    dealDominoes();
    renderRacks();
    updateScores();
    setupTouchScrolling();
    initAudio();
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

function expandBoardIfNeeded(x, y, isHorizontal) {
    const board = document.getElementById('board');
    const dominoWidth = isHorizontal ? 100 : 50;
    const dominoHeight = isHorizontal ? 50 : 100;
    const dominoRight = x + dominoWidth;
    const dominoBottom = y + dominoHeight;
    
    const currentWidth = board.offsetWidth;
    const currentHeight = board.offsetHeight;
    
    let needsUpdate = false;
    let newWidth = currentWidth;
    let newHeight = currentHeight;
    
    // Expand right if needed
    if (dominoRight > currentWidth) {
        newWidth = dominoRight + 500;
        needsUpdate = true;
    }
    
    // Expand bottom if needed
    if (dominoBottom > currentHeight) {
        newHeight = dominoBottom + 500;
        needsUpdate = true;
    }
    
    // Expand left if needed (shift all dominoes right)
    if (x < 0) {
        const shiftAmount = Math.abs(x) + 500;
        newWidth = currentWidth + shiftAmount;
        // Shift all existing dominoes
        boardDominoes.forEach(placed => {
            placed.x += shiftAmount;
            placed.element.style.left = placed.x + 'px';
        });
        // Update end positions
        if (endPositions.left) endPositions.left.x += shiftAmount;
        if (endPositions.right) endPositions.right.x += shiftAmount;
        if (endPositions.top) endPositions.top.x += shiftAmount;
        if (endPositions.bottom) endPositions.bottom.x += shiftAmount;
        needsUpdate = true;
    }
    
    // Expand top if needed (shift all dominoes down)
    if (y < 0) {
        const shiftAmount = Math.abs(y) + 500;
        newHeight = currentHeight + shiftAmount;
        // Shift all existing dominoes
        boardDominoes.forEach(placed => {
            placed.y += shiftAmount;
            placed.element.style.top = placed.y + 'px';
        });
        // Update end positions
        if (endPositions.left) endPositions.left.y += shiftAmount;
        if (endPositions.right) endPositions.right.y += shiftAmount;
        if (endPositions.top) endPositions.top.y += shiftAmount;
        if (endPositions.bottom) endPositions.bottom.y += shiftAmount;
        needsUpdate = true;
    }
    
    // Apply new dimensions
    if (needsUpdate) {
        board.style.width = newWidth + 'px';
        board.style.height = newHeight + 'px';
        boardDimensions.width = newWidth;
        boardDimensions.height = newHeight;
    }
    
    return needsUpdate;
}

function spawnCenterDomino() {
    const doubles = [0, 1, 2, 3, 4, 5, 6];
    const randomDouble = doubles[Math.floor(Math.random() * doubles.length)];
    const centerDomino = { top: randomDouble, bottom: randomDouble, id: `center-${randomDouble}` };
    
    const board = document.getElementById('board');
    
    // Board is now 2000x2000, center is at 1000, 1000
    boardDimensions.width = 2000;
    boardDimensions.height = 2000;
    
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
    
    playerRack.innerHTML = '';
    
    playerDominoes.forEach(domino => {
        const el = createDominoElement(domino, false);
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

function updateDrawButton() {
    const drawBtn = document.getElementById('drawBtn');
    if (!isPlayerTurn) {
        drawBtn.disabled = true;
        return;
    }
    
    const hasValidMove = playerDominoes.some(domino => {
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

function showPlacementZones(centerDomino, centerX, centerY, isHorizontal) {
    const board = document.getElementById('board');
    
    // Center domino is vertical (50x100)
    // Calculate center point: centerX + 25, centerY + 50
    const dominoCenterX = centerX + 25;
    const dominoCenterY = centerY + 50;
    
    // Check if selected domino is a double
    const isDouble = selectedDomino && selectedDomino.top === selectedDomino.bottom;
    
    // All 4 zones for turning chain
    let zones;
    if (isDouble) {
        // Doubles should be placed perpendicular to chain direction
        zones = [
            { side: 'left', x: centerX - 50, y: dominoCenterY - 50, width: 50, height: 100, horizontal: false },
            { side: 'right', x: centerX + 50, y: dominoCenterY - 50, width: 50, height: 100, horizontal: false },
            { side: 'top', x: dominoCenterX - 50, y: centerY - 50, width: 100, height: 50, horizontal: true },
            { side: 'bottom', x: dominoCenterX - 50, y: centerY + 50, width: 100, height: 50, horizontal: true }
        ];
    } else {
        // Non-doubles placed normally
        zones = [
            { side: 'left', x: centerX - 100, y: dominoCenterY - 25, width: 100, height: 50, horizontal: true },
            { side: 'right', x: centerX + 50, y: dominoCenterY - 25, width: 100, height: 50, horizontal: true },
            { side: 'top', x: dominoCenterX - 25, y: centerY - 100, width: 50, height: 100, horizontal: false },
            { side: 'bottom', x: dominoCenterX - 25, y: centerY + 100, width: 50, height: 100, horizontal: false }
        ];
    }
    
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
                placeDomino(selectedDomino, zone.side, zone.x, zone.y, zone.horizontal);
            }
        });
        
        board.appendChild(zoneEl);
    });
}

function showValidPlacementZones(domino) {
    const board = document.getElementById('board');
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    
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
    }
}

function placeDomino(domino, side, x, y, isHorizontal) {
    const boardEl = document.getElementById('board');
    
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    
    // Expand board if needed before placing domino
    expandBoardIfNeeded(x, y, isHorizontal);
    
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
    // Store the actual end position where the next domino would attach
    if (side === 'left') {
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
    
    // Disable auto-scroll to prevent camera jumping
    // The board is large enough that manual scrolling is preferred
    
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

function setupTouchScrolling() {
    const boardContainer = document.querySelector('.board-container');
    let isDown = false;
    let startX;
    let startY;
    let scrollLeft;
    let scrollTop;

    // Mouse events for desktop
    boardContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - boardContainer.offsetLeft;
        startY = e.pageY - boardContainer.offsetTop;
        scrollLeft = boardContainer.scrollLeft;
        scrollTop = boardContainer.scrollTop;
        boardContainer.style.cursor = 'grabbing';
    });

    boardContainer.addEventListener('mouseleave', () => {
        isDown = false;
        boardContainer.style.cursor = 'grab';
    });

    boardContainer.addEventListener('mouseup', () => {
        isDown = false;
        boardContainer.style.cursor = 'grab';
    });

    boardContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - boardContainer.offsetLeft;
        const y = e.pageY - boardContainer.offsetTop;
        const walkX = (x - startX) * 2.5;
        const walkY = (y - startY) * 2.5;
        boardContainer.scrollLeft = scrollLeft - walkX;
        boardContainer.scrollTop = scrollTop - walkY;
    });

    // Touch events for mobile with improved sensitivity
    boardContainer.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - boardContainer.offsetLeft;
        startY = e.touches[0].pageY - boardContainer.offsetTop;
        scrollLeft = boardContainer.scrollLeft;
        scrollTop = boardContainer.scrollTop;
    }, { passive: false });

    boardContainer.addEventListener('touchend', () => {
        isDown = false;
    });

    boardContainer.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.touches[0].pageX - boardContainer.offsetLeft;
        const y = e.touches[0].pageY - boardContainer.offsetTop;
        const walkX = (x - startX) * 2.5;
        const walkY = (y - startY) * 2.5;
        boardContainer.scrollLeft = scrollLeft - walkX;
        boardContainer.scrollTop = scrollTop - walkY;
    }, { passive: false });
}

function scrollToDomino(x, y) {
    const boardContainer = document.querySelector('.board-container');
    const boardElement = document.getElementById('board');
    const containerWidth = boardContainer.clientWidth;
    const containerHeight = boardContainer.clientHeight;
    
    // Calculate the scroll position to center the domino
    // Account for the board being centered with CSS transform
    const boardLeft = (boardContainer.scrollWidth - boardElement.offsetWidth) / 2;
    const boardTop = (boardContainer.scrollHeight - boardElement.offsetHeight) / 2;
    
    const scrollLeft = boardLeft + x - containerWidth / 2 + 25;
    const scrollTop = boardTop + y - containerHeight / 2 + 50;
    
    // Smooth scroll to the position
    boardContainer.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: 'smooth'
    });
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
