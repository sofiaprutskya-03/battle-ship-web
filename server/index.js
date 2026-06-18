const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['https://sofia-battleship.up.railway.app', 'http://localhost:3000']
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
});

const rooms = {};

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



function flattenBoard(board) {
    const flat = [];
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            const state = board[i] ? board[i][j] : 0;
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

io.on('connection', (socket) => {
    let currentRoom = null;
    let playerId = null;
    let enemyId = null;

    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: {
                    p1: { socket: null, board: [], status: 'waiting' },
                    p2: { socket: null, board: [], status: 'waiting' }
                },
                toMove: 'p1',
                status: 'waiting'
            };
        }

        const game = rooms[roomId];

        if (!game.players.p1.socket) playerId = 'p1';
        else if (!game.players.p2.socket) playerId = 'p2';
        else { 
            socket.emit('serverFull', 'Кімната заповнена (вже є 2 гравці)!');
            return; 
        }

        currentRoom = roomId;
        enemyId = playerId === 'p1' ? 'p2' : 'p1';
        game.players[playerId].socket = socket;
        game.players[playerId].board = createBoard();
        socket.join(roomId);

        console.log(`Підключився ${playerId} до кімнати ${roomId}`);

        const currentCells = game.players[playerId].board.flat().filter(c => c === 1).length;
        socket.emit('boardInit', {
            userBoard: flattenBoard(game.players[playerId].board),
            enemyBoard: flattenEnemyBoard(game.players[enemyId].board || createBoard()),
            cellsLeft: 20 - currentCells
        });
    });

    socket.on('toggleCell', ({ row, col }) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const game = rooms[currentRoom];
        if (game.status !== 'waiting') return;
        
        const board = game.players[playerId].board;
        
        if (board[row][col] === 0) {
            const totalCells = board.flat().filter(c => c === 1).length;
            if (totalCells >= 20) {
                socket.emit('placementError', 'Ви вже поставили максимальну кількість клітинок (20)!');
                return;
            }
            
            
            const hasDiagonalNeighbor = 
                (row > 0 && col > 0 && board[row-1][col-1] === 1) ||
                (row > 0 && col < 9 && board[row-1][col+1] === 1) ||
                (row < 9 && col > 0 && board[row+1][col-1] === 1) ||
                (row < 9 && col < 9 && board[row+1][col+1] === 1);
                
            if (hasDiagonalNeighbor) {
                socket.emit('placementError', 'Кораблі не можуть торкатись по діагоналі!');
                return;
            }
        }
        
        board[row][col] = board[row][col] === 0 ? 1 : 0;
        const currentCells = board.flat().filter(c => c === 1).length;
        socket.emit('boardUpdate', { 
            userBoard: flattenBoard(board),
            cellsLeft: 20 - currentCells
        });
    });

    socket.on('startGame', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const game = rooms[currentRoom];
        if (game.status !== 'waiting') return;
        
        game.players[playerId].status = 'ready';
        if (game.players.p1.status === 'ready' && game.players.p2.status === 'ready') {
            game.status = 'playing';
            game.players.p1.socket.emit('gameStarted', { yourTurn: true });
            game.players.p2.socket.emit('gameStarted', { yourTurn: false });
        }
    });

    socket.on('shoot', ({ row, col }) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const game = rooms[currentRoom];
        if (game.status !== 'playing' || game.toMove !== playerId) return;
        
        const enemyBoard = game.players[enemyId].board;
        if (enemyBoard[row][col] === 2 || enemyBoard[row][col] === 3) return;
        
        const hit = enemyBoard[row][col] === 1;
        enemyBoard[row][col] = hit ? 2 : 3;
        if (!hit) game.toMove = enemyId;

        socket.emit('updateBoards', {
            userBoard: flattenBoard(game.players[playerId].board),
            enemyBoard: flattenEnemyBoard(enemyBoard),
            yourTurn: game.toMove === playerId
        });
        
        if (game.players[enemyId].socket) {
            game.players[enemyId].socket.emit('updateBoards', {
                userBoard: flattenBoard(enemyBoard),
                enemyBoard: flattenEnemyBoard(game.players[playerId].board),
                yourTurn: game.toMove === enemyId
            });
        }

        const allSunk = !enemyBoard.flat().includes(1);
        if (allSunk) {
            game.status = 'over';
            
            
                socket.emit('gameOver', { winner: 'you' });
                if (game.players[enemyId].socket) {
                    game.players[enemyId].socket.emit('gameOver', { winner: 'enemy' });
                }
            
            return;
        }
    });

    socket.on('restart', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const game = rooms[currentRoom];
        
        game.players.p1.board = createBoard();
        game.players.p1.status = 'waiting';
        game.players.p2.board = createBoard();
        game.players.p2.status = 'waiting';
        game.status = 'waiting';
        game.toMove = 'p1';

        io.to(currentRoom).emit('gameRestarted');
        
        if (game.players.p1.socket) {
            game.players.p1.socket.emit('boardInit', {
                userBoard: flattenBoard(game.players.p1.board),
                enemyBoard: flattenEnemyBoard(game.players.p2.board),
                cellsLeft: 20
            });
        }
        if (game.players.p2.socket) {
            game.players.p2.socket.emit('boardInit', {
                userBoard: flattenBoard(game.players.p2.board),
                enemyBoard: flattenEnemyBoard(game.players.p1.board),
                cellsLeft: 20
            });
        }
    });

    socket.on('disconnect', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const game = rooms[currentRoom];
        
        if (game.players[playerId]) {
            game.players[playerId].socket = null;
        }
        
        
        if (!game.players.p1.socket && !game.players.p2.socket) {
            delete rooms[currentRoom];
            console.log(`Кімнату ${currentRoom} видалено (всі вийшли)`);
        } else if (game.players[enemyId] && game.players[enemyId].socket) {
            game.players[enemyId].socket.emit('playerDisconnected');
        }
    });
});