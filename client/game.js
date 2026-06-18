const socket = io();

function colorCell(cellStyle, cellData) {
    if (cellData.type === "value") {
        cellStyle.text = "";
        if (cellData.value === 1) cellStyle.addClass("ship-cell");
        if (cellData.value === 2) cellStyle.addClass("hit-cell");
        if (cellData.value === 3) cellStyle.addClass("miss-cell");
    }
}

const cellSize = 30;
const colSizes = [];
const rowSizes = [];
for (let i = 0; i < 11; i++) {
    colSizes.push({ idx: i, width: cellSize });
    rowSizes.push({ idx: i, height: cellSize });
}

function buildReport(data) {
    return {
        dataSource: { data },
        slice: {
            rows: [{ uniqueName: "row" }],
            columns: [{ uniqueName: "col" }],
            measures: [{ uniqueName: "state", aggregation: "sum" }]
        },
        options: { grid: { showGrandTotals: "off", showTotals: "off", showHeaders: false } },
        tableSizes: { columns: colSizes, rows: rowSizes }
    };
}

const emptyData = [];
for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
        emptyData.push({ row: String(i), col: String(j), state: 0 });
    }
}

const userBoard = new WebDataRocks({ container: "#userBoard", toolbar: false, customizeCell: colorCell, report: buildReport(emptyData) });
const enemyBoard = new WebDataRocks({ container: "#enemyBoard", toolbar: false, customizeCell: colorCell, report: buildReport(emptyData) });

userBoard.on('cellclick', function(cell) {
    if (!currentRoomId) return;
    const row = cell.rowIndex - 2;
    const col = cell.columnIndex - 1;
    if (row < 0 || row > 9 || col < 0 || col > 9) return;
    socket.emit('toggleCell', { row, col });
});
enemyBoard.on('cellclick', function(cell) {
    if (!currentRoomId) return;
    const row = cell.rowIndex - 2;
    const col = cell.columnIndex - 1;
    if (row < 0 || row > 9 || col < 0 || col > 9) return;
    socket.emit('shoot', { row, col });
});

socket.on('boardInit', ({ userBoard: uData, enemyBoard: eData, cellsLeft }) => {
    userBoard.setReport(buildReport(uData));
    enemyBoard.setReport(buildReport(eData));
    
    if (cellsLeft !== undefined) {
        document.getElementById('cellsLeft').textContent = cellsLeft;
        if (cellsLeft === 0) document.getElementById('startBtn').disabled = false;
    }
});

socket.on('boardUpdate', ({ userBoard: uData, cellsLeft }) => {
    userBoard.setReport(buildReport(uData));
    
    document.getElementById('cellsLeft').textContent = cellsLeft;
    
    const startBtn = document.getElementById('startBtn');
    if (cellsLeft === 0) {
        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }
});

socket.on('placementError', (message) => {
    alert("Помилка: " + message);
});

socket.on('boardsUpdate', ({ userBoard: uData, enemyBoard: eData, yourTurn }) => {
    userBoard.setReport(buildReport(uData));
    enemyBoard.setReport(buildReport(eData));
    document.getElementById('turnInfo').textContent = yourTurn ? "Ваш хід" : "Хід суперника";
});

document.getElementById('startBtn').addEventListener('click', () => {
    socket.emit('startGame');
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('turnInfo').textContent = "Очікування суперника...";
});

socket.on('gameStarted', ({ yourTurn }) => {
    document.getElementById('turnInfo').textContent = yourTurn ? "Ваш хід" : "Хід суперника";
});

document.getElementById('restartBtn').addEventListener('click', () => {
    socket.emit('restart');
});


let currentRoomId = new URLSearchParams(window.location.search).get('room');

function updateRoomState() {
    const roomPanel = document.getElementById('roomPanel');
    const uBoard = document.getElementById('userBoard');
    const eBoard = document.getElementById('enemyBoard');
    
    if (currentRoomId) {
        if (roomPanel) roomPanel.style.display = 'none';
        if (uBoard) uBoard.classList.remove('blocked-board');
        if (eBoard) eBoard.classList.remove('blocked-board');
        socket.emit('joinRoom', currentRoomId);
    } else {
        if (roomPanel) roomPanel.style.display = 'flex';
        if (uBoard) uBoard.classList.add('blocked-board');
        if (eBoard) eBoard.classList.add('blocked-board');
    }
}

const createBtn = document.getElementById('createRoomBtn');
if (createBtn) {
    createBtn.addEventListener('click', () => {         
        currentRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        window.history.pushState(null, '', '?room=' + currentRoomId);
        updateRoomState();
        
        navigator.clipboard.writeText(window.location.href).catch(() => {});
        setTimeout(() => {
            alert(`Ваша кімната створена!\nВаш ID: ${currentRoomId}\nПосилання скопійовано в буфер обміну та ви його можете надіслати своєму другу!`);
        }, 50);
    });
}

const joinBtn = document.getElementById('joinRoomBtn');
if (joinBtn) {
    joinBtn.addEventListener('click', () => {
        const val = document.getElementById('joinRoomInput').value.trim().toUpperCase();
        if (val) {
            currentRoomId = val;
            window.history.pushState(null, '', '?room=' + currentRoomId);
            updateRoomState();
        } else {
            alert("Введіть ID кімнати!");
        }
    });
}


setTimeout(updateRoomState, 500);

socket.on('gameRestarted', () => {
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').disabled = true;
    const cellsLeftEl = document.getElementById('cellsLeft');
    if (cellsLeftEl) cellsLeftEl.textContent = "20";
    document.getElementById('turnInfo').textContent = "Розставте кораблі і натисніть Старт";
});

socket.on('gameOver', ({ winner }) => {
    alert(winner === 'you' ? '🎉 Ви перемогли! Вітаю вас, так тримати)' : '😢 Ви програли! Але нічого страшного, ще все попереду)');
});

socket.on('serverFull', (msg) => {
    alert(msg);
});