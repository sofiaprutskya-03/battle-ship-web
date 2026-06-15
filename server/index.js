const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'        // CORS — правило безпеки браузера яке забороняє звертатись до сервера з іншої адреси
    }
});

server.listen(3000);
console.log('Сервер запущено на порту 3000');

// let бо цей обʼєкт будемо змінювати
let game = {
    players: {
        p1: { socket: null, board: [], status: 'waiting' },
        p2: { socket: null, board: [], status: 'waiting' }
    },
    toMove: 'p1',
    status: 'waiting'
};

function createBoard() {
    let board = [];
    for (let i = 0; i < 10; i++) {
        board.push([]);
        for (let j = 0; j < 10; j++) {
            board[i].push(0);
        }
    }
    return board;
}

// WebDataRocks не розуміє вкладені масиви — він розуміє тільки такий плоский список 
// де кожен рядок і стовпець вказані явно. Тому нам потрібна ця функція.
function flattenBoard(board) {
    const flat = [];
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            const state = board[i] ? board[i][j] : 0;        // захист від порожньої дошки
            flat.push({ row: String(i), col: String(j), state: state });
        }
    }
    return flat;
}

function flattenEnemyBoard(board) {
    const flat = [];
    for (let i = 0; i < 10; i++)
        for (let j = 0; j < 10; j++) {
            const state = board[i] ? (board[i][j] === 1 ? 0 : board[i][j]) : 0;
            flat.push({ row: String(i), col: String(j), state });
        }
    return flat;
}

// connection і disconnect - це вбудовані події Socket.io
io.on('connection', (socket) => {
    let playerId = null;
    if (!game.players.p1.socket) playerId = 'p1';
    else if (!game.players.p2.socket) playerId = 'p2';
    else { socket.disconnect(); return; }

    game.players[playerId].socket = socket;
    game.players[playerId].board = createBoard();
    const enemyId = playerId === 'p1' ? 'p2' : 'p1';
    console.log(`Підключився ${playerId}`);

    socket.emit('boardInit', {
        userBoard: flattenBoard(game.players[playerId].board),
        enemyBoard: flattenEnemyBoard(game.players[enemyId].board)
    });

    socket.on('toggleCell', ({ row, col }) => {
        if (game.status !== 'waiting') return;
        const board = game.players[playerId].board;
        board[row][col] = board[row][col] === 0 ? 1 : 0;
        socket.emit('boardUpdate', { userBoard: flattenBoard(board) });
    });

    socket.on('startGame', () => {
        if (game.status !== 'waiting') return;
        game.players[playerId].status = 'ready';
        if (game.players.p1.status === 'ready' && game.players.p2.status === 'ready') {
            game.status = 'playing';
            game.players.p1.socket.emit('gameStarted', { yourTurn: true });
            game.players.p2.socket.emit('gameStarted', { yourTurn: false });
        }
    });

    socket.on('shoot', ({ row, col }) => {
        if (game.status !== 'playing' || game.toMove !== playerId) return;
        const enemyBoard = game.players[enemyId].board;
        if (enemyBoard[row][col] === 2 || enemyBoard[row][col] === 3) return;
        const hit = enemyBoard[row][col] === 1;
        enemyBoard[row][col] = hit ? 2 : 3;
        if (!hit) game.toMove = enemyId;

        const allSunk = !enemyBoard.flat().includes(1);
        if (allSunk) {
            game.status = 'over';
            socket.emit('gameOver', { winner: 'you' });
            game.players[enemyId].socket.emit('gameOver', { winner: 'enemy' });
            return;
        }

        game.players.p1.socket.emit('boardsUpdate', {
            userBoard: flattenBoard(game.players.p1.board),
            enemyBoard: flattenEnemyBoard(game.players.p2.board),
            yourTurn: game.toMove === 'p1'
        });
        game.players.p2.socket.emit('boardsUpdate', {
            userBoard: flattenBoard(game.players.p2.board),
            enemyBoard: flattenEnemyBoard(game.players.p1.board),
            yourTurn: game.toMove === 'p2'
        });
    });

    socket.on('disconnect', () => {
        game.players[playerId].socket = null;
        game.players[playerId].status = 'waiting';
        console.log(`${playerId} відключився`);
    });
});