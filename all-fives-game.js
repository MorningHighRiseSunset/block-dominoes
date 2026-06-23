let playerDominoes = [];
let cpuDominoes = [];
let boardDominoes = [];
let boneyard = [];
let selectedDomino = null;
let isPlayerTurn = true;
let boardEnds = { left: null, right: null, top: null, bottom: null };
let endPositions = { left: null, right: null, top: null, bottom: null };
let endIsDouble = { left: false, right: false, top: false, bottom: false };
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
let playerScore = 0;
let cpuScore = 0;
const WINNING_SCORE = 150;
let leftArmFilled = false;
let rightArmFilled = false;

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
    centerCameraOnBoard();
    updateDrawButton();
    setupHintSystem();
    updateScoreDisplay();
    document.getElementById('playAgainBtn').addEventListener('click', () => location.reload());

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
    endIsDouble = { left: false, right: false, top: false, bottom: false };
    boardDimensions.width = 800;
    boardDimensions.height = 600;
    board.style.width = '800px';
    board.style.height = '600px';
    leftArmFilled = false;
    rightArmFilled = false;
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

function calculateOpenEndsSum() {
    let sum = 0;
    if (boardEnds.left !== null) sum += boardEnds.left;
    if (boardEnds.right !== null) sum += boardEnds.right;
    if (boardEnds.top !== null) sum += boardEnds.top;
    if (boardEnds.bottom !== null) sum += boardEnds.bottom;
    return sum;
}

function calculateScoreFromEnds(playedSide) {
    // Muggins All 5s scoring rules:
    // 1. If an end has a double, count both sides (double the value)
    // 2. Spinner top/bottom:
    //    - If 0 or 1 side arms filled: count both top and bottom
    //    - If 2 side arms filled: ignore top and bottom
    //    - If 3 or 4 arms filled: count the played arms
    let sum = 0;

    // Count left end (double if it's a double)
    if (boardEnds.left !== null) {
        sum += endIsDouble.left ? boardEnds.left * 2 : boardEnds.left;
    }

    // Count right end (double if it's a double)
    if (boardEnds.right !== null) {
        sum += endIsDouble.right ? boardEnds.right * 2 : boardEnds.right;
    }

    // Count top and bottom based on spinner arm fill status
    const armsFilled = (leftArmFilled ? 1 : 0) + (rightArmFilled ? 1 : 0) +
                      (boardEnds.top !== null ? 1 : 0) + (boardEnds.bottom !== null ? 1 : 0);

    if (armsFilled < 2) {
        // 0 or 1 side arms filled: count both spinner top and bottom
        if (boardEnds.top !== null) {
            sum += endIsDouble.top ? boardEnds.top * 2 : boardEnds.top;
        }
        if (boardEnds.bottom !== null) {
            sum += endIsDouble.bottom ? boardEnds.bottom * 2 : boardEnds.bottom;
        }
    } else if (armsFilled === 2 && leftArmFilled && rightArmFilled) {
        // Both side arms filled but no top/bottom played: ignore spinner top/bottom
        // Don't add anything for top/bottom
    } else {
        // 3 or 4 arms filled, or top/bottom have been played: count played arms
        if (boardEnds.top !== null) {
            sum += endIsDouble.top ? boardEnds.top * 2 : boardEnds.top;
        }
        if (boardEnds.bottom !== null) {
            sum += endIsDouble.bottom ? boardEnds.bottom * 2 : boardEnds.bottom;
        }
    }

    if (sum % 5 === 0) {
        return sum;
    }
    return 0;
}

function updateScoreDisplay() {
    document.getElementById('playerScore').textContent = playerScore;
    document.getElementById('cpuScore').textContent = cpuScore;
}

// Test function to verify scoring against rules examples
// Call this from browser console: testScoring()
function testScoring() {
    console.log('=== Testing Muggins All 5s Scoring ===\n');

    // Save current state
    const savedBoardEnds = { ...boardEnds };
    const savedEndIsDouble = { ...endIsDouble };
    const savedLeftArmFilled = leftArmFilled;
    const savedRightArmFilled = rightArmFilled;

    // Test 1: 1/3 - 3/3 (one side occupied)
    // Expected: 1 + 3 + 3 = 7 → 0 points
    boardEnds = { left: 1, right: null, top: 3, bottom: 3 };
    endIsDouble = { left: false, right: false, top: true, bottom: true };
    leftArmFilled = true;
    rightArmFilled = false;
    const score1 = calculateScoreFromEnds('left');
    console.log('Test 1: 1/3 - 3/3 (one side occupied)');
    console.log('  Expected: 1 + 3 + 3 = 7 → 0 points');
    console.log('  Actual:', score1, 'points');
    console.log('  Result:', score1 === 0 ? 'PASS' : 'FAIL');
    console.log();

    // Test 2: 1/3 - 3/3 - 3/6 (both sides occupied)
    // Expected: 1 + 6 = 7 → 0 points (spinner top/bottom ignored)
    boardEnds = { left: 1, right: 6, top: null, bottom: null };
    endIsDouble = { left: false, right: false, top: false, bottom: false };
    leftArmFilled = true;
    rightArmFilled = true;
    const score2 = calculateScoreFromEnds('right');
    console.log('Test 2: 1/3 - 3/3 - 3/6 (both sides occupied)');
    console.log('  Expected: 1 + 6 = 7 → 0 points (spinner top/bottom ignored)');
    console.log('  Actual:', score2, 'points');
    console.log('  Result:', score2 === 0 ? 'PASS' : 'FAIL');
    console.log();

    // Test 3: Third arm opened (5 on top)
    // Expected: 1 + 6 + 5 = 12 → 0 points
    boardEnds = { left: 1, right: 6, top: 5, bottom: null };
    endIsDouble = { left: false, right: false, top: false, bottom: false };
    leftArmFilled = true;
    rightArmFilled = true;
    const score3 = calculateScoreFromEnds('top');
    console.log('Test 3: Third arm opened (5 on top)');
    console.log('  Expected: 1 + 6 + 5 = 12 → 0 points');
    console.log('  Actual:', score3, 'points');
    console.log('  Result:', score3 === 0 ? 'PASS' : 'FAIL');
    console.log();

    // Test 4: Fourth arm opened (4 on bottom)
    // Expected: 1 + 6 + 5 + 4 = 16 → 0 points
    boardEnds = { left: 1, right: 6, top: 5, bottom: 4 };
    endIsDouble = { left: false, right: false, top: false, bottom: false };
    leftArmFilled = true;
    rightArmFilled = true;
    const score4 = calculateScoreFromEnds('bottom');
    console.log('Test 4: Fourth arm opened (4 on bottom)');
    console.log('  Expected: 1 + 6 + 5 + 4 = 16 → 0 points');
    console.log('  Actual:', score4, 'points');
    console.log('  Result:', score4 === 0 ? 'PASS' : 'FAIL');
    console.log();

    // Test 5: Scoring example 4/3 - 3/3 - 3/1 with 5 on top and bottom
    // Expected: 4 + 1 + 5 + 5 = 15 → 15 points
    boardEnds = { left: 4, right: 1, top: 5, bottom: 5 };
    endIsDouble = { left: false, right: false, top: false, bottom: false };
    leftArmFilled = true;
    rightArmFilled = true;
    const score5 = calculateScoreFromEnds('bottom');
    console.log('Test 5: Scoring example 4 + 1 + 5 + 5 = 15');
    console.log('  Expected: 15 points');
    console.log('  Actual:', score5, 'points');
    console.log('  Result:', score5 === 15 ? 'PASS' : 'FAIL');
    console.log();

    // Test 6: User's example 4/4 <- 4/6 <- 6/6 (one side arm filled)
    // In actual game, spinner top/bottom are null until played on
    // Expected: 8 (double 4) = 8 → 0 points (only left end counts)
    boardEnds = { left: 4, right: null, top: null, bottom: null };
    endIsDouble = { left: true, right: false, top: false, bottom: false };
    leftArmFilled = true;
    rightArmFilled = false;
    const score6 = calculateScoreFromEnds('left');
    console.log('Test 6: User example 4/4 <- 4/6 <- 6/6 (one side arm filled)');
    console.log('  Expected: 8 (double 4) = 8 → 0 points (spinner top/bottom null until played)');
    console.log('  Actual:', score6, 'points');
    console.log('  Result:', score6 === 0 ? 'PASS' : 'FAIL');
    console.log();

    // Test 7: User's example with both side arms filled (4/4 <- 4/6 <- 6/6 -> 3/6)
    // Expected: 8 (double 4) + 6 = 14 → 0 points (spinner top/bottom ignored)
    boardEnds = { left: 4, right: 6, top: null, bottom: null };
    endIsDouble = { left: true, right: false, top: false, bottom: false };
    leftArmFilled = true;
    rightArmFilled = true;
    const score7 = calculateScoreFromEnds('right');
    console.log('Test 7: User example with both side arms filled');
    console.log('  Expected: 8 (double 4) + 6 = 14 → 0 points (spinner top/bottom ignored)');
    console.log('  Actual:', score7, 'points');
    console.log('  Result:', score7 === 0 ? 'PASS' : 'FAIL');
    console.log();

    // Test 8: Double at end - manuscript example "this two becomes a four"
    // Expected: 4 (double 2) + 6 = 10 → 10 points
    boardEnds = { left: 2, right: 6, top: null, bottom: null };
    endIsDouble = { left: true, right: false, top: false, bottom: false };
    leftArmFilled = true;
    rightArmFilled = true;
    const score8 = calculateScoreFromEnds('left');
    console.log('Test 8: Double at end (2 becomes 4) + 6');
    console.log('  Expected: 4 (double 2) + 6 = 10 → 10 points');
    console.log('  Actual:', score8, 'points');
    console.log('  Result:', score8 === 10 ? 'PASS' : 'FAIL');
    console.log();

    // Restore state
    boardEnds = savedBoardEnds;
    endIsDouble = savedEndIsDouble;
    leftArmFilled = savedLeftArmFilled;
    rightArmFilled = savedRightArmFilled;

    console.log('=== Test Complete ===');
}

function addScore(isPlayer, points) {
    if (isPlayer) {
        playerScore += points;
    } else {
        cpuScore += points;
    }
    updateScoreDisplay();
    checkScoreWinCondition();
}

function simulateMoveScore(domino, side) {
    const matchingEnd = boardEnds[side];
    let newEnd = null;
    let newIsDouble = false;

    // This logic must match the orientation logic in placeDomino
    // For horizontal placement (left/right):
    // - left: right side (bottom) connects to board, left side (top) becomes new open end
    // - right: left side (top) connects to board, right side (bottom) becomes new open end
    // For vertical placement (top/bottom):
    // - top: bottom side (bottom) connects to board, top side (top) becomes new open end
    // - bottom: top side (top) connects to board, bottom side (bottom) becomes new open end

    if (side === 'left' || side === 'right') {
        // Horizontal placement
        if (side === 'left') {
            // If domino.bottom matches, no flip needed, new open end is top
            // If domino.top matches, flip so bottom connects, new open end is bottom
            newEnd = domino.bottom === matchingEnd ? domino.top : domino.bottom;
        } else {
            // right placement
            // If domino.top matches, no flip needed, new open end is bottom
            // If domino.bottom matches, flip so top connects, new open end is top
            newEnd = domino.top === matchingEnd ? domino.bottom : domino.top;
        }
    } else {
        // Vertical placement (top/bottom)
        if (side === 'top') {
            // If domino.bottom matches, no flip needed, new open end is top
            // If domino.top matches, flip so bottom connects, new open end is bottom
            newEnd = domino.bottom === matchingEnd ? domino.top : domino.bottom;
        } else {
            // bottom placement
            // If domino.top matches, no flip needed, new open end is bottom
            // If domino.bottom matches, flip so top connects, new open end is top
            newEnd = domino.top === matchingEnd ? domino.bottom : domino.top;
        }
    }

    // Check if the new end is a double
    newIsDouble = (domino.top === domino.bottom);

    // Simulate the new board ends and double status
    const simulatedEnds = { ...boardEnds };
    const simulatedIsDouble = { ...endIsDouble };
    simulatedEnds[side] = newEnd;
    simulatedIsDouble[side] = newIsDouble;

    // Simulate arm fill status (but don't open spinner top/bottom - they remain null until played on)
    let simLeftArmFilled = leftArmFilled;
    let simRightArmFilled = rightArmFilled;
    if (side === 'left') simLeftArmFilled = true;
    if (side === 'right') simRightArmFilled = true;

    // Calculate sum using same logic as calculateScoreFromEnds
    let sum = 0;

    // Count left end (double if it's a double)
    if (simulatedEnds.left !== null) {
        sum += simulatedIsDouble.left ? simulatedEnds.left * 2 : simulatedEnds.left;
    }

    // Count right end (double if it's a double)
    if (simulatedEnds.right !== null) {
        sum += simulatedIsDouble.right ? simulatedEnds.right * 2 : simulatedEnds.right;
    }

    // Count top and bottom based on spinner arm fill status
    const armsFilled = (simLeftArmFilled ? 1 : 0) + (simRightArmFilled ? 1 : 0) +
                      (simulatedEnds.top !== null ? 1 : 0) + (simulatedEnds.bottom !== null ? 1 : 0);

    if (armsFilled < 2) {
        // 0 or 1 side arms filled: count both spinner top and bottom
        if (simulatedEnds.top !== null) {
            sum += simulatedIsDouble.top ? simulatedEnds.top * 2 : simulatedEnds.top;
        }
        if (simulatedEnds.bottom !== null) {
            sum += simulatedIsDouble.bottom ? simulatedEnds.bottom * 2 : simulatedEnds.bottom;
        }
    } else if (armsFilled === 2 && simLeftArmFilled && simRightArmFilled) {
        // Both side arms filled but no top/bottom played: ignore spinner top/bottom
        // Don't add anything for top/bottom
    } else {
        // 3 or 4 arms filled, or top/bottom have been played: count played arms
        if (simulatedEnds.top !== null) {
            sum += simulatedIsDouble.top ? simulatedEnds.top * 2 : simulatedEnds.top;
        }
        if (simulatedEnds.bottom !== null) {
            sum += simulatedIsDouble.bottom ? simulatedEnds.bottom * 2 : simulatedEnds.bottom;
        }
    }

    // Return score if multiple of 5
    if (sum % 5 === 0) {
        return sum;
    }
    return 0;
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

    if (adjustCamera) {
        compensateCameraForShift(shiftX, shiftY);
    }

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

function createDominoElement(domino, isHorizontal, owner = 'player') {
    const el = document.createElement('div');
    el.className = 'domino' + (isHorizontal ? ' horizontal' : '') + (owner === 'player' ? ' player-domino' : ' cpu-domino');
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
        const el = createDominoElement(domino, false, 'player');
        if (boardDominoes.length === 0 && isPlayerTurn && startingDomino && domino.id === startingDomino.id) {
            el.classList.add('starter-domino');
        }
        el.addEventListener('click', () => selectDomino(domino, el));
        playerRack.appendChild(el);
    });
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


function countPipsInHand(dominoes) {
    return dominoes.reduce((total, domino) => total + domino.top + domino.bottom, 0);
}

function hasAnyValidMove(dominoes) {
    if (boardDominoes.length === 0) {
        return dominoes.some(d => startingDomino && d.id === startingDomino.id);
    }
    return dominoes.some(domino =>
        (boardEnds.left !== null && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) ||
        (boardEnds.right !== null && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) ||
        (boardEnds.top !== null && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) ||
        (boardEnds.bottom !== null && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom))
    );
}

function recordPass() {
    passesInRow++;
    playPassSound();
    if (passesInRow >= 2 && boneyard.length === 0) {
        resolveBlockedGame();
    }
}

function recordMove() {
    passesInRow = 0;
}

function resolveBlockedGame() {
    const playerPips = countPipsInHand(playerDominoes);
    const cpuPips = countPipsInHand(cpuDominoes);

    if (playerPips < cpuPips) {
        // Player wins blocked game, add CPU's pips to player's score
        playerScore += cpuPips;
        updateScoreDisplay();
        endGame('win', `Game blocked — you had fewer pips! +${cpuPips} points from CPU's remaining pips.`, playerPips, cpuPips);
    } else if (cpuPips < playerPips) {
        // CPU wins blocked game, add player's pips to CPU's score
        cpuScore += playerPips;
        updateScoreDisplay();
        endGame('lose', `Game blocked — CPU had fewer pips. +${playerPips} points from your remaining pips.`, playerPips, cpuPips);
    } else {
        endGame('draw', 'Game blocked — tied on remaining pips.', playerPips, cpuPips);
    }
}

function checkGameEndAfterMove(wasPlayerTurn) {
    if (gameOver) return;

    if (wasPlayerTurn && playerDominoes.length === 0) {
        // Player wins round, add CPU's remaining pips to player's score
        const cpuPips = countPipsInHand(cpuDominoes);
        playerScore += cpuPips;
        updateScoreDisplay();
        endGame('win', `You played all your dominoes! +${cpuPips} points from CPU's remaining pips.`, null, null);
        return;
    }
    if (!wasPlayerTurn && cpuDominoes.length === 0) {
        // CPU wins round, add player's remaining pips to CPU's score
        const playerPips = countPipsInHand(playerDominoes);
        cpuScore += playerPips;
        updateScoreDisplay();
        endGame('lose', `CPU played all their dominoes. +${playerPips} points from your remaining pips.`, null, null);
    }
}

function checkScoreWinCondition() {
    if (gameOver) return;

    if (playerScore >= WINNING_SCORE) {
        endGame('win', `You reached ${playerScore} points!`, null, null);
    } else if (cpuScore >= WINNING_SCORE) {
        endGame('lose', `CPU reached ${cpuScore} points.`, null, null);
    }
}

function endGame(result, message, playerPips, cpuPips) {
    if (gameOver) return;
    gameOver = true;

    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    selectedDomino = null;

    const overlay = document.getElementById('gameOverOverlay');
    const title = document.getElementById('gameOverTitle');
    const msg = document.getElementById('gameOverMessage');

    if (result === 'win') {
        title.textContent = 'You Win!';
        playWinSound();
    } else if (result === 'lose') {
        title.textContent = 'You Lose';
        playLoseSound();
    } else {
        title.textContent = 'Draw';
        playDrawGameSound();
    }

    msg.textContent = message;
    if (playerPips !== null) {
        msg.textContent += ` Your pips: ${playerPips}  ·  CPU pips: ${cpuPips}`;
    }
    msg.textContent += ` Final Score — You: ${playerScore}  ·  CPU: ${cpuScore}`;

    overlay.classList.remove('hidden');
}


function setupHintSystem() {
    showNextHint();
}

function showNextHint() {
    if (gameOver) return;

    const toast = document.getElementById('hintToast');
    if (!toast) return;

    if (hintTimeout) clearTimeout(hintTimeout);

    toast.textContent = GAME_HINTS[hintIndex % GAME_HINTS.length];
    hintIndex++;
    toast.classList.remove('hidden', 'fade-out');

    hintTimeout = setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.classList.add('hidden');
            toast.classList.remove('fade-out');
            if (!gameOver) {
                hintTimeout = setTimeout(showNextHint, 2000);
            }
        }, 600);
    }, 6000);
}

function selectDomino(domino, element) {
    if (!isPlayerTurn || gameOver) return;
    resumeAudio();
    
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
    if (!isPlayerTurn || boneyard.length === 0 || gameOver) return;
    
    const drawnDomino = boneyard.pop();
    playerDominoes.push(drawnDomino);
    recordMove();
    playDrawSound();
    
    updateBoneyardCount();
    renderRacks();
    updateDrawButton();
}

function checkPlayerValidMoves() {
    const hasValidMove = hasAnyValidMove(playerDominoes);
    
    const drawBtn = document.getElementById('drawBtn');
    
    if (!hasValidMove && boneyard.length > 0) {
        drawBtn.disabled = false;
    } else if (!hasValidMove && boneyard.length === 0) {
        isPlayerTurn = false;
        drawBtn.disabled = true;
        recordPass();
        if (!gameOver) setTimeout(cpuPlay, 1000);
    } else {
        drawBtn.disabled = true;
    }
}

function updateDrawButton() {
    const drawBtn = document.getElementById('drawBtn');
    if (!isPlayerTurn || gameOver) {
        drawBtn.disabled = true;
        return;
    }
    
    const hasValidMove = hasAnyValidMove(playerDominoes);
    
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
        ensureBoardBounds(placement.x, placement.y, placement.x + placement.width, placement.y + placement.height, false);

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
    if (boardEnds.left !== null && endPositions.left && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) {
        const leftPos = endPositions.left;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = leftPos.x + (leftPos.isHorizontal ? 50 : 25);
        const dominoCenterY = leftPos.y + (leftPos.isHorizontal ? 25 : 50);
        
        // Doubles should be placed vertically (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceVertically = isDouble;
        
        if (shouldPlaceVertically) {
            // Vertical placement for doubles on left/right
            const newWidth = 50; // Width of vertical domino being placed
            const zoneX = leftPos.x - newWidth;
            const zoneY = dominoCenterY - 50;
            const overlaps = checkOverlap(zoneX, zoneY, 50, 100);
            if (!overlaps) {
                validZones.push({ side: 'left', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
            }
        } else {
            // Horizontal placement for non-doubles on left
            const newWidth = 100; // Width of horizontal domino being placed
            const zoneX = leftPos.x - newWidth;
            const zoneY = dominoCenterY - 25;
            const overlaps = checkOverlap(zoneX, zoneY, 100, 50);
            if (!overlaps) {
                validZones.push({ side: 'left', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            }
        }
    }
    
    // Check right - use stored right end position
    if (boardEnds.right !== null && endPositions.right && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) {
        const rightPos = endPositions.right;
        // Calculate center of the domino we're attaching to
        const dominoCenterX = rightPos.x + (rightPos.isHorizontal ? 50 : 25);
        const dominoCenterY = rightPos.y + (rightPos.isHorizontal ? 25 : 50);
        
        // Doubles should be placed vertically (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceVertically = isDouble;
        
        if (shouldPlaceVertically) {
            // Vertical placement for doubles on right
            const existingWidth = rightPos.isHorizontal ? 100 : 50;
            const zoneX = rightPos.x + existingWidth;
            const zoneY = dominoCenterY - 50;
            const overlaps = checkOverlap(zoneX, zoneY, 50, 100);
            if (!overlaps) {
                validZones.push({ side: 'right', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
            }
        } else {
            // Horizontal placement for non-doubles on right
            const existingWidth = rightPos.isHorizontal ? 100 : 50;
            const zoneX = rightPos.x + existingWidth;
            const zoneY = dominoCenterY - 25;
            const overlaps = checkOverlap(zoneX, zoneY, 100, 50);
            if (!overlaps) {
                validZones.push({ side: 'right', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            }
        }
    }
    
    // Check top - use stored top end position, or spinner position if both side arms are filled
    let topPos = null;
    let topMatchingEnd = null;

    if (boardEnds.top !== null && endPositions.top && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) {
        topPos = endPositions.top;
        topMatchingEnd = boardEnds.top;
    } else if (leftArmFilled && rightArmFilled && boardEnds.top === null && boardDominoes.length > 0) {
        // Both side arms filled, top is now available using spinner position
        const spinner = boardDominoes[0];
        const spinnerTop = spinner.domino.top;
        if (domino.top === spinnerTop || domino.bottom === spinnerTop) {
            topPos = { x: spinner.x, y: spinner.y, isHorizontal: spinner.isHorizontal };
            topMatchingEnd = spinnerTop;
        }
    }

    if (topPos) {
        // Calculate center of the domino we're attaching to
        const dominoCenterX = topPos.x + (topPos.isHorizontal ? 50 : 25);
        const dominoCenterY = topPos.y + (topPos.isHorizontal ? 25 : 50);

        // Doubles should be placed horizontally (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceHorizontally = isDouble;

        if (shouldPlaceHorizontally) {
            // Horizontal placement for doubles on top/bottom
            const newHeight = 50; // Height of horizontal domino being placed
            const zoneX = dominoCenterX - 50;
            const zoneY = topPos.y - newHeight;
            const overlaps = checkOverlap(zoneX, zoneY, 100, 50);
            if (!overlaps) {
                validZones.push({ side: 'top', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            }
        } else {
            // Vertical placement for non-doubles on top
            const newHeight = 100; // Height of vertical domino being placed
            const zoneX = dominoCenterX - 25;
            const zoneY = topPos.y - newHeight;
            const overlaps = checkOverlap(zoneX, zoneY, 50, 100);
            if (!overlaps) {
                validZones.push({ side: 'top', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
            }
        }
    }
    
    // Check bottom - use stored bottom end position, or spinner position if both side arms are filled
    let bottomPos = null;
    let bottomMatchingEnd = null;

    if (boardEnds.bottom !== null && endPositions.bottom && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom)) {
        bottomPos = endPositions.bottom;
        bottomMatchingEnd = boardEnds.bottom;
    } else if (leftArmFilled && rightArmFilled && boardEnds.bottom === null && boardDominoes.length > 0) {
        // Both side arms filled, bottom is now available using spinner position
        const spinner = boardDominoes[0];
        const spinnerBottom = spinner.domino.bottom;
        if (domino.top === spinnerBottom || domino.bottom === spinnerBottom) {
            bottomPos = { x: spinner.x, y: spinner.y, isHorizontal: spinner.isHorizontal };
            bottomMatchingEnd = spinnerBottom;
        }
    }

    if (bottomPos) {
        // Calculate center of the domino we're attaching to
        const dominoCenterX = bottomPos.x + (bottomPos.isHorizontal ? 50 : 25);
        const dominoCenterY = bottomPos.y + (bottomPos.isHorizontal ? 25 : 50);

        // Doubles should be placed horizontally (perpendicular to chain direction)
        const isDouble = domino.top === domino.bottom;
        const shouldPlaceHorizontally = isDouble;

        if (shouldPlaceHorizontally) {
            // Horizontal placement for doubles on bottom
            const existingHeight = bottomPos.isHorizontal ? 50 : 100;
            const zoneX = dominoCenterX - 50;
            const zoneY = bottomPos.y + existingHeight;
            const overlaps = checkOverlap(zoneX, zoneY, 100, 50);
            if (!overlaps) {
                validZones.push({ side: 'bottom', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            }
        } else {
            // Vertical placement for non-doubles on bottom
            const existingHeight = bottomPos.isHorizontal ? 50 : 100;
            const zoneX = dominoCenterX - 25;
            const zoneY = bottomPos.y + existingHeight;
            const overlaps = checkOverlap(zoneX, zoneY, 50, 100);
            if (!overlaps) {
                validZones.push({ side: 'bottom', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
            }
        }
    }
    
    const contentBounds = getBoardContentBounds(validZones);
    if (contentBounds) {
        const { shiftX, shiftY } = ensureBoardBounds(
            contentBounds.minX,
            contentBounds.minY,
            contentBounds.maxX,
            contentBounds.maxY,
            false
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
    
    // Final overlap check after board shifts
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
            // Overlap detected - don't place the domino
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
        const matchingEnd = boardEnds[side];

        // Orient the domino so the matching number connects to the board
        // The NEW exposed number will be the other side
        if (isHorizontal) {
            if (side === 'left') {
                // For left placement, the right side of domino (bottom) connects to board
                // The left side (top) becomes the new open end
                if (domino.bottom === matchingEnd) {
                    // bottom already matches, no flip needed
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.top === matchingEnd) {
                    // Need to flip so matching number is on the right (bottom)
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            } else if (side === 'right') {
                // For right placement, the left side of domino (top) connects to board
                // The right side (bottom) becomes the new open end
                if (domino.top === matchingEnd) {
                    // top already matches, no flip needed
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.bottom === matchingEnd) {
                    // Need to flip so matching number is on the left (top)
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            }
        } else {
            if (side === 'top') {
                // For top placement, the bottom side of domino (bottom) connects to board
                // The top side (top) becomes the new open end
                if (domino.bottom === matchingEnd) {
                    // bottom already matches, no flip needed
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.top === matchingEnd) {
                    // Need to flip so matching number is on the bottom
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            } else if (side === 'bottom') {
                // For bottom placement, the top side of domino (top) connects to board
                // The bottom side (bottom) becomes the new open end
                if (domino.top === matchingEnd) {
                    // top already matches, no flip needed
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.bottom === matchingEnd) {
                    // Need to flip so matching number is on the top
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            }
        }
    }
    
    const dominoEl = createDominoElement(orientedDomino, isHorizontal, wasPlayerTurn ? 'player' : 'cpu');
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
    
    // Update board ends to the NEW exposed number
    lastPlayedSide = side; // Track which side was just played for scoring
    if (side === 'center') {
        // Starting domino placement (spinner)
        // Spinner rule: only left and right are open initially
        // Top and bottom become available after left and right are filled
        boardEnds.left = orientedDomino.top;
        boardEnds.right = orientedDomino.bottom;
        boardEnds.top = null;  // Not available yet
        boardEnds.bottom = null;  // Not available yet
        endPositions.left = { x, y, isHorizontal };
        endPositions.right = { x, y, isHorizontal };
        endPositions.top = null;  // Not available yet
        endPositions.bottom = null;  // Not available yet
        // Spinner is always a double, so track it
        endIsDouble.left = true;
        endIsDouble.right = true;
        endIsDouble.top = false;
        endIsDouble.bottom = false;
    } else if (side === 'left') {
        // For left placement, the left side of the domino is the NEW open end
        boardEnds.left = orientedDomino.top;
        endPositions.left = { x: x, y: y, isHorizontal: isHorizontal };
        endIsDouble.left = (orientedDomino.top === orientedDomino.bottom);
        leftArmFilled = true;
        // Top and bottom remain null until a domino is actually placed on them
    } else if (side === 'right') {
        // For right placement, the right side of the domino is the NEW open end
        boardEnds.right = orientedDomino.bottom;
        endPositions.right = { x: x, y: y, isHorizontal: isHorizontal };
        endIsDouble.right = (orientedDomino.top === orientedDomino.bottom);
        rightArmFilled = true;
        // Top and bottom remain null until a domino is actually placed on them
    } else if (side === 'top') {
        // For top placement, the top side of the domino is the NEW open end
        boardEnds.top = orientedDomino.top;
        endPositions.top = { x: x, y: y, isHorizontal: isHorizontal };
        endIsDouble.top = (orientedDomino.top === orientedDomino.bottom);
    } else if (side === 'bottom') {
        // For bottom placement, the bottom side of the domino is the NEW open end
        boardEnds.bottom = orientedDomino.bottom;
        endPositions.bottom = { x: x, y: y, isHorizontal: isHorizontal };
        endIsDouble.bottom = (orientedDomino.top === orientedDomino.bottom);
    }
    
    // In a turning chain, when you place on one side, you might block adjacent sides
    // This is a simplified version - a full implementation would track chain topology
    // For now, we'll keep all 4 ends independent as per the current game design
    
    if (wasPlayerTurn) {
        playerDominoes = playerDominoes.filter(d => d.id !== domino.id);
    } else {
        cpuDominoes = cpuDominoes.filter(d => d.id !== domino.id);
    }
    
    updateLastPlayedDomino(orientedDomino);
    recordMove();

    // All Fives scoring: calculate score from open ends
    const scorePoints = calculateScoreFromEnds(side);
    if (scorePoints > 0) {
        addScore(wasPlayerTurn, scorePoints);
        playScoreSound();
    }

    // Check if someone reached winning score
    if (playerScore >= WINNING_SCORE) {
        endGame('win', `You reached ${WINNING_SCORE} points!`, null, null);
        return;
    }
    if (cpuScore >= WINNING_SCORE) {
        endGame('lose', `CPU reached ${WINNING_SCORE} points.`, null, null);
        return;
    }

    renderRacks();
    selectedDomino = null;

    isPlayerTurn = !wasPlayerTurn;

    updateBoneyardCount();
    updateDrawButton();
    
    const placedWidth = isHorizontal ? 100 : 50;
    const placedHeight = isHorizontal ? 50 : 100;
    focusOnBoardPoint(x, y, placedWidth, placedHeight);
    
    checkGameEndAfterMove(wasPlayerTurn);
    if (gameOver) return;
    
    if (!isPlayerTurn) {
        setTimeout(cpuPlay, 1000);
    }
}

function cpuPlay() {
    if (gameOver) return;

    if (cpuDominoes.length === 0) {
        endGame('lose', 'CPU played all their dominoes.', null, null);
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
        if (boardEnds.left !== null && endPositions.left && (domino.top === boardEnds.left || domino.bottom === boardEnds.left)) {
            const leftPos = endPositions.left;
            const dominoCenterX = leftPos.x + (leftPos.isHorizontal ? 50 : 25);
            const dominoCenterY = leftPos.y + (leftPos.isHorizontal ? 25 : 50);
            
            // Doubles should be placed vertically (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceVertically = isDouble;
            
            if (shouldPlaceVertically) {
                // Vertical placement for doubles on left
                const newWidth = 50; // Width of vertical domino being placed
                validMoves.push({ domino, side: 'left', x: leftPos.x - newWidth, y: dominoCenterY - 50, horizontal: false });
            } else {
                // Horizontal placement for non-doubles on left
                const newWidth = 100; // Width of horizontal domino being placed
                validMoves.push({ domino, side: 'left', x: leftPos.x - newWidth, y: dominoCenterY - 25, horizontal: true });
            }
        }
        
        // Check right - use actual right end position
        if (boardEnds.right !== null && endPositions.right && (domino.top === boardEnds.right || domino.bottom === boardEnds.right)) {
            const rightPos = endPositions.right;
            const dominoCenterX = rightPos.x + (rightPos.isHorizontal ? 50 : 25);
            const dominoCenterY = rightPos.y + (rightPos.isHorizontal ? 25 : 50);
            
            // Doubles should be placed vertically (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceVertically = isDouble;
            
            if (shouldPlaceVertically) {
                // Vertical placement for doubles on right
                const existingWidth = rightPos.isHorizontal ? 100 : 50;
                validMoves.push({ domino, side: 'right', x: rightPos.x + existingWidth, y: dominoCenterY - 50, horizontal: false });
            } else {
                // Horizontal placement for non-doubles on right
                const existingWidth = rightPos.isHorizontal ? 100 : 50;
                validMoves.push({ domino, side: 'right', x: rightPos.x + existingWidth, y: dominoCenterY - 25, horizontal: true });
            }
        }
        
        // Check top - use actual top end position, or spinner position if both side arms are filled
        let topPos = null;
        if (boardEnds.top !== null && endPositions.top && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) {
            topPos = endPositions.top;
        } else if (leftArmFilled && rightArmFilled && boardEnds.top === null && boardDominoes.length > 0) {
            const spinner = boardDominoes[0];
            const spinnerTop = spinner.domino.top;
            if (domino.top === spinnerTop || domino.bottom === spinnerTop) {
                topPos = { x: spinner.x, y: spinner.y, isHorizontal: spinner.isHorizontal };
            }
        }

        if (topPos) {
            const dominoCenterX = topPos.x + (topPos.isHorizontal ? 50 : 25);
            const dominoCenterY = topPos.y + (topPos.isHorizontal ? 25 : 50);

            // Doubles should be placed horizontally (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceHorizontally = isDouble;

            if (shouldPlaceHorizontally) {
                // Horizontal placement for doubles on top
                const newHeight = 50; // Height of horizontal domino being placed
                validMoves.push({ domino, side: 'top', x: dominoCenterX - 50, y: topPos.y - newHeight, width: 100, height: 50, horizontal: true });
            } else {
                // Vertical placement for non-doubles on top
                const newHeight = 100; // Height of vertical domino being placed
                validMoves.push({ domino, side: 'top', x: dominoCenterX - 25, y: topPos.y - newHeight, horizontal: false });
            }
        }
        
        // Check bottom - use actual bottom end position, or spinner position if both side arms are filled
        let bottomPos = null;
        if (boardEnds.bottom !== null && endPositions.bottom && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom)) {
            bottomPos = endPositions.bottom;
        } else if (leftArmFilled && rightArmFilled && boardEnds.bottom === null && boardDominoes.length > 0) {
            const spinner = boardDominoes[0];
            const spinnerBottom = spinner.domino.bottom;
            if (domino.top === spinnerBottom || domino.bottom === spinnerBottom) {
                bottomPos = { x: spinner.x, y: spinner.y, isHorizontal: spinner.isHorizontal };
            }
        }

        if (bottomPos) {
            const dominoCenterX = bottomPos.x + (bottomPos.isHorizontal ? 50 : 25);
            const dominoCenterY = bottomPos.y + (bottomPos.isHorizontal ? 25 : 50);

            // Doubles should be placed horizontally (perpendicular to chain direction)
            const isDouble = domino.top === domino.bottom;
            const shouldPlaceHorizontally = isDouble;

            if (shouldPlaceHorizontally) {
                const existingHeight = bottomPos.isHorizontal ? 50 : 100;
                validMoves.push({ domino, side: 'bottom', x: dominoCenterX - 50, y: bottomPos.y + existingHeight, horizontal: true });
            } else {
                // Vertical placement for non-doubles on bottom
                const existingHeight = bottomPos.isHorizontal ? 50 : 100;
                validMoves.push({ domino, side: 'bottom', x: dominoCenterX - 25, y: bottomPos.y + existingHeight, horizontal: false });
            }
        }
    });
    
    if (validMoves.length > 0) {
        // Calculate score for each move
        validMoves.forEach(move => {
            move.score = simulateMoveScore(move.domino, move.side);
        });

        // Prioritize scoring moves, then highest doubles, then highest total value
        validMoves.sort((a, b) => {
            // Prefer moves that score points
            if (a.score > 0 && b.score === 0) return -1;
            if (a.score === 0 && b.score > 0) return 1;
            if (a.score > 0 && b.score > 0) return b.score - a.score;

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
        
        // Find the highest priority moves (same score, domino value and double status)
        const bestScore = validMoves[0].score;
        const bestValue = validMoves[0].domino.top + validMoves[0].domino.bottom;
        const bestIsDouble = validMoves[0].domino.top === validMoves[0].domino.bottom;
        const bestMoves = validMoves.filter(m => {
            const isDouble = m.domino.top === m.domino.bottom;
            const value = m.domino.top + m.domino.bottom;
            return m.score === bestScore && isDouble === bestIsDouble && value === bestValue;
        });
        
        // Randomly choose from the best moves to avoid always picking the same side
        const randomIndex = Math.floor(Math.random() * bestMoves.length);
        const bestMove = bestMoves[randomIndex];
        placeDomino(bestMove.domino, bestMove.side, bestMove.x, bestMove.y, bestMove.horizontal);
    } else {
        if (boneyard.length > 0) {
            const drawnDomino = boneyard.pop();
            cpuDominoes.push(drawnDomino);
            updateBoneyardCount();
            playDrawSound();
            recordMove();
            setTimeout(cpuPlay, 500);
        } else {
            isPlayerTurn = true;
            updateBoneyardCount();
            updateDrawButton();
            recordPass();
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

function focusOnBoardPoint(boardX, boardY, boardWidth, boardHeight, zoom) {
    const container = getBoardContainer();
    const board = getBoardElement();
    if (!container || !board) return;

    if (zoom === undefined) {
        zoom = isMobileView() ? MOBILE_FOCUS_ZOOM : FOCUS_ZOOM;
    }

    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    const dominoCenterX = centerX - board.offsetWidth / 2 + boardX + boardWidth / 2;
    const dominoCenterY = centerY - board.offsetHeight / 2 + boardY + boardHeight / 2;
    const targetX = -(dominoCenterX - centerX) * zoom;
    const targetY = -(dominoCenterY - centerY) * zoom;

    const currentDominoScreen = boardToScreen(boardX + boardWidth / 2, boardY + boardHeight / 2);
    const offsetX = currentDominoScreen.x - centerX;
    const offsetY = currentDominoScreen.y - centerY;
    const dist = Math.hypot(offsetX, offsetY);
    const zoomDelta = Math.abs(camera.zoom - zoom);

    if (dist < 30 && zoomDelta < 0.08) return;

    const duration = isMobileView() ? 380 : 480;
    animateCameraTo(targetX, targetY, zoom, duration);
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
        resumeAudio();
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

function resumeAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function playTone(frequency, duration, volume, type = 'sine') {
    if (!audioContext) return;
    resumeAudio();

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.log('Error playing sound:', e);
    }
}

function playDominoSound() {
    playTone(520, 0.12, 0.28);
    setTimeout(() => playTone(780, 0.08, 0.18), 40);
}

function playSelectSound() {
    playTone(640, 0.07, 0.16);
}


function playDrawSound() {
    playTone(340, 0.08, 0.14);
    setTimeout(() => playTone(420, 0.1, 0.12), 60);
}

function playPassSound() {
    playTone(280, 0.1, 0.1, 'triangle');
}

function playWinSound() {
    [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.18, 0.22), i * 120);
    });
}

function playLoseSound() {
    [440, 370, 311, 261].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, 0.18, 'triangle'), i * 140);
    });
}

function playDrawGameSound() {
    playTone(440, 0.15, 0.16);
    setTimeout(() => playTone(440, 0.15, 0.16), 200);
}

function playScoreSound() {
    playTone(880, 0.1, 0.2);
    setTimeout(() => playTone(1100, 0.1, 0.15), 80);
}

document.addEventListener('DOMContentLoaded', init);
