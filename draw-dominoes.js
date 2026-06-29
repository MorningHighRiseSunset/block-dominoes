let playerDominoes = [];
let cpuDominoes = [];
let boardDominoes = [];
let boneyard = [];
let selectedDomino = null;
let isPlayerTurn = true;
let boardEnds = { left: null, right: null };
let endPositions = { left: null, right: null };
let endIsDouble = { left: false, right: false };
let boardDimensions = { width: 0, height: 0 };
let isShowingZones = false;
let audioContext = null;
let camera = { x: 0, y: 0, zoom: 1 };
let cameraAnimating = false;
let cameraAnimationFrame = null;
let momentumFrame = null;
let lastPanVelocity = { x: 0, y: 0 };
const FOCUS_ZOOM = 1.35;
const MOBILE_FOCUS_ZOOM = 1.22;
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

function init() {
    initializeBoard();
    dealDominoes();
    const starter = findStarter(playerDominoes, cpuDominoes);
    startingDomino = starter.domino;
    isPlayerTurn = starter.owner === 'player';
    renderRacks();
    showTurnIndicator(starter);
    setupTouchScrolling();
    initAudio();
    document.getElementById('drawBtn').addEventListener('click', drawFromBoneyard);
    centerCameraOnBoard();
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
    boardEnds = { left: null, right: null };
    endPositions = { left: null, right: null };
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
        const placedWidth = placed.isHorizontal ? 100 : 50;
        const placedHeight = placed.isHorizontal ? 50 : 100;
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
    showToast(`Drew ${formatDominoLabel(drawnDomino)}`);
}

function createDominoElement(domino, isHorizontal, owner) {
    const dominoEl = document.createElement('div');
    dominoEl.className = 'domino';
    if (owner) dominoEl.classList.add(owner);

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
    pipsContainer.dataset.value = value;

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
    zones.forEach(zone => {
        const zoneEl = document.createElement('div');
        zoneEl.className = 'placement-zone';
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

    isShowingZones = true;
    showZoneHintArrows(zones);
}

function clearPlacementZones() {
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    isShowingZones = false;
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

    if (boardEnds.left !== null && endPositions.left && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) {
        const leftPos = endPositions.left;
        const dominoCenterX = leftPos.x + (leftPos.isHorizontal ? 50 : 25);
        const dominoCenterY = leftPos.y + (leftPos.isHorizontal ? 25 : 50);
        const isDouble = domino.top === domino.bottom;

        if (isDouble) {
            const zoneX = leftPos.x - 50;
            const zoneY = dominoCenterY - 50;
            if (!checkZoneOverlap(zoneX, zoneY, 50, 100)) {
                validZones.push({ side: 'left', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
            }
        } else {
            const zoneX = leftPos.x - 100;
            const zoneY = dominoCenterY - 25;
            if (!checkZoneOverlap(zoneX, zoneY, 100, 50)) {
                validZones.push({ side: 'left', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            }
        }
    }

    if (boardEnds.right !== null && endPositions.right && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) {
        const rightPos = endPositions.right;
        const dominoCenterX = rightPos.x + (rightPos.isHorizontal ? 50 : 25);
        const dominoCenterY = rightPos.y + (rightPos.isHorizontal ? 25 : 50);
        const isDouble = domino.top === domino.bottom;

        if (isDouble) {
            const zoneX = rightPos.x;
            const zoneY = dominoCenterY - 50;
            if (!checkZoneOverlap(zoneX, zoneY, 50, 100)) {
                validZones.push({ side: 'right', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
            }
        } else {
            const zoneX = rightPos.x;
            const zoneY = dominoCenterY - 25;
            if (!checkZoneOverlap(zoneX, zoneY, 100, 50)) {
                validZones.push({ side: 'right', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            }
        }
    }

    return validZones;
}

function checkZoneOverlap(zoneX, zoneY, zoneWidth, zoneHeight) {
    for (const placed of boardDominoes) {
        const placedWidth = placed.isHorizontal ? 100 : 50;
        const placedHeight = placed.isHorizontal ? 50 : 100;
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
    
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    
    const dominoWidth = isHorizontal ? 100 : 50;
    const dominoHeight = isHorizontal ? 50 : 100;
    const { shiftX, shiftY } = ensureBoardBounds(x, y, x + dominoWidth, y + dominoHeight, true);
    x += shiftX;
    y += shiftY;
    
    for (const placed of boardDominoes) {
        const placedWidth = placed.isHorizontal ? 100 : 50;
        const placedHeight = placed.isHorizontal ? 50 : 100;
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
    
    lastPlayedSide = side;
    if (side === 'center') {
        boardEnds.left = orientedDomino.top;
        boardEnds.right = orientedDomino.bottom;
        const spinnerWidth = isHorizontal ? 100 : 50;
        endPositions.left = { x, y, isHorizontal };
        endPositions.right = { x: x + spinnerWidth, y, isHorizontal };
        endIsDouble.left = false;
        endIsDouble.right = false;
    } else if (side === 'left') {
        boardEnds.left = orientedDomino.top;
        const dominoWidth = isHorizontal ? 100 : 50;
        endPositions.left = { x: x, y: y, isHorizontal: isHorizontal };
        endIsDouble.left = (orientedDomino.top === orientedDomino.bottom);
    } else if (side === 'right') {
        boardEnds.right = orientedDomino.bottom;
        const dominoWidth = isHorizontal ? 100 : 50;
        endPositions.right = { x: x + dominoWidth, y: y, isHorizontal: isHorizontal };
        endIsDouble.right = (orientedDomino.top === orientedDomino.bottom);
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
    // Could be used for move history or replay
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
        endGame('win', 'You played all your dominoes!');
        return;
    }
    if (!wasPlayerTurn && cpuDominoes.length === 0) {
        endGame('lose', 'CPU played all their dominoes.');
    }
}

function endGame(result, message) {
    if (gameOver) return;
    gameOver = true;

    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    selectedDomino = null;

    const overlay = document.getElementById('gameOverOverlay');
    const title = document.getElementById('gameOverTitle');
    const msg = document.getElementById('gameOverMessage');
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
    playAgainBtn.style.display = 'block';
    overlay.classList.remove('hidden');
}

function handlePlayerTurnStart() {
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
    const board = getBoardElement();
    if (!board) return;

    const bounds = getBoardContentBounds();
    if (!bounds) {
        camera.x = 0;
        camera.y = 0;
        camera.zoom = 1;
        applyCamera();
        return;
    }

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    camera.x = centerX - board.offsetWidth / 2;
    camera.y = centerY - board.offsetHeight / 2;
    camera.zoom = 1;
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
