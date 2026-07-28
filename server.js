const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let waitingQueue = [];

io.on('connection', (socket) => {
  let userProfile = null;
  let currentRoomId = null;

  // 1. プロフィールを受け取って待機列に追加
  socket.on('find-match', (profile) => {
    userProfile = profile;

    if (waitingQueue.length === 0) {
      waitingQueue.push(socket);
      socket.emit('status', '相手を探しています...');
    } else {
      const partner = waitingQueue.pop();
      const roomId = `room_${socket.id}_${partner.id}`;

      socket.currentRoomId = roomId;
      partner.currentRoomId = roomId;

      socket.join(roomId);
      partner.join(roomId);

      // お互いに相手のプロフィールを送信
      socket.emit('match-found', { roomId, isInitiator: false, partnerProfile: partner.userProfile });
      partner.emit('match-found', { roomId, isInitiator: true, partnerProfile: userProfile });
    }
  });

  // 2. マッチング承認／キャンセルの同期
  socket.on('accept-match', (roomId) => {
    socket.to(roomId).emit('partner-accepted');
  });

  socket.on('cancel-match', (roomId) => {
    socket.to(roomId).emit('partner-canceled');
    socket.leave(roomId);
  });

  // 3. WebRTCシグナリング
  socket.on('signal', (data) => {
    socket.to(data.roomId).emit('signal', data.signal);
  });

  // 4. 切断処理
  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
    if (socket.currentRoomId) {
      io.to(socket.currentRoomId).emit('partner-canceled');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
