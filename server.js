const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let waitingQueue = [];

io.on('connection', (socket) => {
  let userProfile = null;

  // 1. マッチング検索
  socket.on('find-match', (profile) => {
    socket.userProfile = profile;

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

      // 互いに相手のプロフィールを通知して選択画面を出す
      socket.emit('match-found', { roomId, isInitiator: false, partnerProfile: partner.userProfile });
      partner.emit('match-found', { roomId, isInitiator: true, partnerProfile: socket.userProfile });
    }
  });

  // 2. 「マッチング（承認）」を押したとき
  socket.on('accept-match', (roomId) => {
    socket.to(roomId).emit('partner-accepted');
  });

  // 3. 「キャンセル（拒否）」を押したとき
  socket.on('cancel-match', (roomId) => {
    socket.to(roomId).emit('partner-canceled');
    socket.leave(roomId);
  });

  // 4. WebRTC シグナリング
  socket.on('signal', (data) => {
    socket.to(data.roomId).emit('signal', data.signal);
  });

  // 5. 切断処理
  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
    if (socket.currentRoomId) {
      io.to(socket.currentRoomId).emit('partner-canceled');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
