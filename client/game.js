const socket = io('http://localhost:3000');

function colorCell(cellStyle, cellData) {
    if (cellData.type === "value") {
        cellStyle.text = "";
        if (cellData.value === 1) cellStyle.addClass("ship-cell");
        if (cellData.value === 2) cellStyle.addClass("hit-cell");
        if (cellData.value === 3) cellStyle.addClass("miss-cell");
    }
}

const userBoard = new WebDataRocks({ container: "#userBoard", toolbar: false, customizeCell: colorCell });
const enemyBoard = new WebDataRocks({ container: "#enemyBoard", toolbar: false, customizeCell: colorCell });

// Це змушує кожну клітинку бути рівно 30пк і WebDataRocks не розтягується
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

socket.on('boardInit', ({ userBoard: uData, enemyBoard: eData, cellsLeft }) => {
    userBoard.setReport(buildReport(uData));
    enemyBoard.setReport(buildReport(eData));
    
    if (cellsLeft !== undefined) {
        document.getElementById('cellsLeft').textContent = cellsLeft;
        if (cellsLeft === 0) document.getElementById('startBtn').disabled = false;
    }
    userBoard.on('cellclick', function(cell) {
        const row = cell.rowIndex - 2;
        const col = cell.columnIndex - 1;
        if (row < 0 || row > 9 || col < 0 || col > 9) return;
        socket.emit('toggleCell', { row, col });
    });
    enemyBoard.on('cellclick', function(cell) {
        const row = cell.rowIndex - 2;
        const col = cell.columnIndex - 1;
        if (row < 0 || row > 9 || col < 0 || col > 9) return;
        socket.emit('shoot', { row, col });
    });
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
    socket.emit('restartGame');
});

socket.on('gameRestarted', () => {
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').disabled = true;
    const cellsLeftEl = document.getElementById('cellsLeft');
    if (cellsLeftEl) cellsLeftEl.textContent = "20";
    document.getElementById('turnInfo').textContent = "Розставте кораблі і натисніть Старт";
});

socket.on('gameOver', ({ winner }) => {
    alert(winner === 'you' ? '🎉 Ви перемогли!' : '😢 Ви програли!');
});