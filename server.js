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
      // 待機していた人（partner）に、後から来た人（socket）がマッチングを仕掛ける構成
      const partner = waitingQueue.pop();
      const roomId = `room_${socket.id}_${partner.id}`;

      socket.currentRoomId = roomId;
      partner.currentRoomId = roomId;

      socket.join(roomId);
      partner.join(roomId);

      // アプローチ側（探した人）には「承認待ち」を通知
      socket.emit('request-sent', { roomId, partnerProfile: partner.userProfile });

      // 受け取り側（待っていた人）には「承認/拒否ボタン」付きで通知
      partner.emit('request-received', { roomId, partnerProfile: socket.userProfile });
    }
  });

  // 2. 受け取り側が「承認」を押したとき
  socket.on('accept-request', (roomId) => {
    io.to(roomId).emit('match-approved');
  });

  // 3. 受け取り側が「拒否」を押したとき
  socket.on('reject-request', (roomId) => {
    socket.to(roomId).emit('match-rejected');
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
      io.to(socket.currentRoomId).emit('match-rejected');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
