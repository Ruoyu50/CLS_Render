const http = require('http');
const { WebSocketServer } = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running...');
});

const wss = new WebSocketServer({ server });

// --- 内存存储 ---
let stickyNotes = [
  { id: 1, text: "Welcome!", x: 50, y: 50, color: "#ffeb3b" }
];

// 存储绘画轨迹：每个元素是一条线段 { x0, y0, x1, y1, color }
let drawingHistory = [];

wss.on('connection', (ws) => {
  console.log('Client connected');

  // 1. 初始化：发送便利贴数据 + 绘画历史
  ws.send(JSON.stringify({ 
    type: 'init', 
    data: { notes: stickyNotes, drawings: drawingHistory } 
  }));

  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message.toString());

    // 2. 处理便利贴更新
    if (parsedMessage.type === 'updateNotes') {
      stickyNotes = parsedMessage.data;
      // 广播给其他人
      broadcast(ws, message.toString());
    }

    // 5. 【新增】处理删除便利贴
    if (parsedMessage.type === 'deleteNote') {
      const noteIdToDelete = parsedMessage.data.id;
      // 过滤掉要删除的便利贴
      stickyNotes = stickyNotes.filter(note => note.id !== noteIdToDelete);
      
      // 广播更新后的完整列表
      broadcast(ws, JSON.stringify({ type: 'updateNotes', data: stickyNotes }));
    }

    // 3. 处理绘画动作 (收到新的线条)
    if (parsedMessage.type === 'draw') {
      const lineData = parsedMessage.data;
      drawingHistory.push(lineData); // 存入历史
      // 广播给其他人
      broadcast(ws, message.toString());
    }

    // 4. 清空白板 (可选功能)
    if (parsedMessage.type === 'clearBoard') {
        drawingHistory = [];
        broadcast(ws, message.toString());
    }
  });

  ws.on('close', () => console.log('Client disconnected'));
});

// 广播辅助函数
function broadcast(sender, dataString) {
  wss.clients.forEach((client) => {
    if (client !== sender && client.readyState === client.OPEN) {
      client.send(dataString);
    }
  });
}

const PORT = 3001;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));