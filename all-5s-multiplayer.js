// Multiplayer All 5s Dominoes using PeerJS

let peer = null;
let conn = null;
let myPeerId = null;
let opponentPeerId = null;
let isHost = false;

let playerDominoes = [];
let opponentDominoes = [];
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
let isAllFivesMode = true;
let playerScore = 0;
let opponentScore = 0;
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
let leftArmFilled = false;
let rightArmFilled = false;

const GAME_HINTS = [
    'Edge arrows point to off-screen moves',
    'Drag the board to look around',
    'Highest double starts — play it in the center',
    'Tap a tile, then tap a highlighted spot to play',
    'Empty your hand first to win the round'
];

// Lobby Management
document.getElementById('createLobbyBtn').addEventListener('click', createLobby);
document.getElementById('joinLobbyBtn').addEventListener('click', () => {
    document.getElementById('joinSection').classList.remove('hidden');
});
document.getElementById('joinGameBtn').addEventListener('click', joinLobby);

function createLobby() {
    isHost = true;
    peer = new Peer();
    
    peer.on('open', (id) => {
        myPeerId = id;
        document.getElementById('lobbyIdDisplay').textContent = id;
        document.getElementById('lobbyInfo').classList.remove('hidden');
        document.querySelector('.lobby-buttons').classList.add('hidden');
    });
    
    peer.on('connection', (connection) => {
        conn = connection;
        opponentPeerId = conn.peer;
        setupConnectionHandlers();
        
        conn.on('open', () => {
            document.getElementById('connectionStatus').textContent = 'Opponent connected! Starting game...';
            
            setTimeout(() => {
                startGame();
            }, 1000);
        });
    });
    
    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        document.getElementById('connectionStatus').textContent = 'Error: ' + err.message;
    });
}

function joinLobby() {
    const lobbyId = document.getElementById('lobbyIdInput').value.trim();
    if (!lobbyId) {
        alert('Please enter a Lobby ID');
        return;
    }
    
    isHost = false;
    opponentPeerId = lobbyId;
    peer = new Peer();
    
    peer.on('open', (id) => {
        myPeerId = id;
        conn = peer.connect(opponentPeerId);
        setupConnectionHandlers();
    });
    
    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        document.getElementById('connectionStatus').textContent = 'Error: ' + err.message;
    });
}

function setupConnectionHandlers() {
    conn.on('open', () => {
        document.getElementById('connectionStatus').textContent = 'Connected!';
        
        if (!isHost) {
            // Client waits for host to start game
            document.getElementById('connectionStatus').textContent = 'Waiting for host to start...';
        }
    });
    
    conn.on('data', (data) => {
        handleNetworkMessage(data);
    });
    
    conn.on('close', () => {
        document.getElementById('connectionStatus').textContent = 'Opponent disconnected';
        setTimeout(() => location.reload(), 3000);
    });
    
    conn.on('error', (err) => {
        console.error('Connection error:', err);
    });
}

function handleNetworkMessage(data) {
    console.log('Received message:', data);
    switch (data.type) {
        case 'START_GAME':
            console.log('START_GAME data:', data);
            // Data is now flattened: { type, dominoSet, starter, isHostTurn }
            if (data && data.dominoSet && data.starter) {
                initializeGameState(data);
            } else {
                console.error('Invalid START_GAME message - missing required fields:', data);
            }
            break;
        case 'PLAY_DOMINO':
            handleOpponentPlay(data);
            break;
        case 'DRAW_DOMINO':
            handleOpponentDraw();
            break;
        case 'PASS':
            handleOpponentPass();
            break;
        case 'GAME_OVER':
            handleGameOver(data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function sendToOpponent(data) {
    if (conn && conn.open) {
        console.log('Sending to opponent:', data);
        conn.send(data);
    } else {
        console.error('Cannot send - connection not open:', conn);
    }
}

function startGame() {
    initializeBoard();
    
    // Create and shuffle domino set
    const allDominoes = createDominoSet();
    playerDominoes = allDominoes.slice(0, 7);
    opponentDominoes = allDominoes.slice(7, 14);
    boneyard = allDominoes.slice(14);
    updateBoneyardCount();
    
    const starter = findStarter(playerDominoes, opponentDominoes);
    startingDomino = starter.domino;
    isPlayerTurn = starter.owner === 'player';
    
    // Send game state to opponent (flatten to avoid serialization issues)
    const message = {
        type: 'START_GAME',
        dominoSet: allDominoes,
        starter: starter,
        isHostTurn: isPlayerTurn
    };
    
    console.log('Sending START_GAME:', message);
    sendToOpponent(message);
    
    showGameScreen();
    renderRacks();
    showTurnIndicator(starter);
    setupTouchScrolling();
    initAudio();
    document.getElementById('drawBtn').addEventListener('click', drawFromBoneyard);
    centerCameraOnBoard();
    handlePlayerTurnStart();
    setupHintSystem();
    setupGameOverHandlers();
    
    if (!isPlayerTurn) {
        document.getElementById('turnIndicator').textContent = "Opponent's turn";
    }
}

function initializeGameState(data) {
    console.log('initializeGameState called with:', data);
    initializeBoard();
    
    // Use the same domino set as host
    const allDominoes = data.dominoSet;
    playerDominoes = allDominoes.slice(7, 14); // Client gets second 7 dominoes
    opponentDominoes = []; // Will be updated as opponent plays
    boneyard = allDominoes.slice(14);
    updateBoneyardCount();
    
    startingDomino = data.starter.domino;
    isPlayerTurn = !data.isHostTurn; // Opposite of host's turn
    
    showGameScreen();
    renderRacks();
    showTurnIndicator(data.starter);
    setupTouchScrolling();
    initAudio();
    document.getElementById('drawBtn').addEventListener('click', drawFromBoneyard);
    centerCameraOnBoard();
    handlePlayerTurnStart();
    setupHintSystem();
    setupGameOverHandlers();
    
    if (!isPlayerTurn) {
        document.getElementById('turnIndicator').textContent = "Opponent's turn";
    }
}

function showGameScreen() {
    const lobbyScreen = document.getElementById('lobbyScreen');
    const gameScreen = document.getElementById('gameScreen');
    const domino3d = document.querySelectorAll('.domino-3d');
    
    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    if (gameScreen) gameScreen.classList.remove('hidden');
    
    // Hide 3D background dominoes
    domino3d.forEach(el => el.classList.add('hidden'));
    
    // Remove lobby-mode class to use game CSS
    document.body.classList.remove('lobby-mode');
}

// Game Logic (adapted from all-fives-game.js)

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
}

// dealDominoes is no longer used - dominoes are dealt in startGame
function dealDominoes() {
    const allDominoes = createDominoSet();
    playerDominoes = allDominoes.slice(0, 7);
    opponentDominoes = allDominoes.slice(7, 14);
    boneyard = allDominoes.slice(14);
    updateBoneyardCount();
}

function getBoardElement() {
    return document.getElementById('board');
}

function findStarter(playerHand, cpuHand) {
    const allDominoes = [...playerHand, ...cpuHand];
    const doubles = allDominoes.filter(d => d.top === d.bottom);
    
    if (doubles.length === 0) {
        const highest = allDominoes.reduce((max, d) => {
            const value = d.top + d.bottom;
            return value > (max.top + max.bottom) ? d : max;
        });
        return {
            domino: highest,
            owner: playerHand.includes(highest) ? 'player' : 'cpu'
        };
    }
    
    const highestDouble = doubles.reduce((max, d) => {
        return d.top > max.top ? d : max;
    });
    
    return {
        domino: highestDouble,
        owner: playerHand.includes(highestDouble) ? 'player' : 'cpu'
    };
}

function renderRacks() {
    const rack = document.getElementById('playerRack');
    if (!rack) return;
    
    rack.innerHTML = '';
    playerDominoes.forEach(domino => {
        const el = createDominoElement(domino, false, 'player');
        el.addEventListener('click', () => selectDomino(domino, el));
        rack.appendChild(el);
    });
    
    updateRackScrollIndicators();
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
    container.setAttribute('data-value', value);
    
    for (let i = 0; i < 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        container.appendChild(pip);
    }
    
    return container;
}

function selectDomino(domino, element) {
    if (!isPlayerTurn || gameOver) return;
    
    selectedDomino = domino;
    document.querySelectorAll('.domino').forEach(d => d.classList.remove('selected'));
    element.classList.add('selected');
    
    showPlacementZones(domino);
}

function showPlacementZones(domino) {
    clearZones();
    
    if (boardDominoes.length === 0) {
        // First domino - place in center
        createZone('center', 400, 300, 50, 100, domino);
        isShowingZones = true;
        return;
    }
    
    const placements = findValidPlacementsForDomino(domino);
    placements.forEach(placement => {
        const width = placement.isHorizontal ? 100 : 50;
        const height = placement.isHorizontal ? 50 : 100;
        createZone(placement.side, placement.x, placement.y, width, height, domino);
    });
    
    isShowingZones = placements.length > 0;
}

function findValidPlacementsForDomino(domino) {
    const placements = [];
    
    if (boardDominoes.length === 0) {
        return [{ side: 'center', x: 400, y: 300, isHorizontal: false }];
    }
    
    // Check left end
    if (boardEnds.left !== null) {
        if (domino.top === boardEnds.left || domino.bottom === boardEnds.left) {
            const isHorizontal = boardEnds.left === boardEnds.right;
            placements.push({
                side: 'left',
                x: endPositions.left.x - (isHorizontal ? 100 : 50),
                y: endPositions.left.y,
                isHorizontal: !isHorizontal
            });
        }
    }
    
    // Check right end
    if (boardEnds.right !== null) {
        if (domino.top === boardEnds.right || domino.bottom === boardEnds.right) {
            const isHorizontal = boardEnds.right === boardEnds.left;
            placements.push({
                side: 'right',
                x: endPositions.right.x + (isHorizontal ? 100 : 50),
                y: endPositions.right.y,
                isHorizontal: !isHorizontal
            });
        }
    }
    
    // Check top (spinner)
    if (boardEnds.top !== null && leftArmFilled && rightArmFilled) {
        if (domino.top === boardEnds.top || domino.bottom === boardEnds.top) {
            placements.push({
                side: 'top',
                x: endPositions.top.x,
                y: endPositions.top.y - 50,
                isHorizontal: true
            });
        }
    }
    
    // Check bottom (spinner)
    if (boardEnds.bottom !== null && leftArmFilled && rightArmFilled) {
        if (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom) {
            placements.push({
                side: 'bottom',
                x: endPositions.bottom.x,
                y: endPositions.bottom.y + 50,
                isHorizontal: true
            });
        }
    }
    
    return placements;
}

function createZone(side, x, y, width, height, domino) {
    const zone = document.createElement('div');
    zone.className = 'placement-zone';
    zone.style.left = x + 'px';
    zone.style.top = y + 'px';
    zone.style.width = width + 'px';
    zone.style.height = height + 'px';
    zone.dataset.side = side;
    zone.dataset.x = x;
    zone.dataset.y = y;
    
    zone.addEventListener('click', () => {
        playDomino(domino, side, x, y, width === 100);
    });
    
    getBoardElement().appendChild(zone);
}

function clearZones() {
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    isShowingZones = false;
}

function playDomino(domino, side, x, y, isHorizontal) {
    if (!isPlayerTurn || gameOver) return;
    
    // Remove from hand
    playerDominoes = playerDominoes.filter(d => d.id !== domino.id);
    
    // Place on board
    placeDominoOnBoard(domino, side, x, y, isHorizontal);
    
    // Calculate score
    const scoreResult = calculateScoreFromEnds(side);
    if (scoreResult.score > 0) {
        playerScore += scoreResult.score;
        document.getElementById('playerScore').textContent = playerScore;
        updateScoringBreakdown(scoreResult.breakdown, scoreResult.score);
    } else {
        clearScoringBreakdown();
    }
    
    // Send to opponent
    sendToOpponent({
        type: 'PLAY_DOMINO',
        domino: domino,
        side: side,
        x: x,
        y: y,
        isHorizontal: isHorizontal,
        score: scoreResult.score
    });
    
    // End turn
    isPlayerTurn = false;
    selectedDomino = null;
    clearZones();
    renderRacks();
    checkGameEndAfterMove(true);
    
    if (!gameOver) {
        document.getElementById('turnIndicator').textContent = "Opponent's turn";
        document.getElementById('turnIndicator').classList.remove('hidden');
    }
}

function handleOpponentPlay(data) {
    const { domino, side, x, y, isHorizontal, score } = data;
    
    // Remove from opponent's hand (we track what they've played)
    opponentDominoes = opponentDominoes.filter(d => d.id !== domino.id);
    
    // Place on board
    placeDominoOnBoard(domino, side, x, y, isHorizontal);
    
    // Update opponent score
    if (score > 0) {
        opponentScore += score;
        document.getElementById('opponentScore').textContent = opponentScore;
    }
    
    // End their turn
    isPlayerTurn = true;
    document.getElementById('turnIndicator').textContent = "Your turn";
    document.getElementById('turnIndicator').classList.remove('hidden');
    
    handlePlayerTurnStart();
}

function placeDominoOnBoard(domino, side, x, y, isHorizontal) {
    const board = getBoardElement();
    
    const dominoWidth = isHorizontal ? 100 : 50;
    const dominoHeight = isHorizontal ? 50 : 100;
    
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
        } else {
            if (side === 'top') {
                if (domino.bottom === matchingEnd) {
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.top === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            } else if (side === 'bottom') {
                if (domino.top === matchingEnd) {
                    orientedDomino = { top: domino.top, bottom: domino.bottom, id: domino.id };
                } else if (domino.bottom === matchingEnd) {
                    orientedDomino = { top: domino.bottom, bottom: domino.top, id: domino.id };
                }
            }
        }
    }
    
    const el = createDominoElement(orientedDomino, isHorizontal, 'cpu');
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    board.appendChild(el);
    
    boardDominoes.push({
        domino: orientedDomino,
        x: x,
        y: y,
        isHorizontal: isHorizontal
    });
    
    if (side === 'center') {
        boardEnds.left = orientedDomino.top;
        boardEnds.right = orientedDomino.bottom;
        endPositions.left = { x: x, y: y + 50 };
        endPositions.right = { x: x + (isHorizontal ? 100 : 50), y: y + 50 };
        leftArmFilled = true;
        rightArmFilled = true;
    } else if (side === 'left') {
        boardEnds.left = orientedDomino.top;
        endPositions.left = { x: x, y: y + 50 };
        leftArmFilled = true;
    } else if (side === 'right') {
        boardEnds.right = orientedDomino.bottom;
        endPositions.right = { x: x + (isHorizontal ? 100 : 50), y: y + 50 };
        rightArmFilled = true;
    } else if (side === 'top') {
        boardEnds.top = orientedDomino.top;
        endPositions.top = { x: x, y: y };
    } else if (side === 'bottom') {
        boardEnds.bottom = orientedDomino.bottom;
        endPositions.bottom = { x: x, y: y + 50 };
    }
    
    updateLastPlayedDomino(orientedDomino);
}

function getMatchingEndForSide(side) {
    switch (side) {
        case 'left': return boardEnds.left;
        case 'right': return boardEnds.right;
        case 'top': return boardEnds.top;
        case 'bottom': return boardEnds.bottom;
        default: return null;
    }
}

function calculateScoreFromEnds(playedSide) {
    let sum = 0;
    let breakdown = [];
    
    const sideArmsFilled = (leftArmFilled ? 1 : 0) + (rightArmFilled ? 1 : 0);
    
    if (sideArmsFilled < 2) {
        const spinner = boardDominoes[0];
        if (spinner) {
            sum += spinner.domino.top;
            sum += spinner.domino.bottom;
            breakdown.push({ side: 'spinner-top', value: spinner.domino.top, counted: spinner.domino.top });
            breakdown.push({ side: 'spinner-bottom', value: spinner.domino.bottom, counted: spinner.domino.bottom });
        }
    } else if (sideArmsFilled === 2 && boardEnds.top === null && boardEnds.bottom === null) {
        // Don't add anything
    } else {
        if (boardEnds.top !== null) {
            sum += boardEnds.top;
            breakdown.push({ side: 'top', value: boardEnds.top, counted: boardEnds.top });
        }
        if (boardEnds.bottom !== null) {
            sum += boardEnds.bottom;
            breakdown.push({ side: 'bottom', value: boardEnds.bottom, counted: boardEnds.bottom });
        }
    }
    
    if (boardEnds.left !== null && leftArmFilled) {
        sum += boardEnds.left;
        breakdown.push({ side: 'left', value: boardEnds.left, counted: boardEnds.left });
    }
    
    if (boardEnds.right !== null && rightArmFilled) {
        sum += boardEnds.right;
        breakdown.push({ side: 'right', value: boardEnds.right, counted: boardEnds.right });
    }
    
    if (sum % 5 === 0) {
        return { score: sum, breakdown };
    }
    return { score: 0, breakdown: [] };
}

function updateLastPlayedDomino(domino) {
    const container = document.getElementById('lastPlayedDomino');
    container.innerHTML = '';
    
    const topHalf = document.createElement('div');
    topHalf.className = 'last-played-half';
    topHalf.appendChild(createLastPlayedPips(domino.top));
    
    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'last-played-half';
    bottomHalf.appendChild(createLastPlayedPips(domino.bottom));
    
    container.appendChild(topHalf);
    container.appendChild(bottomHalf);
}

function createLastPlayedPips(value) {
    const container = document.createElement('div');
    container.className = 'last-played-pips';
    container.setAttribute('data-value', value);
    
    for (let i = 0; i < 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'last-played-pip';
        container.appendChild(pip);
    }
    
    return container;
}

function updateScoringBreakdown(breakdown, totalScore) {
    const container = document.getElementById('scoringBreakdown');
    const textEl = document.getElementById('scoringBreakdownText');
    
    if (!container || !textEl) return;
    
    container.classList.remove('hidden');
    
    if (breakdown.length === 0) {
        textEl.textContent = '-';
        return;
    }
    
    const nonZeroBreakdown = breakdown.filter(item => item.counted > 0);
    const parts = nonZeroBreakdown.map(item => item.counted.toString());
    
    textEl.textContent = `${parts.join(' , ')} = ${totalScore}`;
}

function clearScoringBreakdown() {
    const container = document.getElementById('scoringBreakdown');
    const textEl = document.getElementById('scoringBreakdownText');
    if (container && textEl) {
        container.classList.remove('hidden');
        textEl.textContent = '-';
    }
}

function drawFromBoneyard() {
    if (!isPlayerTurn || boneyard.length === 0 || gameOver) return;
    
    const drawnDomino = boneyard.pop();
    playerDominoes.push(drawnDomino);
    updateBoneyardCount();
    renderRacks();
    updateDrawButton();
    
    sendToOpponent({ type: 'DRAW_DOMINO' });
    
    // Check if player can play after drawing
    if (!hasAnyValidMove(playerDominoes) && boneyard.length === 0) {
        // Must pass
        passTurn();
    }
}

function handleOpponentDraw() {
    boneyard.pop();
    updateBoneyardCount();
}

function passTurn() {
    if (!isPlayerTurn || gameOver) return;
    
    sendToOpponent({ type: 'PASS' });
    
    isPlayerTurn = false;
    document.getElementById('turnIndicator').textContent = "Opponent's turn";
    document.getElementById('turnIndicator').classList.remove('hidden');
}

function handleOpponentPass() {
    isPlayerTurn = true;
    document.getElementById('turnIndicator').textContent = "Your turn";
    document.getElementById('turnIndicator').classList.remove('hidden');
    handlePlayerTurnStart();
}

function hasAnyValidMove(dominoes) {
    return dominoes.some(domino => findValidPlacementsForDomino(domino).length > 0);
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

function updateBoneyardCount() {
    const countEl = document.getElementById('boneyardCount');
    if (countEl) countEl.textContent = boneyard.length;
}

function handlePlayerTurnStart() {
    updateDrawButton();
    
    if (boardDominoes.length === 0 && startingDomino) {
        const hasStarter = playerDominoes.some(d => d.id === startingDomino.id);
        if (hasStarter) {
            return;
        }
    }
    
    if (!hasAnyValidMove(playerDominoes)) {
        if (boneyard.length > 0) {
            showToast('No valid moves. Draw from boneyard.');
        } else {
            showToast('No valid moves. Pass.');
            setTimeout(() => {
                if (!gameOver && isPlayerTurn) {
                    passTurn();
                }
            }, 1500);
        }
    }
}

function checkGameEndAfterMove(wasPlayerTurn) {
    if (gameOver) return;
    
    if (wasPlayerTurn && playerDominoes.length === 0) {
        const playerPoints = roundDownToMultipleOf5(countPipsInHand(opponentDominoes));
        const opponentPoints = 0;
        endGame('win', 'You played all your dominoes!', playerPoints, opponentPoints, opponentDominoes);
        return;
    }
    if (!wasPlayerTurn && opponentDominoes.length === 0) {
        const playerPoints = 0;
        const opponentPoints = roundDownToMultipleOf5(countPipsInHand(playerDominoes));
        endGame('lose', 'Opponent played all their dominoes.', playerPoints, opponentPoints, playerDominoes);
    }
}

function countPipsInHand(dominoes) {
    return dominoes.reduce((total, domino) => total + domino.top + domino.bottom, 0);
}

function roundDownToMultipleOf5(value) {
    const rounded = Math.floor(value / 5) * 5;
    return rounded === 0 && value > 0 ? 5 : rounded;
}

function endGame(result, message, playerPoints = 0, opponentPoints = 0, opponentDominoes = []) {
    if (gameOver) return;
    gameOver = true;
    
    // Add points
    playerScore += playerPoints;
    opponentScore += opponentPoints;
    
    document.getElementById('playerScore').textContent = playerScore;
    document.getElementById('opponentScore').textContent = opponentScore;
    
    // Send game over to opponent
    sendToOpponent({
        type: 'GAME_OVER',
        result: result === 'win' ? 'lose' : 'win',
        message: message,
        playerPoints: opponentPoints,
        opponentPoints: playerPoints
    });
    
    showGameOverOverlay(result, message, playerPoints, opponentPoints, opponentDominoes);
}

function handleGameOver(data) {
    if (gameOver) return;
    gameOver = true;
    
    playerScore += data.playerPoints;
    opponentScore += data.opponentPoints;
    
    document.getElementById('playerScore').textContent = playerScore;
    document.getElementById('opponentScore').textContent = opponentScore;
    
    showGameOverOverlay(data.result, data.message, data.playerPoints, data.opponentPoints, []);
}

function showGameOverOverlay(result, message, playerPoints, opponentPoints, opponentDominoes) {
    const overlay = document.getElementById('gameOverOverlay');
    const title = document.getElementById('gameOverTitle');
    const msg = document.getElementById('gameOverMessage');
    const scores = document.getElementById('gameOverScores');
    const dominoesContainer = document.getElementById('gameOverDominoes');
    
    if (result === 'win') {
        title.textContent = 'You Win!';
    } else {
        title.textContent = 'You Lose';
    }
    
    msg.textContent = message + ` Current Score — You: ${playerScore}  ·  Opponent: ${opponentScore}`;
    
    if (playerPoints > 0 || opponentPoints > 0) {
        scores.textContent = `Points this round — You: ${playerPoints}  ·  Opponent: ${opponentPoints}`;
    } else {
        scores.textContent = '';
    }
    
    if (opponentDominoes.length > 0) {
        dominoesContainer.innerHTML = '';
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
    
    overlay.classList.remove('hidden');
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

function setupGameOverHandlers() {
    document.getElementById('playAgainBtn').addEventListener('click', () => location.reload());
    document.getElementById('closeGameOverBtn').addEventListener('click', () => {
        document.getElementById('gameOverOverlay').classList.add('hidden');
        document.getElementById('newGameMiniBtn').classList.remove('hidden');
    });
    document.getElementById('newGameMiniBtn').addEventListener('click', () => location.reload());
}

function showTurnIndicator(starter) {
    const indicator = document.getElementById('turnIndicator');
    if (starter.owner === 'player') {
        indicator.textContent = "Your turn";
    } else {
        indicator.textContent = "Opponent's turn";
    }
    indicator.classList.remove('hidden');
}

function showToast(message) {
    const toast = document.getElementById('hintToast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

function setupHintSystem() {
    // Simplified hint system for multiplayer
}

function setupTouchScrolling() {
    // Touch scrolling implementation
}

function centerCameraOnBoard() {
    // Camera centering
}

function initAudio() {
    // Audio initialization
}

function updateRackScrollIndicators() {
    // Rack scroll indicators
}
