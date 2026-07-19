let playerDominoes = [];
let cpuDominoes = [];
let boardDominoes = [];
let boneyard = [];
let selectedDomino = null;
let isPlayerTurn = true;
let boardEnds = { left: null, right: null };
let endPositions = { left: null, right: null };
let endDominoRefs = { left: null, right: null };
let endIsDouble = { left: false, right: false };
let boardDimensions = { width: 0, height: 0 };
let isShowingZones = false;
let audioContext = null;
let camera = { x: 0, y: 0, zoom: 1 };
let cameraAnimating = false;
let cameraAnimationFrame = null;
let momentumFrame = null;
let lastPanVelocity = { x: 0, y: 0 };
const FOCUS_ZOOM = 1;
const MOBILE_FOCUS_ZOOM = 1;
const BOARD_EDGE_MARGIN = 150;
let startingDomino = null;
let gameOver = false;
let passesInRow = 0;
let hintIndex = 0;
let hintTimeout = null;
let lastPlayedSide = null;

const GAME_HINTS = [
    'Edge arrows point to off-screen moves',
    'Drag the board to look around',
    'Highest double starts — play it in the center',
    'Tap a tile, then tap a highlighted spot to play',
    'Empty your hand first to win the round'
];

function getDominoDimensions(isHorizontal) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        return {
            width: isHorizontal ? 120 : 60,
            height: isHorizontal ? 60 : 120
        };
    }
    return {
        width: isHorizontal ? 100 : 50,
        height: isHorizontal ? 50 : 100
    };
}

function init() {
    initializeBoard();
    dealDominoes();
    const starter = findStarter(playerDominoes, cpuDominoes);
    startingDomino = starter.domino;
    isPlayerTurn = starter.owner === 'player';
    renderRacks();
    setupTouchScrolling();
    initAudio();
    document.getElementById('drawBtn').addEventListener('click', drawFromBoneyard);
    // Delay camera centering to ensure board dimensions are available
    console.log('Setting timeout for centerCameraOnBoard');
    setTimeout(() => {
        console.log('Timeout fired, calling centerCameraOnBoard');
        centerCameraOnBoard();
    }, 100);
    handlePlayerTurnStart();
    setupHintSystem();
    document.getElementById('playAgainBtn').addEventListener('click', () => location.reload());
    document.getElementById('closeGameOverBtn').addEventListener('click', () => {
        document.getElementById('gameOverOverlay').classList.add('hidden');
        document.getElementById('newGameMiniBtn').classList.remove('hidden');
    });
    document.getElementById('newGameMiniBtn').addEventListener('click', () => location.reload());

    if (!isPlayerTurn) {
        setTimeout(cpuPlay, 1500);
    }
}

function createDominoSet() {
    const dominoes = [];
    let dominoIndex = 0;
    for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) {
            dominoes.push({ top: i, bottom: j, id: `${i}-${j}-${dominoIndex++}` });
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
    boardEnds = { left: null, right: null };
    endPositions = { left: null, right: null };
    endDominoRefs = { left: null, right: null };
    endIsDouble = { left: false, right: false };
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
    const dims = getDominoDimensions(!isDouble);
    const x = (boardDimensions.width - dims.width) / 2;
    const y = (boardDimensions.height - dims.height) / 2;

    return {
        side: 'center',
        x,
        y,
        width: dims.width,
        height: dims.height,
        horizontal: !isDouble
    };
}

function showDebugOverlay(text) {
    let overlay = document.getElementById('debugOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'debugOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            font-size: 12px;
            font-family: monospace;
            z-index: 9999;
            pointer-events: none;
            max-width: 300px;
        `;
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = text;
}


function shiftBoardContent(shiftX, shiftY) {
    if (!shiftX && !shiftY) return;

    boardDominoes.forEach(placed => {
        placed.x += shiftX;
        placed.y += shiftY;
        placed.element.style.left = placed.x + 'px';
        placed.element.style.top = placed.y + 'px';
    });

    ['left', 'right'].forEach(side => {
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
    if (!shiftX && !shiftY) return camera.x -= shiftX * camera.zoom;
    camera.y -= shiftY * camera.zoom;
    applyCamera();
}

function ensureBoardBounds(minX, minY, maxX, maxY, adjustCamera = true) {
    const board = getBoardElement();
    if (!board) return { shiftX: 0, shiftY: 0 };

    let shiftX = 0;
    let shiftY = 0;
    let width = board.offsetWidth;
    let height = board.offsetHeight;
    let needsUpdate = false;

    if (adjustCamera) {
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

    return { shiftX, shiftY };
}

function getBoardContentBounds() {
    if (boardDominoes.length === 0) {
        return null;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    boardDominoes.forEach(placed => {
        const dims = getDominoDimensions(placed.isHorizontal);
        const placedWidth = dims.width;
        const placedHeight = dims.height;
        minX = Math.min(minX, placed.x);
        minY = Math.min(minY, placed.y);
        maxX = Math.max(maxX, placed.x + placedWidth);
        maxY = Math.max(maxY, placed.y + placedHeight);
    });

    return { minX, minY, maxX, maxY };
}

function resizeBoardIfNeeded() {
    const bounds = getBoardContentBounds();
    if (!bounds) return;

    ensureBoardBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, true);
}

function dealDominoes() {
    const allDominoes = createDominoSet();
    shuffle(allDominoes);

    playerDominoes = allDominoes.slice(0, 7);
    cpuDominoes = allDominoes.slice(7, 14);
    boneyard = allDominoes.slice(14);

    updateBoneyardCount();
}

function updateBoneyardCount() {
    const countEl = document.getElementById('boneyardCount');
    if (countEl) countEl.textContent = boneyard.length;
}

function drawFromBoneyard() {
    if (!isPlayerTurn || boneyard.length === 0 || gameOver) return;

    const drawnDomino = boneyard.pop();
    playerDominoes.push(drawnDomino);
    updateBoneyardCount();
    renderRacks();
    updateDrawButton();
    showToast(`Drew ${formatDominoLabel(drawnDomino)}`);
}

function updateDrawButton() {
    const drawBtn = document.getElementById('drawBtn');
    if (!isPlayerTurn || gameOver) {
        drawBtn.disabled = true;
        return;
    }

    const hasValidMove = hasAnyValidMove(playerDominoes);
    drawBtn.disabled = hasValidMove || boneyard.length === 0;
}

function createDominoElement(domino, isHorizontal, owner) {
    const dominoEl = document.createElement('div');
    dominoEl.className = 'domino' + (isHorizontal ? ' horizontal' : '') + (owner === 'player' ? ' player-domino' : owner === 'cpu' ? ' cpu-domino' : '');

    if (isHorizontal) {
        dominoEl.classList.add('horizontal');
    }

    const topHalf = document.createElement('div');
    topHalf.className = 'domino-half';
    topHalf.appendChild(createPips(domino.top));

    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'domino-half';
    bottomHalf.appendChild(createPips(domino.bottom));

    dominoEl.appendChild(topHalf);
    dominoEl.appendChild(bottomHalf);

    return dominoEl;
}

function createPips(value) {
    const pipsContainer = document.createElement('div');
    pipsContainer.className = 'pips';
    pipsContainer.dataset.value = String(value);

    const pipPositions = {
        0: [],
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };

    const positions = pipPositions[value] || [];
    for (let i = 0; i < 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        if (positions.includes(i)) {
            pip.style.visibility = 'visible';
        } else {
            pip.style.visibility = 'hidden';
        }
        pipsContainer.appendChild(pip);
    }

    return pipsContainer;
}

function renderRacks() {
    const playerRack = document.getElementById('playerRack');
    if (!playerRack) return;

    playerRack.innerHTML = '';
    playerDominoes.forEach(domino => {
        const dominoEl = createDominoElement(domino, false, 'player');
        dominoEl.addEventListener('click', () => selectDomino(domino, dominoEl));
        playerRack.appendChild(dominoEl);
    });

    updateRackScrollIndicators();
}

function selectDomino(domino, element) {
    if (!isPlayerTurn || gameOver) return;

    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedDomino = domino;

    const validZones = findValidPlacementsForDomino(domino);
    showPlacementZones(validZones);
}

function showPlacementZones(zones) {
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());

    if (zones.length === 0) {
        showToast('No valid placements for this domino');
        return;
    }

    const board = getBoardElement();
    const expectedCenterX = boardDimensions.width / 2;
    const expectedCenterY = boardDimensions.height / 2;

    zones.forEach(zone => {
        const zoneEl = document.createElement('div');
        zoneEl.className = 'placement-zone';
        zoneEl.style.left = zone.x + 'px';
        zoneEl.style.top = zone.y + 'px';
        zoneEl.style.width = zone.width + 'px';
        zoneEl.style.height = zone.height + 'px';

        const zoneCenterX = zone.x + zone.width / 2;
        const zoneCenterY = zone.y + zone.height / 2;

        showDebugOverlay(`Expected center: ${expectedCenterX}, ${expectedCenterY}<br>Actual zone center: ${zoneCenterX}, ${zoneCenterY}<br>Zone: x=${zone.x}, y=${zone.y}, w=${zone.width}, h=${zone.height}`);

        zoneEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedDomino) {
                placeDomino(selectedDomino, zone.side, zone.x, zone.y, zone.horizontal);
            }
        });

        board.appendChild(zoneEl);
    });

    isShowingZones = true;
    showZoneHintArrows(zones);
}

function clearPlacementZones() {
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    isShowingZones = false;
}

function getEndDominoForSide(side) {
    if (endDominoRefs[side]) {
        return endDominoRefs[side];
    }

    if (boardDominoes.length > 0 && (side === 'left' || side === 'right')) {
        return boardDominoes[0];
    }

    return null;
}

function computePlacementZone(endDomino, side, domino) {
    const isDouble = domino.top === domino.bottom;
    const endDims = getDominoDimensions(endDomino.isHorizontal);
    const endWidth = endDims.width;
    const endHeight = endDims.height;
    const centerY = endDomino.y + endHeight / 2;

    const doubleDims = getDominoDimensions(false);
    const horizontalDims = getDominoDimensions(true);

    if (side === 'left') {
        if (isDouble) {
            return { side: 'left', x: endDomino.x - doubleDims.width, y: centerY - doubleDims.height / 2, width: doubleDims.width, height: doubleDims.height, horizontal: false };
        }
        return { side: 'left', x: endDomino.x - horizontalDims.width, y: centerY - horizontalDims.height / 2, width: horizontalDims.width, height: horizontalDims.height, horizontal: true };
    }

    if (side === 'right') {
        if (isDouble) {
            return { side: 'right', x: endDomino.x + endWidth, y: centerY - doubleDims.height / 2, width: doubleDims.width, height: doubleDims.height, horizontal: false };
        }
        return { side: 'right', x: endDomino.x + endWidth, y: centerY - horizontalDims.height / 2, width: horizontalDims.width, height: horizontalDims.height, horizontal: true };
    }

    return null;
}

function dominoMatchesEnd(domino, endValue) {
    return domino.top === endValue || domino.bottom === endValue;
}

function findValidPlacementsForDomino(domino) {
    if (boardDominoes.length === 0) {
        if (!startingDomino || domino.id !== startingDomino.id) {
            return [];
        }
        const placement = getFirstMovePlacement(domino);
        return [{ side: 'center', x: placement.x, y: placement.y, width: placement.width, height: placement.height, horizontal: placement.horizontal }];
    }

    const validZones = [];

    ['left', 'right'].forEach(side => {
        const matchingEnd = boardEnds[side];
        if (matchingEnd === null || !dominoMatchesEnd(domino, matchingEnd)) {
            return;
        }

        const endDomino = getEndDominoForSide(side);
        if (!endDomino) {
            return;
        }

        const zone = computePlacementZone(endDomino, side, domino);
        if (zone) {
            validZones.push(zone);
        }
    });

    return validZones;
}

function checkZoneOverlap(zoneX, zoneY, zoneWidth, zoneHeight) {
    for (const placed of boardDominoes) {
        const placedDims = getDominoDimensions(placed.isHorizontal);
        const placedWidth = placedDims.width;
        const placedHeight = placedDims.height;
        const placedRight = placed.x + placedWidth;
        const placedBottom = placed.y + placedHeight;
        const zoneRight = zoneX + zoneWidth;
        const zoneBottom = zoneY + zoneHeight;

        if (!(zoneRight <= placed.x ||
              zoneX >= placedRight ||
              zoneBottom <= placed.y ||
              zoneY >= placedBottom)) {
            return true;
        }
    }
    return false;
}

function getMatchingEndForSide(side) {
    return boardEnds[side] || null;
}

function placeDomino(domino, side, x, y, isHorizontal) {
    if (gameOver) return;

    const boardEl = document.getElementById('board');
    const wasPlayerTurn = isPlayerTurn;

    // Remove ghost starting domino if it exists
    const ghostDomino = document.getElementById('ghostStartingDomino');
    if (ghostDomino) {
        ghostDomino.remove();
    }
    
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    
    const dims = getDominoDimensions(isHorizontal);
    const dominoWidth = dims.width;
    const dominoHeight = dims.height;
    const { shiftX, shiftY } = ensureBoardBounds(x, y, x + dominoWidth, y + dominoHeight, true);
    x += shiftX;
    y += shiftY;

    const dominoCenterX = x + dominoWidth / 2;
    const dominoCenterY = y + dominoHeight / 2;
    const expectedCenterX = boardDimensions.width / 2;
    const expectedCenterY = boardDimensions.height / 2;

    showDebugOverlay(`Expected center: ${expectedCenterX}, ${expectedCenterY}<br>Actual domino center: ${dominoCenterX}, ${dominoCenterY}<br>Domino: x=${x}, y=${y}, w=${dominoWidth}, h=${dominoHeight}<br>Shift: ${shiftX}, ${shiftY}`);
    
    for (const placed of boardDominoes) {
        const placedDims = getDominoDimensions(placed.isHorizontal);
        const placedWidth = placedDims.width;
        const placedHeight = placedDims.height;
        const placedRight = placed.x + placedWidth;
        const placedBottom = placed.y + placedHeight;
        const newRight = x + dominoWidth;
        const newBottom = y + dominoHeight;
        
        if (!(newRight <= placed.x || 
              x >= placedRight || 
              newBottom <= placed.y || 
              y >= placedBottom)) {
            console.error('Overlap detected during placement, aborting');
            return;
        }
    }
    
    let orientedDomino = { ...domino };

    if (side === 'center') {
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
        const matchingEnd = getMatchingEndForSide(side);

        if (isHorizontal) {
            if (side === 'left') {
                if (domino.bottom === matchingEnd) {
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.top === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            } else if (side === 'right') {
                if (domino.top === matchingEnd) {
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.bottom === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            }
        }
    }
    
    const dominoEl = createDominoElement(orientedDomino, isHorizontal, wasPlayerTurn ? 'player' : 'cpu');
    dominoEl.style.left = x + 'px';
    dominoEl.style.top = y + 'px';

    boardEl.appendChild(dominoEl);
    playDominoSound();
    
    boardDominoes.push({
        domino: orientedDomino,
        x: x,
        y: y,
        isHorizontal: isHorizontal,
        element: dominoEl
    });

    const placedRef = boardDominoes[boardDominoes.length - 1];
    
    lastPlayedSide = side;
    if (side === 'center') {
        boardEnds.left = orientedDomino.top;
        boardEnds.right = orientedDomino.bottom;
        const spinnerDims = getDominoDimensions(isHorizontal);
        const spinnerWidth = spinnerDims.width;
        endPositions.left = { x, y, isHorizontal };
        endPositions.right = { x: x + spinnerWidth, y, isHorizontal };
        endIsDouble.left = false;
        endIsDouble.right = false;
        endDominoRefs.left = placedRef;
        endDominoRefs.right = placedRef;
    } else if (side === 'left') {
        boardEnds.left = orientedDomino.top;
        const dims = getDominoDimensions(isHorizontal);
        const dominoWidth = dims.width;
        endPositions.left = { x: x, y: y, isHorizontal: isHorizontal };
        endIsDouble.left = (orientedDomino.top === orientedDomino.bottom);
        endDominoRefs.left = placedRef;
    } else if (side === 'right') {
        boardEnds.right = orientedDomino.bottom;
        const dims = getDominoDimensions(isHorizontal);
        const dominoWidth = dims.width;
        endPositions.right = { x: x + dominoWidth, y: y, isHorizontal: isHorizontal };
        endIsDouble.right = (orientedDomino.top === orientedDomino.bottom);
        endDominoRefs.right = placedRef;
    }
    
    if (wasPlayerTurn) {
        playerDominoes = playerDominoes.filter(d => d.id !== domino.id);
    } else {
        cpuDominoes = cpuDominoes.filter(d => d.id !== domino.id);
    }
    
    updateLastPlayedDomino(orientedDomino);
    recordMove();

    checkGameEndAfterMove(wasPlayerTurn);

    if (!gameOver) {
        isPlayerTurn = !isPlayerTurn;
        selectedDomino = null;
        renderRacks();

        // Center camera after placement on mobile
        centerCameraOnBoard();

        if (!isPlayerTurn) {
            setTimeout(cpuPlay, 1000);
        } else {
            handlePlayerTurnStart();
        }
    }
}

function updateLastPlayedDomino(domino) {
    const container = document.getElementById('lastPlayedDomino');
    if (!container) return;

    container.innerHTML = '';
    const topHalf = document.createElement('div');
    topHalf.className = 'last-played-domino-half';
    topHalf.appendChild(createPips(domino.top));
    
    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'last-played-domino-half';
    bottomHalf.appendChild(createPips(domino.bottom));
    
    container.appendChild(topHalf);
    container.appendChild(bottomHalf);
}

function recordMove() {
    passesInRow = 0;
}

function hasAnyValidMove(dominoes) {
    return dominoes.some(domino => findValidPlacementsForDomino(domino).length > 0);
}

function recordPass() {
    passesInRow++;
    if (passesInRow >= 2) {
        endGame('draw', 'Game blocked — no one can play');
    }
}

function checkGameEndAfterMove(wasPlayerTurn) {
    if (gameOver) return;

    if (wasPlayerTurn && playerDominoes.length === 0) {
        // Player gets points equal to CPU's remaining pips
        const playerPoints = countPipsInHand(cpuDominoes);
        const cpuPoints = 0;
        endGame('win', 'You played all your dominoes!', playerPoints, cpuPoints, cpuDominoes);
        return;
    }
    if (!wasPlayerTurn && cpuDominoes.length === 0) {
        // CPU gets points equal to player's remaining pips
        const playerPoints = 0;
        const cpuPoints = countPipsInHand(playerDominoes);
        endGame('lose', 'CPU played all their dominoes.', playerPoints, cpuPoints, playerDominoes);
    }
}

function endGame(result, message, playerPoints = 0, cpuPoints = 0, opponentDominoes = []) {
    if (gameOver) return;
    gameOver = true;

    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    selectedDomino = null;

    const overlay = document.getElementById('gameOverOverlay');
    const title = document.getElementById('gameOverTitle');
    const msg = document.getElementById('gameOverMessage');
    const scores = document.getElementById('gameOverScores');
    const dominoesContainer = document.getElementById('gameOverDominoes');
    const playAgainBtn = document.getElementById('playAgainBtn');

    if (result === 'win') {
        title.textContent = 'You Win!';
        playWinSound();
    } else if (result === 'lose') {
        title.textContent = 'You Lose';
        playLoseSound();
    } else {
        title.textContent = 'Draw';
    }

    msg.textContent = message;

    // Display scores if points were awarded
    if (playerPoints > 0 || cpuPoints > 0) {
        scores.textContent = `Points — You: ${playerPoints}  ·  CPU: ${cpuPoints}`;
    } else {
        scores.textContent = '';
    }

    // Display opponent's remaining dominoes
    if (opponentDominoes.length > 0) {
        dominoesContainer.innerHTML = '';

        // Add label
        const label = document.createElement('div');
        label.textContent = "Opponent's remaining dominoes:";
        label.style.color = '#5c4a3d';
        label.style.fontSize = '0.85rem';
        label.style.fontWeight = 'bold';
        label.style.marginBottom = '8px';
        dominoesContainer.appendChild(label);

        opponentDominoes.forEach(domino => {
            const miniDomino = createMiniDomino(domino);
            dominoesContainer.appendChild(miniDomino);
        });
        dominoesContainer.classList.remove('hidden');
    } else {
        dominoesContainer.innerHTML = '';
        dominoesContainer.classList.add('hidden');
    }

    playAgainBtn.style.display = 'block';
    overlay.classList.remove('hidden');
}

function countPipsInHand(dominoes) {
    return dominoes.reduce((total, domino) => total + domino.top + domino.bottom, 0);
}

function createMiniDomino(domino) {
    const el = document.createElement('div');
    el.className = 'mini-domino';

    const topHalf = document.createElement('div');
    topHalf.className = 'mini-domino-half';
    const topPips = createMiniPipsForGameOver(domino.top);
    topHalf.appendChild(topPips);

    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'mini-domino-half';
    const bottomPips = createMiniPipsForGameOver(domino.bottom);
    bottomHalf.appendChild(bottomPips);

    el.appendChild(topHalf);
    el.appendChild(bottomHalf);

    return el;
}

function createMiniPipsForGameOver(value) {
    const container = document.createElement('div');
    container.className = 'mini-pips';
    container.setAttribute('data-value', value);

    for (let i = 0; i < 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'mini-pip';
        container.appendChild(pip);
    }

    return container;
}

function handlePlayerTurnStart() {
    updateDrawButton();

    // If board is empty and player has the starting domino, don't show "no valid moves"
    if (boardDominoes.length === 0 && startingDomino) {
        const hasStarter = playerDominoes.some(d => d.id === startingDomino.id);
        if (hasStarter) {
            return; // Player can play the starting domino
        }
    }

    if (!hasAnyValidMove(playerDominoes)) {
        if (boneyard.length > 0) {
            showToast('No valid moves. Draw from boneyard.');
        } else {
            showToast('No valid moves. Pass.');
            setTimeout(() => {
                if (!gameOver && isPlayerTurn) {
                    recordPass();
                    if (!gameOver) {
                        isPlayerTurn = false;
                        setTimeout(cpuPlay, 1000);
                    }
                }
            }, 1500);
        }
    }
}

function cpuPlay() {
    if (gameOver) return;

    if (boardDominoes.length === 0) {
        const starterInCpuHand = cpuDominoes.find(d => d.id === startingDomino.id);
        if (starterInCpuHand) {
            const placement = getFirstMovePlacement(starterInCpuHand);
            placeDomino(starterInCpuHand, 'center', placement.x, placement.y, placement.horizontal);
        }
        return;
    }
    
    let validMoves = [];

    cpuDominoes.forEach(domino => {
        findValidPlacementsForDomino(domino).forEach(zone => {
            validMoves.push({ domino, side: zone.side, x: zone.x, y: zone.y, horizontal: zone.horizontal });
        });
    });

    if (validMoves.length === 0) {
        if (boneyard.length > 0) {
            const drawnDomino = boneyard.pop();
            cpuDominoes.push(drawnDomino);
            updateBoneyardCount();
            showToast('CPU drew from boneyard');
            setTimeout(cpuPlay, 1000);
        } else {
            showToast('CPU passes');
            recordPass();
            if (!gameOver) {
                isPlayerTurn = true;
                handlePlayerTurnStart();
            }
        }
        return;
    }

    passesInRow = 0;

    const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
    placeDomino(randomMove.domino, randomMove.side, randomMove.x, randomMove.y, randomMove.horizontal);
}

function getBoardElement() {
    return document.getElementById('board');
}

function centerCameraOnBoard() {
    console.log('centerCameraOnBoard called');
    const board = getBoardElement();
    if (!board) {
        console.log('Board element not found');
        return;
    }

    const boardContainer = document.querySelector('.board-container');
    if (!boardContainer) {
        console.log('Board container not found');
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const targetZoom = isMobile ? MOBILE_FOCUS_ZOOM : 1;

    console.log(`startingDomino: ${startingDomino ? 'exists' : 'null'}, boardDominoes.length: ${boardDominoes.length}`);

    const bounds = getBoardContentBounds();
    if (!bounds) {
        // Board is empty, center camera on where starting domino will be placed
        if (startingDomino && boardDominoes.length === 0) {
            // Starting domino is always placed at board center
            const boardCenterX = board.offsetWidth / 2;
            const boardCenterY = board.offsetHeight / 2;
            const containerCenterX = boardContainer.offsetWidth / 2;
            const containerCenterY = boardContainer.offsetHeight / 2;

            console.log(`Board: ${board.offsetWidth}x${board.offsetHeight}, Center: ${boardCenterX},${boardCenterY}`);
            console.log(`Container: ${boardContainer.offsetWidth}x${boardContainer.offsetHeight}, Center: ${containerCenterX},${containerCenterY}`);
            console.log(`Mobile: ${isMobile}, Zoom: ${targetZoom}`);

            if (isMobile) {
                camera.x = boardCenterX - containerCenterX;
                camera.y = boardCenterY - containerCenterY;
            } else {
                camera.x = 0;
                camera.y = 0;
            }
            camera.zoom = targetZoom;
            applyCamera();
            console.log(`Camera set to: x=${camera.x}, y=${camera.y}, zoom=${camera.zoom}`);
            return;
        }

        // Fallback to board center
        if (isMobile) {
            const boardCenterX = 400;
            const boardCenterY = 300;
            const containerCenterX = boardContainer.offsetWidth / 2;
            const containerCenterY = boardContainer.offsetHeight / 2;
            camera.x = boardCenterX - containerCenterX / targetZoom;
            camera.y = boardCenterY - containerCenterY / targetZoom;
        } else {
            camera.x = 0;
            camera.y = 0;
        }
        camera.zoom = targetZoom;
        applyCamera();
        return;
    }

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    camera.x = centerX - boardContainer.offsetWidth / 2;
    camera.y = centerY - boardContainer.offsetHeight / 2;
    camera.zoom = targetZoom;
    applyCamera();
}

function applyCamera() {
    const cameraLayer = document.getElementById('cameraLayer');
    if (!cameraLayer) return;

    cameraLayer.style.transform = `translate(${-camera.x}px, ${-camera.y}px) scale(${camera.zoom})`;
    cameraLayer.style.transformOrigin = '0 0';
}

function setupTouchScrolling() {
    const boardContainer = document.querySelector('.board-container');
    if (!boardContainer) return;

    let isDragging = false;
    let startX, startY;
    let lastX, lastY;
    let velocityX = 0, velocityY = 0;
    let lastTimestamp = 0;

    boardContainer.addEventListener('mousedown', startDrag);
    boardContainer.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
        if (e.target.closest('.domino') || e.target.closest('.placement-zone')) return;
        
        e.preventDefault();
        isDragging = true;
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        lastX = point.clientX;
        lastY = point.clientY;
        velocityX = 0;
        velocityY = 0;
        lastTimestamp = Date.now();

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const point = e.touches ? e.touches[0] : e;
        const deltaX = point.clientX - lastX;
        const deltaY = point.clientY - lastY;
        const timestamp = Date.now();
        const dt = timestamp - lastTimestamp;

        camera.x -= deltaX / camera.zoom;
        camera.y -= deltaY / camera.zoom;

        velocityX = deltaX / dt;
        velocityY = deltaY / dt;

        lastX = point.clientX;
        lastY = point.clientY;
        lastTimestamp = timestamp;

        applyCamera();
    }

    function endDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchend', endDrag);

        if (Math.abs(velocityX) > 0.5 || Math.abs(velocityY) > 0.5) {
            lastPanVelocity = { x: velocityX, y: velocityY };
            startMomentum();
        }
    }
}

function startMomentum() {
    if (momentumFrame) cancelAnimationFrame(momentumFrame);

    function animate() {
        if (Math.abs(lastPanVelocity.x) < 0.1 && Math.abs(lastPanVelocity.y) < 0.1) {
            lastPanVelocity = { x: 0, y: 0 };
            return;
        }

        camera.x -= lastPanVelocity.x * 16 / camera.zoom;
        camera.y -= lastPanVelocity.y * 16 / camera.zoom;

        lastPanVelocity.x *= 0.95;
        lastPanVelocity.y *= 0.95;

        applyCamera();
        momentumFrame = requestAnimationFrame(animate);
    }

    momentumFrame = requestAnimationFrame(animate);
}

function showToast(message) {
    const toast = document.getElementById('hintToast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');

    if (hintTimeout) clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

function setupHintSystem() {
    setInterval(() => {
        if (!isPlayerTurn || gameOver || isShowingZones) return;

        const hint = GAME_HINTS[hintIndex % GAME_HINTS.length];
        showToast(hint);
        hintIndex++;
    }, 15000);
}

function showZoneHintArrows(zones) {
    const arrowsContainer = document.getElementById('zoneHintArrows');
    if (!arrowsContainer) return;

    arrowsContainer.innerHTML = '';

    const board = getBoardElement();
    const boardRect = board.getBoundingClientRect();

    zones.forEach(zone => {
        const zoneCenterX = zone.x + zone.width / 2;
        const zoneCenterY = zone.y + zone.height / 2;

        const screenX = zoneCenterX - camera.x;
        const screenY = zoneCenterY - camera.y;

        if (screenX < 0 || screenX > boardRect.width || screenY < 0 || screenY > boardRect.height) {
            const arrow = document.createElement('div');
            arrow.className = 'zone-hint-arrow';

            let arrowLeft, arrowTop;
            if (screenX < 0) {
                arrowLeft = '20px';
                arrowTop = Math.max(20, Math.min(screenY, boardRect.height - 20)) + 'px';
                arrow.innerHTML = '▶';
            } else if (screenX > boardRect.width) {
                arrowLeft = (boardRect.width - 40) + 'px';
                arrowTop = Math.max(20, Math.min(screenY, boardRect.height - 20)) + 'px';
                arrow.innerHTML = '◀';
            } else if (screenY < 0) {
                arrowLeft = Math.max(20, Math.min(screenX, boardRect.width - 20)) + 'px';
                arrowTop = '20px';
                arrow.innerHTML = '▼';
            } else {
                arrowLeft = Math.max(20, Math.min(screenX, boardRect.width - 20)) + 'px';
                arrowTop = (boardRect.height - 40) + 'px';
                arrow.innerHTML = '▲';
            }

            arrow.style.left = arrowLeft;
            arrow.style.top = arrowTop;
            arrowsContainer.appendChild(arrow);
        }
    });
}

function clearZoneHintArrows() {
    const arrowsContainer = document.getElementById('zoneHintArrows');
    if (arrowsContainer) arrowsContainer.innerHTML = '';
}

function updateRackScrollIndicators() {
    const rack = document.getElementById('playerRack');
    const leftIndicator = document.getElementById('rackScrollLeft');
    const rightIndicator = document.getElementById('rackScrollRight');
    const leftLabel = document.getElementById('rackScrollLeftLabel');
    const rightLabel = document.getElementById('rackScrollRightLabel');

    if (!rack || !leftIndicator || !rightIndicator) return;

    const scrollLeft = rack.scrollLeft;
    const maxScroll = rack.scrollWidth - rack.clientWidth;

    if (scrollLeft > 10) {
        leftIndicator.classList.remove('hidden');
        if (leftLabel) leftLabel.textContent = playerDominoes[0] ? formatDominoLabel(playerDominoes[0]) : '';
    } else {
        leftIndicator.classList.add('hidden');
    }

    if (scrollLeft < maxScroll - 10) {
        rightIndicator.classList.remove('hidden');
        if (rightLabel) rightLabel.textContent = playerDominoes[playerDominoes.length - 1] ? formatDominoLabel(playerDominoes[playerDominoes.length - 1]) : '';
    } else {
        rightIndicator.classList.add('hidden');
    }
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
    playTone(300, 0.1);
}

function playWinSound() {
    if (!audioContext) return;
    playTone(523, 0.15);
    setTimeout(() => playTone(659, 0.15), 150);
    setTimeout(() => playTone(784, 0.3), 300);
}

function playLoseSound() {
    if (!audioContext) return;
    playTone(200, 0.3);
    setTimeout(() => playTone(150, 0.4), 300);
}

function playTone(frequency, duration) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

document.addEventListener('DOMContentLoaded', init);
