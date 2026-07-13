// Multiplayer All 5s Dominoes using PeerJS

const ADJECTIVES = [
    'drooping', 'jumping', 'sleepy', 'happy', 'angry', 'brave', 'calm', 'eager', 'fancy', 'gentle',
    'hasty', 'jolly', 'kind', 'lively', 'merry', 'noble', 'proud', 'quiet', 'rapid', 'silly',
    'swift', 'tiny', 'vivid', 'witty', 'young', 'zany', 'bold', 'bright', 'clever', 'daring',
    'elegant', 'fierce', 'graceful', 'humble', 'jolly', 'keen', 'lucky', 'mighty', 'neat',
    'polite', 'quick', 'royal', 'smart', 'tough', 'vivid', 'wise', 'zealous'
];

const NOUNS = [
    'dog', 'typhoon', 'eagle', 'tiger', 'lion', 'bear', 'wolf', 'fox', 'hawk', 'shark',
    'panther', 'leopard', 'cheetah', 'dolphin', 'whale', 'octopus', 'penguin', 'owl', 'raven',
    'cobra', 'python', 'falcon', 'stallion', 'mustang', 'badger', 'beaver', 'coyote', 'deer',
    'elk', 'moose', 'otter', 'seal', 'walrus', 'bison', 'caribou', 'antelope', 'gazelle',
    'lynx', 'bobcat', 'cougar', 'jaguar', 'ocelot', 'serval', 'caracal', 'sandcat', 'puma'
];

function generateLobbyCode() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj}-${noun}`;
}

let peer = null;
let conn = null;
let myPeerId = null;
let opponentPeerId = null;
let isHost = false;

// Chat and Video variables
let localStream = null;
let remoteStream = null;
let videoCall = null;
let chatVideoPanelOpen = false;

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
let openingDomino = null;
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
document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('createLobbyBtn');
    const joinBtn = document.getElementById('joinLobbyBtn');
    const joinGameBtn = document.getElementById('joinGameBtn');
    
    if (createBtn) createBtn.addEventListener('click', createLobby);
    if (joinBtn) joinBtn.addEventListener('click', showJoinSection);
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', () => {
            const lobbyId = document.getElementById('lobbyIdInput').value.trim();
            if (lobbyId) joinLobby();
            else alert('Please enter a Lobby ID');
        });
    }

    // Chat/Video Panel event listeners
    const burgerBtn = document.getElementById('burgerBtn');
    const closePanelBtn = document.getElementById('closePanelBtn');
    const panelTabs = document.querySelectorAll('.panel-tab');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatInput = document.getElementById('chatInput');
    const startVideoBtn = document.getElementById('startVideoBtn');
    const endVideoBtn = document.getElementById('endVideoBtn');

    if (burgerBtn) {
        burgerBtn.addEventListener('click', toggleChatVideoPanel);
    }

    if (closePanelBtn) {
        closePanelBtn.addEventListener('click', toggleChatVideoPanel);
    }

    panelTabs.forEach(tab => {
        tab.addEventListener('click', () => switchPanelTab(tab.dataset.tab));
    });

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendChatMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    if (startVideoBtn) {
        startVideoBtn.addEventListener('click', startVideoCall);
    }

    if (endVideoBtn) {
        endVideoBtn.addEventListener('click', endVideoCall);
    }
});

function showJoinSection() {
    document.getElementById('joinSection').classList.remove('hidden');
}

function createLobby() {
    if (typeof Peer === 'undefined') {
        alert('PeerJS not loaded. Please refresh the page.');
        return;
    }
    
    isHost = true;
    const customLobbyCode = generateLobbyCode();
    
    peer = new Peer(customLobbyCode, {
        debug: 1
    });
    
    peer.on('open', (id) => {
        console.log('Peer opened with ID:', id);
        myPeerId = id;
        document.getElementById('lobbyIdDisplay').textContent = myPeerId;
        document.getElementById('connectionStatus').textContent = 'Waiting for opponent...';
        document.getElementById('lobbyInfo').classList.remove('hidden');
    });
    
    peer.on('disconnected', () => {
        console.log('Peer disconnected from server');
        document.getElementById('connectionStatus').textContent = 'Disconnected from server. Reconnecting...';
        peer.reconnect();
    });
    
    peer.on('connection', (connection) => {
        conn = connection;
        opponentPeerId = conn.peer;
        setupConnectionHandlers();
        
        conn.on('open', () => {
            document.getElementById('connectionStatus').textContent = 'Opponent connected! Starting game...';
            setTimeout(() => startGame(), 1000);
        });
    });
    
    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        document.getElementById('connectionStatus').textContent = 'Error: ' + err.type + ' - ' + err.message;
    });
}

function joinLobby() {
    const lobbyId = document.getElementById('lobbyIdInput').value.trim();
    
    if (!lobbyId) {
        alert('Please enter a Lobby ID');
        return;
    }
    
    if (typeof Peer === 'undefined') {
        alert('PeerJS not loaded. Please refresh the page.');
        return;
    }
    
    isHost = false;
    opponentPeerId = lobbyId;
    
    peer = new Peer(null, {
        debug: 1
    });
    
    peer.on('open', (id) => {
        console.log('Peer opened with ID:', id);
        myPeerId = id;
        conn = peer.connect(opponentPeerId);
        setupConnectionHandlers();
    });
    
    peer.on('disconnected', () => {
        console.log('Peer disconnected from server');
        document.getElementById('connectionStatus').textContent = 'Disconnected from server. Reconnecting...';
        peer.reconnect();
    });
    
    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        document.getElementById('connectionStatus').textContent = 'Error: ' + err.type + ' - ' + err.message;
    });
}

function setupConnectionHandlers() {
    conn.on('data', (data) => {
        handleNetworkMessage(data);
    });
    
    conn.on('close', () => {
        document.getElementById('connectionStatus').textContent = 'Opponent disconnected';
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
        case 'CHAT_MESSAGE':
            receiveChatMessage(data);
            break;
        case 'VIDEO_CALL_REQUEST':
            handleVideoCallRequest();
            break;
        case 'VIDEO_CALL_OFFER':
            handleVideoCallOffer(data);
            break;
        case 'VIDEO_CALL_ANSWER':
            handleVideoCallAnswer(data);
            break;
        case 'VIDEO_CALL_ICE':
            handleVideoCallIce(data);
            break;
        case 'VIDEO_CALL_END':
            handleVideoCallEnd();
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
    
    const allDominoes = createDominoSet();
    playerDominoes = allDominoes.slice(0, 7);
    opponentDominoes = allDominoes.slice(7, 14);
    boneyard = allDominoes.slice(14);
    updateBoneyardCount();
    
    const starter = findStarter(playerDominoes, opponentDominoes);
    setupOpeningTurn(starter.domino, starter.owner === 'player');
    
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
    showTurnIndicator();
    setupTouchScrolling();
    initAudio();
    document.getElementById('drawBtn').addEventListener('click', drawFromBoneyard);
    centerCameraOnBoard();
    handlePlayerTurnStart();
    setupHintSystem();
    setupGameOverHandlers();
}

function initializeGameState(data) {
    console.log('initializeGameState called with:', data);
    initializeBoard();
    
    const allDominoes = data.dominoSet;
    playerDominoes = allDominoes.slice(7, 14);
    opponentDominoes = [];
    boneyard = allDominoes.slice(14);
    updateBoneyardCount();
    
    setupOpeningTurn(data.starter.domino, data.isHostTurn);
    
    showGameScreen();
    renderRacks();
    showTurnIndicator();
    setupTouchScrolling();
    initAudio();
    document.getElementById('drawBtn').addEventListener('click', drawFromBoneyard);
    centerCameraOnBoard();
    handlePlayerTurnStart();
    setupHintSystem();
    setupGameOverHandlers();
}

function showGameScreen() {
    const lobbyScreen = document.getElementById('lobbyScreen');
    const gameScreen = document.getElementById('gameScreen');
    const domino3d = document.querySelectorAll('.domino-3d');
    const burgerBtn = document.getElementById('burgerBtn');

    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    if (gameScreen) gameScreen.classList.remove('hidden');

    domino3d.forEach(el => el.classList.add('hidden'));

    document.body.classList.remove('lobby-mode');

    // Show burger button when game starts
    if (burgerBtn) burgerBtn.classList.remove('hidden');

    // Update chat/video connection status
    updateChatVideoConnectionStatus(true);
}

function handleOpponentPlay(data) {
    const { domino, side, x, y, isHorizontal, score } = data;
    
    opponentDominoes = opponentDominoes.filter(d => d.id !== domino.id);
    
    clearActivePlacement();
    placeDominoOnBoard(domino, side, x, y, isHorizontal);
    
    if (side === 'center') {
        startingDomino = null;
    }
    dismissStarterOverlay();
    
    if (score > 0) {
        opponentScore += score;
        document.getElementById('opponentScore').textContent = opponentScore;
    }
    
    isPlayerTurn = true;
    
    renderRacks();
    updateRackState();
    handlePlayerTurnStart();
}

function handleOpponentDraw() {
    boneyard.pop();
    updateBoneyardCount();
    
    isPlayerTurn = true;
    dismissStarterOverlay();
    updateRackState();
    handlePlayerTurnStart();
}

function handleOpponentPass() {
    isPlayerTurn = true;
    dismissStarterOverlay();
    updateRackState();
    handlePlayerTurnStart();
}

function handleGameOver(data) {
    const { result, message, playerPoints, opponentPoints } = data;
    endGame(result, message, playerPoints, opponentPoints, []);
}

function setupGameOverHandlers() {
    document.getElementById('playAgainBtn').addEventListener('click', () => location.reload());
}

// Game Logic (adapted from all-fives-game.js)

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

function addScore(isPlayer, points) {
    if (isPlayer) {
        playerScore += points;
        const scoreEl = document.getElementById('playerScore');
        if (scoreEl) scoreEl.textContent = playerScore;
    } else {
        opponentScore += points;
        const scoreEl = document.getElementById('opponentScore');
        if (scoreEl) scoreEl.textContent = opponentScore;
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
            breakdown.push({ side: 'spinner-top', value: spinner.domino.top, isDouble: false, counted: spinner.domino.top });
            breakdown.push({ side: 'spinner-bottom', value: spinner.domino.bottom, isDouble: false, counted: spinner.domino.bottom });
        }
    } else if (sideArmsFilled === 2 && boardEnds.top === null && boardEnds.bottom === null) {
    } else {
        if (boardEnds.top !== null) {
            const value = endIsDouble.top ? boardEnds.top * 2 : boardEnds.top;
            sum += value;
            breakdown.push({ side: 'top', value: boardEnds.top, isDouble: endIsDouble.top, counted: value });
        }
        if (boardEnds.bottom !== null) {
            const value = endIsDouble.bottom ? boardEnds.bottom * 2 : boardEnds.bottom;
            sum += value;
            breakdown.push({ side: 'bottom', value: boardEnds.bottom, isDouble: endIsDouble.bottom, counted: value });
        }
    }

    if (boardEnds.left !== null && leftArmFilled) {
        const value = endIsDouble.left ? boardEnds.left * 2 : boardEnds.left;
        sum += value;
        breakdown.push({ side: 'left', value: boardEnds.left, isDouble: endIsDouble.left, counted: value });
    }

    if (boardEnds.right !== null && rightArmFilled) {
        const value = endIsDouble.right ? boardEnds.right * 2 : boardEnds.right;
        sum += value;
        breakdown.push({ side: 'right', value: boardEnds.right, isDouble: endIsDouble.right, counted: value });
    }

    if (sum % 5 === 0) {
        return { score: sum, breakdown };
    }
    return { score: 0, breakdown: [] };
}

function simulateMoveScore(domino, side) {
    const matchingEnd = boardEnds[side];
    let newEnd = null;
    let newIsDouble = false;

    if (side === 'left' || side === 'right') {
        if (side === 'left') {
            newEnd = domino.bottom === matchingEnd ? domino.top : domino.bottom;
        } else {
            newEnd = domino.top === matchingEnd ? domino.bottom : domino.top;
        }
    } else {
        if (side === 'top') {
            newEnd = domino.bottom === matchingEnd ? domino.top : domino.bottom;
        } else {
            newEnd = domino.top === matchingEnd ? domino.bottom : domino.top;
        }
    }

    newIsDouble = (domino.top === domino.bottom);

    const simulatedEnds = { ...boardEnds };
    const simulatedIsDouble = { ...endIsDouble };
    simulatedEnds[side] = newEnd;
    simulatedIsDouble[side] = newIsDouble;

    let simLeftArmFilled = leftArmFilled;
    let simRightArmFilled = rightArmFilled;
    if (side === 'left') simLeftArmFilled = true;
    if (side === 'right') simRightArmFilled = true;

    let sum = 0;
    let breakdown = [];

    if (simulatedEnds.left !== null && simLeftArmFilled) {
        const value = simulatedIsDouble.left ? simulatedEnds.left * 2 : simulatedEnds.left;
        sum += value;
        breakdown.push({ side: 'left', value: simulatedEnds.left, isDouble: simulatedIsDouble.left, counted: value });
    }

    if (simulatedEnds.right !== null && simRightArmFilled) {
        const value = simulatedIsDouble.right ? simulatedEnds.right * 2 : simulatedEnds.right;
        sum += value;
        breakdown.push({ side: 'right', value: simulatedEnds.right, isDouble: simulatedIsDouble.right, counted: value });
    }

    const sideArmsFilled = (simLeftArmFilled ? 1 : 0) + (simRightArmFilled ? 1 : 0);

    if (sideArmsFilled < 2) {
        const spinner = boardDominoes[0];
        if (spinner) {
            sum += spinner.domino.top;
            sum += spinner.domino.bottom;
            breakdown.push({ side: 'spinner-top', value: spinner.domino.top, isDouble: false, counted: spinner.domino.top });
            breakdown.push({ side: 'spinner-bottom', value: spinner.domino.bottom, isDouble: false, counted: spinner.domino.bottom });
        }
    } else if (sideArmsFilled === 2 && simulatedEnds.top === null && simulatedEnds.bottom === null) {
    } else {
        if (simulatedEnds.top !== null) {
            const value = simulatedIsDouble.top ? simulatedEnds.top * 2 : simulatedEnds.top;
            sum += value;
            breakdown.push({ side: 'top', value: simulatedEnds.top, isDouble: simulatedIsDouble.top, counted: value });
        }
        if (simulatedEnds.bottom !== null) {
            const value = simulatedIsDouble.bottom ? simulatedEnds.bottom * 2 : simulatedEnds.bottom;
            sum += value;
            breakdown.push({ side: 'bottom', value: simulatedEnds.bottom, isDouble: simulatedIsDouble.bottom, counted: value });
        }
    }

    if (sum % 5 === 0) {
        return { score: sum, breakdown };
    }
    return { score: 0, breakdown: [] };
}

function setupOpeningTurn(openingTile, hostGoesFirst) {
    openingDomino = openingTile;
    const tileInHand = playerDominoes.find(d => d.id === openingTile.id);
    startingDomino = tileInHand || null;
    isPlayerTurn = isHost ? hostGoesFirst : !hostGoesFirst;
}

function findStarter(playerHand, opponentHand) {
    let bestDomino = null;
    let bestOwner = null;

    [
        { owner: 'player', hand: playerHand },
        { owner: 'opponent', hand: opponentHand }
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

function showTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    if (!indicator || boardDominoes.length > 0 || !openingDomino) return;

    if (isPlayerTurn && startingDomino) {
        const dominoLabel = formatDominoLabel(startingDomino);
        indicator.innerHTML = `<strong>You go first!</strong>Play your <span class="starter-domino-label">${dominoLabel}</span> in the center`;
    } else {
        indicator.innerHTML = `<strong>Opponent goes first</strong>`;
    }
    indicator.classList.remove('hidden');
}

function hideTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    if (indicator) indicator.classList.add('hidden');
}

function clearActivePlacement() {
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    document.querySelectorAll('.rack .domino').forEach(el => el.classList.remove('selected'));
    selectedDomino = null;
    isShowingZones = false;
}

function dismissStarterOverlay() {
    if (boardDominoes.length > 0) {
        hideTurnIndicator();
    }
}

function shiftBoardContent(shiftX, shiftY) {
    if (!shiftX && !shiftY) return;

    boardDominoes.forEach(placed => {
        placed.x += shiftX;
        placed.y += shiftY;
        const el = document.querySelector(`.domino[data-id="${placed.domino.id}"]`);
        if (el) {
            el.style.left = placed.x + 'px';
            el.style.top = placed.y + 'px';
        }
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

    playerRack.removeEventListener('scroll', updateRackScrollIndicators);
    playerRack.addEventListener('scroll', updateRackScrollIndicators);

    updateRackScrollIndicators();
    updateRackState();
}

function updateRackScrollIndicators() {
    const rack = document.getElementById('playerRack');
    const leftIndicator = document.getElementById('rackScrollLeft');
    const rightIndicator = document.getElementById('rackScrollRight');
    const leftLabel = document.getElementById('rackScrollLeftLabel');
    const rightLabel = document.getElementById('rackScrollRightLabel');

    if (!rack || playerDominoes.length === 0) {
        leftIndicator?.classList.add('hidden');
        rightIndicator?.classList.add('hidden');
        return;
    }

    const rackRect = rack.getBoundingClientRect();
    const dominoElements = rack.querySelectorAll('.domino');

    let firstVisibleIndex = -1;
    let lastVisibleIndex = -1;

    dominoElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.right > rackRect.left && rect.left < rackRect.right;

        if (isVisible) {
            if (firstVisibleIndex === -1) firstVisibleIndex = index;
            lastVisibleIndex = index;
        }
    });

    if (firstVisibleIndex > 0) {
        leftIndicator.classList.remove('hidden');
        const hiddenDomino = playerDominoes[firstVisibleIndex - 1];
        leftLabel.textContent = formatDominoLabel(hiddenDomino);
    } else {
        leftIndicator.classList.add('hidden');
    }

    if (lastVisibleIndex < playerDominoes.length - 1) {
        rightIndicator.classList.remove('hidden');
        const hiddenDomino = playerDominoes[lastVisibleIndex + 1];
        rightLabel.textContent = formatDominoLabel(hiddenDomino);
    } else {
        rightIndicator.classList.add('hidden');
    }
}

function updateLastPlayedDomino(domino) {
    const lastPlayedContainer = document.getElementById('lastPlayedDomino');
    if (!lastPlayedContainer) return;
    
    lastPlayedContainer.innerHTML = '';
    
    const topHalf = document.createElement('div');
    topHalf.className = 'last-played-domino-half';
    topHalf.appendChild(createPips(domino.top));
    
    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'last-played-domino-half';
    bottomHalf.appendChild(createPips(domino.bottom));
    
    lastPlayedContainer.appendChild(topHalf);
    lastPlayedContainer.appendChild(bottomHalf);
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
    if (container) {
        container.classList.remove('hidden');
    }
    if (textEl) {
        textEl.textContent = '-';
    }
}

function createMiniPips(value) {
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

function countPipsInHand(dominoes) {
    return dominoes.reduce((total, domino) => total + domino.top + domino.bottom, 0);
}

function roundDownToMultipleOf5(value) {
    const rounded = Math.floor(value / 5) * 5;
    return rounded === 0 && value > 0 ? 5 : rounded;
}

function checkZoneOverlap(zoneX, zoneY, zoneWidth, zoneHeight) {
    const padding = 2; // Small padding to prevent edge cases
    for (const placed of boardDominoes) {
        const placedWidth = placed.isHorizontal ? 100 : 50;
        const placedHeight = placed.isHorizontal ? 50 : 100;
        const placedRight = placed.x + placedWidth;
        const placedBottom = placed.y + placedHeight;
        const zoneRight = zoneX + zoneWidth;
        const zoneBottom = zoneY + zoneHeight;

        if (!(zoneRight + padding <= placed.x ||
              zoneX - padding >= placedRight ||
              zoneBottom + padding <= placed.y ||
              zoneY - padding >= placedBottom)) {
            return true;
        }
    }
    return false;
}

function getSpinnerArmMatch(side) {
    if (!leftArmFilled || !rightArmFilled || boardDominoes.length === 0) {
        return null;
    }

    const spinner = boardDominoes[0];
    if (side === 'top' && boardEnds.top === null) {
        return {
            matchingEnd: spinner.domino.top,
            x: spinner.x,
            y: spinner.y,
            isHorizontal: spinner.isHorizontal
        };
    }

    if (side === 'bottom' && boardEnds.bottom === null) {
        const attachHeight = spinner.isHorizontal ? 50 : 100;
        return {
            matchingEnd: spinner.domino.bottom,
            x: spinner.x,
            y: spinner.y + attachHeight,
            isHorizontal: spinner.isHorizontal
        };
    }

    return null;
}

function getMatchingEndForSide(side) {
    if (boardEnds[side] !== null) {
        return boardEnds[side];
    }

    const spinnerArm = getSpinnerArmMatch(side);
    return spinnerArm ? spinnerArm.matchingEnd : null;
}

function findValidPlacementsForDomino(domino) {
    console.log('Finding placements for domino:', domino);
    console.log('Board ends:', boardEnds);
    console.log('End positions:', endPositions);
    
    if (boardDominoes.length === 0) {
        if (!startingDomino || domino.id !== startingDomino.id) {
            console.log('Board empty but not starting domino');
            return [];
        }
        const placement = getFirstMovePlacement(domino);
        console.log('First move placement:', placement);
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
            } else {
                console.log('Left placement blocked by overlap for domino', domino);
            }
        } else {
            const zoneX = leftPos.x - 100;
            const zoneY = dominoCenterY - 25;
            if (!checkZoneOverlap(zoneX, zoneY, 100, 50)) {
                validZones.push({ side: 'left', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            } else {
                console.log('Left placement blocked by overlap for domino', domino);
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
            } else {
                console.log('Right placement blocked by overlap for domino', domino);
            }
        } else {
            const zoneX = rightPos.x;
            const zoneY = dominoCenterY - 25;
            if (!checkZoneOverlap(zoneX, zoneY, 100, 50)) {
                validZones.push({ side: 'right', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
            } else {
                console.log('Right placement blocked by overlap for domino', domino);
            }
        }
    }

    // Top and bottom placements only in All 5s mode (spinner)
    if (isAllFivesMode) {
        let topPos = null;
        if (boardEnds.top !== null && endPositions.top && (domino.top === boardEnds.top || domino.bottom === boardEnds.top)) {
            topPos = endPositions.top;
        } else {
            const spinnerTop = getSpinnerArmMatch('top');
            if (spinnerTop && (domino.top === spinnerTop.matchingEnd || domino.bottom === spinnerTop.matchingEnd)) {
                topPos = spinnerTop;
            }
        }

        if (topPos) {
            const dominoCenterX = topPos.x + (topPos.isHorizontal ? 50 : 25);
            const isDouble = domino.top === domino.bottom;

            if (isDouble) {
                const zoneX = dominoCenterX - 50;
                const zoneY = topPos.y - 50;
                if (!checkZoneOverlap(zoneX, zoneY, 100, 50)) {
                    validZones.push({ side: 'top', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
                } else {
                    console.log('Top placement blocked by overlap for domino', domino);
                }
            } else {
                const zoneX = dominoCenterX - 25;
                const zoneY = topPos.y - 100;
                if (!checkZoneOverlap(zoneX, zoneY, 50, 100)) {
                    validZones.push({ side: 'top', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
                } else {
                    console.log('Top placement blocked by overlap for domino', domino);
                }
            }
        }

        let bottomPos = null;
        if (boardEnds.bottom !== null && endPositions.bottom && (domino.top === boardEnds.bottom || domino.bottom === boardEnds.bottom)) {
            bottomPos = endPositions.bottom;
        } else {
            const spinnerBottom = getSpinnerArmMatch('bottom');
            if (spinnerBottom && (domino.top === spinnerBottom.matchingEnd || domino.bottom === spinnerBottom.matchingEnd)) {
                bottomPos = spinnerBottom;
            }
        }

        if (bottomPos) {
            const dominoCenterX = bottomPos.x + (bottomPos.isHorizontal ? 50 : 25);
            const isDouble = domino.top === domino.bottom;

            if (isDouble) {
                const zoneX = dominoCenterX - 50;
                const zoneY = bottomPos.y;
                if (!checkZoneOverlap(zoneX, zoneY, 100, 50)) {
                    validZones.push({ side: 'bottom', x: zoneX, y: zoneY, width: 100, height: 50, horizontal: true });
                } else {
                    console.log('Bottom placement blocked by overlap for domino', domino);
                }
            } else {
                const zoneX = dominoCenterX - 25;
                const zoneY = bottomPos.y;
                if (!checkZoneOverlap(zoneX, zoneY, 50, 100)) {
                    validZones.push({ side: 'bottom', x: zoneX, y: zoneY, width: 50, height: 100, horizontal: false });
                } else {
                    console.log('Bottom placement blocked by overlap for domino', domino);
                }
            }
        }
    }

    console.log('Found', validZones.length, 'valid zones for domino', domino, ':', validZones);
    return validZones;
}

function hasAnyValidMove(dominoes) {
    return dominoes.some(domino => findValidPlacementsForDomino(domino).length > 0);
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
    const opponentPips = countPipsInHand(opponentDominoes);

    if (playerPips < opponentPips) {
        const points = roundDownToMultipleOf5(opponentPips);
        endGame('win', 'Game blocked — you had fewer pips!', points, 0, opponentDominoes);
    } else if (opponentPips < playerPips) {
        const points = roundDownToMultipleOf5(playerPips);
        endGame('lose', 'Game blocked — opponent had fewer pips.', 0, points, playerDominoes);
    } else {
        endGame('draw', 'Game blocked — tied on remaining pips.', 0, 0, []);
    }
}

function checkGameEndAfterMove(wasPlayerTurn) {
    if (gameOver) return;

    if (wasPlayerTurn && playerDominoes.length === 0) {
        showDominoMessage();
        const playerPoints = roundDownToMultipleOf5(countPipsInHand(opponentDominoes));
        const opponentPoints = 0;
        endGame('win', 'You played all your dominoes!', playerPoints, opponentPoints, opponentDominoes);
        return;
    }
    if (!wasPlayerTurn && opponentDominoes.length === 0) {
        showDominoMessage();
        const playerPoints = 0;
        const opponentPoints = roundDownToMultipleOf5(countPipsInHand(playerDominoes));
        endGame('lose', 'Opponent played all their dominoes.', playerPoints, opponentPoints, playerDominoes);
    }
}

function showDominoMessage() {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Domino!');
        
        let voices = speechSynthesis.getVoices();
        
        if (voices.length === 0) {
            speechSynthesis.onvoiceschanged = () => {
                voices = speechSynthesis.getVoices();
                speakWithBestVoice(utterance, voices);
            };
        } else {
            speakWithBestVoice(utterance, voices);
        }
    }
}

function speakWithBestVoice(utterance, voices) {
    let selectedVoice = null;
    
    for (const voice of voices) {
        if (voice.name.includes('Natural') || 
            voice.name.includes('Google') || 
            voice.name.includes('Samantha') ||
            voice.name.includes('Daniel') ||
            voice.name.includes('Karen') ||
            voice.name.includes('Moira')) {
            selectedVoice = voice;
            break;
        }
    }
    
    if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang.startsWith('en'));
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    
    speechSynthesis.speak(utterance);
}

function endGame(result, message, playerPoints = 0, opponentPoints = 0, opponentDominoes = []) {
    if (gameOver) return;
    gameOver = true;

    document.querySelectorAll('.placement-zone').forEach(z => z.remove());
    clearZoneHintArrows();
    hideTurnIndicator();
    selectedDomino = null;

    playerScore += playerPoints;
    opponentScore += opponentPoints;

    const playerScoreEl = document.getElementById('playerScore');
    const opponentScoreEl = document.getElementById('opponentScore');
    if (playerScoreEl) playerScoreEl.textContent = playerScore;
    if (opponentScoreEl) opponentScoreEl.textContent = opponentScore;
    
    if (playerScore >= 100 || opponentScore >= 100) {
        const overlay = document.getElementById('gameOverOverlay');
        const title = document.getElementById('gameOverTitle');
        const msg = document.getElementById('gameOverMessage');
        const scores = document.getElementById('gameOverScores');
        const dominoesContainer = document.getElementById('gameOverDominoes');
        const playAgainBtn = document.getElementById('playAgainBtn');

        if (playerScore >= 100) {
            title.textContent = 'You Win!';
            playWinSound();
        } else {
            title.textContent = 'You Lose';
            playLoseSound();
        }

        msg.textContent = message + ` Final Score — You: ${playerScore}  ·  Opponent: ${opponentScore}`;
        scores.textContent = '';
        dominoesContainer.innerHTML = '';
        dominoesContainer.classList.add('hidden');
        playAgainBtn.style.display = 'block';
        overlay.classList.remove('hidden');
        return;
    }
    
    startNewHand(message, opponentDominoes);
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
    
    playSelectSound();
    
    requestAnimationFrame(() => {
        if (!isShowingZones) {
            isShowingZones = true;
            showValidPlacementZones(domino);
            isShowingZones = false;
            requestAnimationFrame(() => updateZoneHintArrows());
        }
    });
}

function updateRackState() {
    const rack = document.getElementById('playerRack');
    if (!rack) return;
    
    if (isPlayerTurn) {
        rack.classList.remove('disabled');
        rack.style.pointerEvents = 'auto';
        rack.style.opacity = '1';
    } else {
        rack.classList.add('disabled');
        rack.style.pointerEvents = 'none';
        rack.style.opacity = '0.5';
    }
}

function updateBoneyardCount() {
    document.getElementById('boneyardCount').textContent = boneyard.length;
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
    
    sendToOpponent({ type: 'DRAW_DOMINO' });
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

function handlePlayerTurnStart() {
    if (!isPlayerTurn || gameOver) return;

    updateDrawButton();

    if (!hasAnyValidMove(playerDominoes) && boneyard.length === 0) {
        isPlayerTurn = false;
        recordPass();
        sendToOpponent({ type: 'PASS' });
    }
}

function showValidPlacementZones(domino) {
    const board = document.getElementById('board');
    document.querySelectorAll('.placement-zone').forEach(z => z.remove());

    if (!isPlayerTurn) return;

    if (boardDominoes.length === 0) {
        // In PvP, if board is empty, only the player with the starting domino can play
        if (!startingDomino || domino.id !== startingDomino.id) {
            return;
        }
    }

    let validZones = findValidPlacementsForDomino(domino);

    const contentBounds = getBoardContentBounds(validZones);
    if (contentBounds) {
        const { shiftX, shiftY } = ensureBoardBounds(
            contentBounds.minX,
            contentBounds.minY,
            contentBounds.maxX,
            contentBounds.maxY,
            false
        );
        validZones = validZones.map(zone => ({
            ...zone,
            x: zone.x + shiftX,
            y: zone.y + shiftY
        }));
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
                playDomino(selectedDomino, zone.side, zone.x, zone.y, zone.horizontal);
            }
        });

        board.appendChild(zoneEl);
    });

    if (validZones.length === 0) {
        updateDrawButton();
    } else {
        requestAnimationFrame(() => updateZoneHintArrows());
    }
}

function orientDominoForPlacement(domino, side, isHorizontal) {
    let orientedDomino = { ...domino };
    let horizontal = isHorizontal;

    if (side === 'center') {
        if (domino.top === domino.bottom) {
            orientedDomino = { ...domino };
            horizontal = false;
        } else {
            const high = Math.max(domino.top, domino.bottom);
            const low = Math.min(domino.top, domino.bottom);
            orientedDomino = { top: high, bottom: low, id: domino.id };
            horizontal = true;
        }
        return { orientedDomino, isHorizontal: horizontal };
    }

    const matchingEnd = getMatchingEndForSide(side);
    const isDouble = domino.top === domino.bottom;

    // Doubles are always vertical on left/right, horizontal on top/bottom
    if (isDouble) {
        if (side === 'left' || side === 'right') {
            horizontal = false;
        } else if (side === 'top' || side === 'bottom') {
            horizontal = true;
        }
    }

    if (horizontal) {
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

    return { orientedDomino, isHorizontal: horizontal };
}

function mountDominoOnBoard(orientedDomino, side, x, y, isHorizontal, owner) {
    const board = getBoardElement();
    const dominoWidth = isHorizontal ? 100 : 50;
    const dominoHeight = isHorizontal ? 50 : 100;

    const el = createDominoElement(orientedDomino, isHorizontal, owner);
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    board.appendChild(el);

    boardDominoes.push({
        domino: orientedDomino,
        x,
        y,
        isHorizontal,
        element: owner === 'player' ? el : undefined
    });

    lastPlayedSide = side;
    if (side === 'center') {
        // Starting domino placement (spinner)
        // Spinner rule: only left and right are open initially
        // Top and bottom become available after left and right are filled
        boardEnds.left = orientedDomino.top;
        boardEnds.right = orientedDomino.bottom;
        boardEnds.top = null;
        boardEnds.bottom = null;
        const spinnerWidth = isHorizontal ? 100 : 50;
        endPositions.left = { x, y, isHorizontal };
        endPositions.right = { x: x + spinnerWidth, y, isHorizontal };
        endPositions.top = null;
        endPositions.bottom = null;
        endIsDouble.left = false;
        endIsDouble.right = false;
        endIsDouble.top = false;
        endIsDouble.bottom = false;
    } else if (side === 'left') {
        // For left placement, the left side of the domino is the NEW open end
        boardEnds.left = orientedDomino.top;
        endPositions.left = { x, y, isHorizontal };
        endIsDouble.left = orientedDomino.top === orientedDomino.bottom;
        leftArmFilled = true;
    } else if (side === 'right') {
        // For right placement, the right side of the domino is the NEW open end
        boardEnds.right = orientedDomino.bottom;
        endPositions.right = { x: x + dominoWidth, y, isHorizontal };
        endIsDouble.right = orientedDomino.top === orientedDomino.bottom;
        rightArmFilled = true;
    } else if (side === 'top') {
        // For top placement, the top side of the domino is the NEW open end
        boardEnds.top = orientedDomino.top;
        endPositions.top = { x, y, isHorizontal };
        endIsDouble.top = orientedDomino.top === orientedDomino.bottom;
    } else if (side === 'bottom') {
        // For bottom placement, the bottom side of the domino is the NEW open end
        boardEnds.bottom = orientedDomino.bottom;
        endPositions.bottom = { x, y: y + dominoHeight, isHorizontal };
        endIsDouble.bottom = orientedDomino.top === orientedDomino.bottom;
    }

    updateLastPlayedDomino(orientedDomino);
    return el;
}

function playDomino(domino, side, x, y, isHorizontal) {
    if (!isPlayerTurn || gameOver) return;

    clearActivePlacement();
    
    // Zones are already shifted in showValidPlacementZones, don't shift again
    const dominoWidth = isHorizontal ? 100 : 50;
    const dominoHeight = isHorizontal ? 50 : 100;
    
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
    
    const oriented = orientDominoForPlacement(domino, side, isHorizontal);
    let orientedDomino = oriented.orientedDomino;
    isHorizontal = oriented.isHorizontal;

    if (side === 'center') {
        hideTurnIndicator();
        startingDomino = null;
    }

    mountDominoOnBoard(orientedDomino, side, x, y, isHorizontal, 'player');
    playDominoSound();
    
    playerDominoes = playerDominoes.filter(d => d.id !== domino.id);
    
    recordMove();

    const scoreResult = calculateScoreFromEnds(side);
    if (scoreResult.score > 0) {
        addScore(true, scoreResult.score);
        playScoreSound();
        updateScoringBreakdown(scoreResult.breakdown, scoreResult.score);
    } else {
        clearScoringBreakdown();
    }

    if (gameOver) return;

    renderRacks();
    selectedDomino = null;

    isPlayerTurn = false;
    updateRackState();

    updateBoneyardCount();
    
    const placedWidth = isHorizontal ? 100 : 50;
    const placedHeight = isHorizontal ? 50 : 100;
    focusOnBoardPoint(x, y, placedWidth, placedHeight, camera.zoom);
    
    checkGameEndAfterMove(true);
    if (gameOver) return;
    
    dismissStarterOverlay();
    
    sendToOpponent({
        type: 'PLAY_DOMINO',
        domino: orientedDomino,
        side: side,
        x: x,
        y: y,
        isHorizontal: isHorizontal,
        score: scoreResult.score
    });
}

function placeDominoOnBoard(orientedDomino, side, x, y, isHorizontal) {
    if (side === 'center') {
        startingDomino = null;
    }
    mountDominoOnBoard(orientedDomino, side, x, y, isHorizontal, 'cpu');
    
    const placedWidth = isHorizontal ? 100 : 50;
    const placedHeight = isHorizontal ? 50 : 100;
    focusOnBoardPoint(x, y, placedWidth, placedHeight, camera.zoom);
    
    dismissStarterOverlay();
}

function startNewHand(message, opponentDominoes = []) {
    const overlay = document.getElementById('gameOverOverlay');
    const title = document.getElementById('gameOverTitle');
    const msg = document.getElementById('gameOverMessage');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const continueBtn = document.getElementById('continueBtn');
    const dominoesContainer = document.getElementById('gameOverDominoes');
    
    title.textContent = 'Round Complete';
    msg.textContent = message + ` Current Score — You: ${playerScore}  ·  Opponent: ${opponentScore}`;
    overlay.classList.remove('hidden');
    
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
    
    playAgainBtn.style.display = 'none';
    if (continueBtn) {
        continueBtn.style.display = 'block';
        continueBtn.onclick = () => {
            overlay.classList.add('hidden');
            continueBtn.style.display = 'none';
            dominoesContainer.innerHTML = '';
            dominoesContainer.classList.add('hidden');
            proceedToNextHand();
        };
    }
}

function proceedToNextHand() {
    boardDominoes = [];
    boardEnds = { left: null, right: null, top: null, bottom: null };
    endIsDouble = { left: false, right: false, top: false, bottom: false };
    endPositions = { left: null, right: null, top: null, bottom: null };
    leftArmFilled = false;
    rightArmFilled = false;
    passesInRow = 0;
    selectedDomino = null;
    lastPlayedSide = null;
    isShowingZones = false;
    gameOver = false;
    
    clearScoringBreakdown();
    
    const board = getBoardElement();
    if (board) {
        board.innerHTML = '';
    }
    
    const playerScoreEl = document.getElementById('playerScore');
    const opponentScoreEl = document.getElementById('opponentScore');
    if (playerScoreEl) playerScoreEl.textContent = playerScore;
    if (opponentScoreEl) opponentScoreEl.textContent = opponentScore;
    
    const allDominoes = createDominoSet();
    playerDominoes = allDominoes.slice(0, 7);
    opponentDominoes = allDominoes.slice(7, 14);
    boneyard = allDominoes.slice(14);
    updateBoneyardCount();
    
    const starter = findStarter(playerDominoes, opponentDominoes);
    setupOpeningTurn(starter.domino, starter.owner === 'player');
    
    initializeBoard();
    renderRacks();
    updateDrawButton();
    showTurnIndicator();
    centerCameraOnBoard();
    
    const gameState = {
        dominoSet: allDominoes,
        starter: starter,
        isHostTurn: isPlayerTurn
    };
    
    sendToOpponent({ type: 'START_GAME', ...gameState });
    
    setTimeout(() => {
        if (isPlayerTurn) {
            handlePlayerTurnStart();
        }
    }, 500);
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

function showZoneHintArrows() {
    const arrows = document.getElementById('zoneHintArrows');
    if (!arrows) return;
    
    arrows.innerHTML = '';
    
    if (boardEnds.left !== null && !isEndVisible('left')) {
        const arrow = document.createElement('div');
        arrow.className = 'zone-hint-arrow zone-hint-arrow-left';
        arrow.style.left = '20px';
        arrow.style.top = '50%';
        arrows.appendChild(arrow);
    }
    
    if (boardEnds.right !== null && !isEndVisible('right')) {
        const arrow = document.createElement('div');
        arrow.className = 'zone-hint-arrow zone-hint-arrow-right';
        arrow.style.right = '20px';
        arrow.style.top = '50%';
        arrows.appendChild(arrow);
    }
    
    if (boardEnds.top !== null && !isEndVisible('top')) {
        const arrow = document.createElement('div');
        arrow.className = 'zone-hint-arrow zone-hint-arrow-top';
        arrow.style.left = '50%';
        arrow.style.top = '20px';
        arrows.appendChild(arrow);
    }
    
    if (boardEnds.bottom !== null && !isEndVisible('bottom')) {
        const arrow = document.createElement('div');
        arrow.className = 'zone-hint-arrow zone-hint-arrow-bottom';
        arrow.style.left = '50%';
        arrow.style.bottom = '20px';
        arrows.appendChild(arrow);
    }
}

function isEndVisible(side) {
    if (!endPositions[side]) return false;
    
    const container = getBoardContainer();
    if (!container) return false;
    
    const rect = container.getBoundingClientRect();
    const x = endPositions[side].x + camera.x;
    const y = endPositions[side].y + camera.y;
    
    return x > 0 && x < rect.width && y > 0 && y < rect.height;
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
    if (!container) return;
    
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
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    camera = { x: 0, y: 0, zoom: isMobile ? 0.5 : 1 };
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

// Chat/Video Panel Functions
function toggleChatVideoPanel() {
    const panel = document.getElementById('chatVideoPanel');
    if (!panel) return;

    chatVideoPanelOpen = !chatVideoPanelOpen;
    panel.classList.toggle('open', chatVideoPanelOpen);
}

function switchPanelTab(tabName) {
    const tabs = document.querySelectorAll('.panel-tab');
    const sections = document.querySelectorAll('.panel-section');

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    sections.forEach(section => {
        section.classList.toggle('active', section.id === `${tabName}Section`);
    });
}

function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message || !conn || !conn.open) {
        return;
    }

    const chatData = {
        type: 'CHAT_MESSAGE',
        message: message,
        sender: 'You',
        timestamp: new Date().toISOString()
    };

    sendToOpponent(chatData);

    // Display message locally
    displayChatMessage(message, 'You', true);

    chatInput.value = '';
}

function receiveChatMessage(data) {
    displayChatMessage(data.message, 'Opponent', false);
}

function displayChatMessage(message, sender, isSent) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="sender">${sender}</div>
        <div>${escapeHtml(message)}</div>
        <div class="time">${time}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateChatVideoConnectionStatus(connected) {
    const chatStatus = document.getElementById('chatConnectionStatus');
    const videoStatus = document.getElementById('videoConnectionStatus');

    if (chatStatus) {
        chatStatus.textContent = connected ? 'Connected' : 'Not connected';
        chatStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }

    if (videoStatus) {
        videoStatus.textContent = connected ? 'Connected' : 'Not connected';
        videoStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }
}

// Video Call Functions
async function handleVideoCallRequest() {
    // Host receives request from non-host to start video
    if (isHost) {
        console.log('Received video call request from opponent');
        if (!videoCall) {
            // Host hasn't started video yet, start it now
            await startVideoCall();
        } else {
            // Host already has peer connection, just create and send offer
            const offer = await videoCall.createOffer();
            await videoCall.setLocalDescription(offer);
            console.log('Created offer for existing connection:', offer.type);
            sendToOpponent({
                type: 'VIDEO_CALL_OFFER',
                offer: offer
            });
        }
    }
}

async function startVideoCall() {
    try {
        const startVideoBtn = document.getElementById('startVideoBtn');
        const endVideoBtn = document.getElementById('endVideoBtn');
        const videoStatus = document.getElementById('videoConnectionStatus');

        if (startVideoBtn) startVideoBtn.disabled = true;
        if (videoStatus) videoStatus.textContent = 'Connecting...';

        // Get local media stream
        const constraints = {
            audio: true,
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Got local stream:', localStream);

        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.playsInline = true;
            localVideo.muted = true;
        }

        // Create WebRTC peer connection with STUN and TURN servers
        videoCall = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
                { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
            ]
        });

        // Monitor connection state
        videoCall.onconnectionstatechange = () => {
            console.log('Connection state:', videoCall.connectionState);
            if (videoStatus) {
                videoStatus.textContent = `State: ${videoCall.connectionState}`;
            }
        };

        videoCall.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', videoCall.iceConnectionState);
            if (videoStatus) {
                videoStatus.textContent = `ICE: ${videoCall.iceConnectionState}`;
            }
        };

        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            console.log('Adding track to peer connection:', track.kind);
            videoCall.addTrack(track, localStream);
        });

        // Handle remote stream
        let hasReceivedRemoteStream = false;
        videoCall.ontrack = (event) => {
            console.log('Received remote track', event);
            console.log('Remote stream:', event.streams[0]);
            
            // Only handle the first track to avoid duplicate events
            if (!hasReceivedRemoteStream) {
                hasReceivedRemoteStream = true;
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = event.streams[0];
                    remoteVideo.playsInline = true;
                    remoteVideo.muted = false;
                    remoteVideo.play().catch(e => console.error('Error playing remote video:', e));
                    console.log('Remote video srcObject set:', remoteVideo.srcObject);
                }
                if (videoStatus) {
                    videoStatus.textContent = 'Connected';
                    videoStatus.classList.add('connected');
                }
            }
        };

        // Handle ICE candidates
        videoCall.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                // Convert RTCIceCandidate to plain object for PeerJS serialization
                const candidateObj = JSON.parse(JSON.stringify({
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                }));
                sendToOpponent({
                    type: 'VIDEO_CALL_ICE',
                    candidate: candidateObj
                });
            }
        };

        // Create offer if host
        if (isHost) {
            const offer = await videoCall.createOffer();
            await videoCall.setLocalDescription(offer);
            console.log('Created offer:', offer.type);

            sendToOpponent({
                type: 'VIDEO_CALL_OFFER',
                offer: offer
            });

            if (endVideoBtn) endVideoBtn.disabled = false;
        } else {
            // Non-host: set up peer connection and wait for offer from host
            if (videoStatus) videoStatus.textContent = 'Waiting for host...';
            if (endVideoBtn) endVideoBtn.disabled = false;
            // Send request to host to start their video
            sendToOpponent({
                type: 'VIDEO_CALL_REQUEST'
            });
        }

    } catch (error) {
        console.error('Error starting video call:', error);
        alert('Could not access camera/microphone. Please check permissions.');
        const startVideoBtn = document.getElementById('startVideoBtn');
        if (startVideoBtn) startVideoBtn.disabled = false;
    }
}

async function handleVideoCallOffer(data) {
    try {
        console.log('Received video call offer - auto-accepting');
        
        // Ensure we have local stream
        if (!localStream) {
            const constraints = {
                audio: true,
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Got local stream for offer handler');

            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.playsInline = true;
                localVideo.muted = true;
            }
        }
        
        // Ensure we have peer connection
        if (!videoCall) {
            videoCall = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
                    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
                ]
            });

            videoCall.onconnectionstatechange = () => {
                console.log('Connection state:', videoCall.connectionState);
            };

            videoCall.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', videoCall.iceConnectionState);
            };

            let hasReceivedRemoteStream = false;
            videoCall.ontrack = (event) => {
                console.log('Received remote track', event);
                console.log('Remote stream:', event.streams[0]);
                
                if (!hasReceivedRemoteStream) {
                    hasReceivedRemoteStream = true;
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo) {
                        remoteVideo.srcObject = event.streams[0];
                        remoteVideo.playsInline = true;
                        remoteVideo.muted = false;
                        remoteVideo.play().catch(e => console.error('Error playing remote video:', e));
                        console.log('Remote video srcObject set:', remoteVideo.srcObject);
                    }
                }
            };

            videoCall.onicecandidate = (event) => {
                if (event.candidate) {
                    const candidateObj = JSON.parse(JSON.stringify({
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex
                    }));
                    sendToOpponent({
                        type: 'VIDEO_CALL_ICE',
                        candidate: candidateObj
                    });
                }
            };
        }

        // Add local stream to peer connection if not already added
        const senders = videoCall.getSenders();
        localStream.getTracks().forEach(track => {
            const hasTrack = senders.some(sender => sender.track === track);
            if (!hasTrack) {
                console.log('Adding track to peer connection:', track.kind);
                videoCall.addTrack(track, localStream);
            }
        });

        // Set remote description (offer)
        await videoCall.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('Set remote description (offer)');

        // Create answer
        const answer = await videoCall.createAnswer();
        await videoCall.setLocalDescription(answer);
        console.log('Created and set local description (answer)');

        sendToOpponent({
            type: 'VIDEO_CALL_ANSWER',
            answer: answer
        });

        // Update UI
        const startVideoBtn = document.getElementById('startVideoBtn');
        const endVideoBtn = document.getElementById('endVideoBtn');
        const videoStatus = document.getElementById('videoConnectionStatus');
        
        if (startVideoBtn) startVideoBtn.disabled = true;
        if (endVideoBtn) endVideoBtn.disabled = false;
        if (videoStatus) {
            videoStatus.textContent = 'Connected';
            videoStatus.classList.add('connected');
        }

    } catch (error) {
        console.error('Error handling video call offer:', error);
        alert('Could not start video call. Please check camera permissions.');
    }
}

async function handleVideoCallAnswer(data) {
    try {
        if (videoCall) {
            await videoCall.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    } catch (error) {
        console.error('Error handling video call answer:', error);
    }
}

async function handleVideoCallIce(data) {
    try {
        if (videoCall && data.candidate) {
            // Reconstruct RTCIceCandidate from plain object
            const candidate = new RTCIceCandidate({
                candidate: data.candidate.candidate,
                sdpMid: data.candidate.sdpMid,
                sdpMLineIndex: data.candidate.sdpMLineIndex
            });
            await videoCall.addIceCandidate(candidate);
            console.log('Added ICE candidate');
        }
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

function endVideoCall() {
    if (videoCall) {
        videoCall.close();
        videoCall = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const startVideoBtn = document.getElementById('startVideoBtn');
    const endVideoBtn = document.getElementById('endVideoBtn');

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (startVideoBtn) startVideoBtn.disabled = false;
    if (endVideoBtn) endVideoBtn.disabled = true;

    // Notify opponent
    sendToOpponent({ type: 'VIDEO_CALL_END' });
}

function handleVideoCallEnd() {
    if (videoCall) {
        videoCall.close();
        videoCall = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const startVideoBtn = document.getElementById('startVideoBtn');
    const endVideoBtn = document.getElementById('endVideoBtn');

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (startVideoBtn) startVideoBtn.disabled = false;
    if (endVideoBtn) endVideoBtn.disabled = true;
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
