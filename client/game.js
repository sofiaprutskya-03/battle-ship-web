const socket = io('http://localhost:3000');

function colorCell(cellStyle, cellData) {
    if (cellData.type === "value") {
        cellStyle.text = "";
        if (cellData.value === 1) cellStyle.addClass("ship-cell");
        if (cellData.value === 2) { cellStyle.addClass("hit-cell"); cellStyle.text = "✘"; }
        if (cellData.value === 3) cellStyle.text = "•";
    }
}

const userBoard = new WebDataRocks({ container: "#userBoard", toolbar: false });
const enemyBoard = new WebDataRocks({ container: "#enemyBoard", toolbar: false });

function buildReport(data) {
    return {
        dataSource: { data },
        slice: {
            rows: [{ uniqueName: "row" }],
            columns: [{ uniqueName: "col" }],
            measures: [{ uniqueName: "state", aggregation: "sum" }]
        },
        options: { grid: { showGrandTotals: "off", showTotals: "off" } }
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
});

socket.on('gameOver', ({ winner }) => {
    alert(winner === 'you' ? '🎉 Ви перемогли!' : '😢 Ви програли!');
});