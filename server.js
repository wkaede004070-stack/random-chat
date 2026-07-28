const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// モードごとの待機キュー
const waitingQueues = {
  text: [],
  audio: [],
  video: []
};

io.on('connection', (socket) => {
  let currentMode = null;

  // 1. マッチング検索の開始
  socket.on('find-match', (mode) => {
    currentMode = mode;
    
    // 待機列に誰もいなければキューに追加して待機
    if (waitingQueues[mode].length === 0) {
      waitingQueues[mode].push(socket);
      socket.emit('status', '相手を探しています...');
    } else {
      // 待機している人がいればペアリング！
      const partner = waitingQueues[mode].pop();
      const roomId = `room_${socket.id}_${partner.id}`;

      socket.join(roomId);
      partner.join(roomId);

      // それぞれに相手を通知（先に待っていた方をオファー側に設定）
      socket.emit('match-found', { roomId, isInitiator: false });
      partner.emit('match-found', { roomId, isInitiator: true });
    }
  });

  // 2. WebRTCシグナリング（映像・音声・テキストデータの仲介）
  socket.on('signal', (data) => {
    socket.to(data.roomId).emit('signal', data.signal);
  });

  // 3. 切断処理
  socket.on('disconnect', () => {
    if (currentMode && waitingQueues[currentMode]) {
      waitingQueues[currentMode] = waitingQueues[currentMode].filter(s => s.id !== socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
