import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import html2canvas from 'html2canvas';
import p5 from 'p5'; 
import "./App.css"

// Helper to create a new random note
const createRandomNote = () => {
  const colors = ["#ffeb3b", "#81d4fa", "#a5d6a7", "#f48fb1", "#ce93d8"];
  return {
    id: Date.now(),
    text: "New Idea",
    x: Math.random() * 200 + 50,
    y: Math.random() * 200 + 50,
    color: colors[Math.floor(Math.random() * colors.length)]
  };
};

// Helper to draw the entire history on p5 canvas
const drawHistory = (p, history) => {
  if (!history || !p) return;
  p.background(240, 242, 245);
  history.forEach(line => {
      p.stroke(line.color || 50);
      p.strokeWeight(3);
      p.line(line.x0, line.y0, line.x1, line.y1);
  });
};

// Main App Component
export default function CollaborativeBoard() {
  const [notes, setNotes] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  
  const draggedIdRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 }); 
  const boardRef = useRef(null);
  const ws = useRef(null);

  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const drawingHistoryRef = useRef([]); 

  const p5ContainerRef = useRef(null);
  const p5InstanceRef = useRef(null);

  // Sync draggedId state to ref
useEffect(() => {
    // ----------------- 修改开始 -----------------
    // 1. 判断当前是否是生产环境 (build 之后运行就是在生产环境)
    const isProduction = import.meta.env.MODE === 'production';

    // 2. 设置地址
    // 注意：Render 部署后是 HTTPS，所以 WebSocket 必须用 wss:// (Secure WebSocket)
    // 请将 'your-app-name' 换成你在 Render 上得到的真实名字
    const socketUrl = isProduction 
      ? "wss://你的Render项目名.onrender.com" 
      : "ws://localhost:3001";

    console.log("Connecting to WebSocket:", socketUrl); // 方便调试看连的哪里

    // 3. 建立连接
    ws.current = new WebSocket(socketUrl);
    // ----------------- 修改结束 -----------------

    const handleRemoteDraw = (data) => {
        const p = p5InstanceRef.current;
        if (p) {
            p.drawLineSegment(data.x0, data.y0, data.x1, data.y1);
        }
        drawingHistoryRef.current.push(data);
    };

    ws.current.onmessage = (msg) => {
      try {
        const response = JSON.parse(msg.data);
        
        if (response.type === 'init') {
            setNotes(response.data.notes);
            drawingHistoryRef.current = response.data.drawings;
            if (p5InstanceRef.current) {
                drawHistory(p5InstanceRef.current, response.data.drawings);
            }
        }
        
        if (response.type === 'updateNotes') {
          if (!draggedIdRef.current) setNotes(response.data);
        }

        if (response.type === 'draw') {
            handleRemoteDraw(response.data);
        }

        if (response.type === 'clearBoard') {
            drawingHistoryRef.current = [];
            if (p5InstanceRef.current) {
                 p5InstanceRef.current.background(240, 242, 245);
            }
        }

      } catch (e) {
        console.error("WS Error:", e);
      }
    };

    // 记得在组件卸载时关闭连接
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  useLayoutEffect(() => {
    const sketch = (p) => {
      p.setup = () => {
        const w = p5ContainerRef.current.offsetWidth;
        const h = p5ContainerRef.current.offsetHeight;
        const canvas = p.createCanvas(w, h);
        canvas.parent(p5ContainerRef.current);
        
        p.background(240, 242, 245);
        p.noLoop();
      };

      p.windowResized = () => {
        const w = p5ContainerRef.current.offsetWidth;
        const h = p5ContainerRef.current.offsetHeight;
        p.resizeCanvas(w, h);
        drawHistory(p, drawingHistoryRef.current);
      };

      p.drawLineSegment = (x0, y0, x1, y1) => {
        p.stroke(50);
        p.strokeWeight(3);
        p.line(x0, y0, x1, y1);
      };
    };

    p5InstanceRef.current = new p5(sketch);

    return () => {
      if(p5InstanceRef.current) p5InstanceRef.current.remove();
    };
  }, []);

  const getCoordinates = (e) => {
    if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    return { x: 0, y: 0 };
  };

  const handleMouseDown = (e) => {
    if (draggedIdRef.current || e.target !== p5ContainerRef.current?.querySelector('canvas')) {
       // Ignore if dragging note or clicking elsewhere
    }
    
    if (e.button !== 0) return;

    isDrawingRef.current = true;
    lastPosRef.current = getCoordinates(e);
  };

  const handleMouseMove = (e) => {
    if (!isDrawingRef.current) return;
    
    const currentPos = getCoordinates(e);
    const prevPos = lastPosRef.current;

    if (p5InstanceRef.current) {
        p5InstanceRef.current.drawLineSegment(prevPos.x, prevPos.y, currentPos.x, currentPos.y);
    }

    const lineData = {
        x0: prevPos.x, 
        y0: prevPos.y, 
        x1: currentPos.x, 
        y1: currentPos.y 
    };

    drawingHistoryRef.current.push(lineData);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'draw', data: lineData }));
    }

    lastPosRef.current = currentPos;
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:3001");

    const handleRemoteDraw = (data) => {
        const p = p5InstanceRef.current;
        if (p) {
            p.drawLineSegment(data.x0, data.y0, data.x1, data.y1);
        }
        drawingHistoryRef.current.push(data);
    };

    ws.current.onmessage = (msg) => {
      try {
        const response = JSON.parse(msg.data);
        
        if (response.type === 'init') {
            setNotes(response.data.notes);
            drawingHistoryRef.current = response.data.drawings;
            if (p5InstanceRef.current) {
                drawHistory(p5InstanceRef.current, response.data.drawings);
            }
        }
        
        if (response.type === 'updateNotes') {
          if (!draggedIdRef.current) setNotes(response.data);
        }

        if (response.type === 'draw') {
            handleRemoteDraw(response.data);
        }

        if (response.type === 'clearBoard') {
            drawingHistoryRef.current = [];
            if (p5InstanceRef.current) {
                 p5InstanceRef.current.background(240, 242, 245);
            }
        }

      } catch (e) {
        console.error("WS Error:", e);
      }
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const clearCanvas = () => {
    drawingHistoryRef.current = [];
    if (p5InstanceRef.current) p5InstanceRef.current.background(240, 242, 245);
    if (ws.current) ws.current.send(JSON.stringify({ type: 'clearBoard' }));
  };

  const broadcastNotes = (updatedNotes) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'updateNotes', data: updatedNotes }));
    }
  };

  const handleAddNote = () => {
    const newNote = createRandomNote();
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    broadcastNotes(updatedNotes);
  };

  const handleStickyDragStart = (e, id) => {
    e.stopPropagation();
    setDraggedId(id);
    const rect = e.target.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleStickyDragEnd = (e) => {
    if (!boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const newX = e.clientX - boardRect.left - dragOffset.current.x;
    const newY = e.clientY - boardRect.top - dragOffset.current.y;

    const updatedNotes = notes.map(note => 
      note.id === draggedId ? { ...note, x: newX, y: newY } : note
    );

    setNotes(updatedNotes);
    broadcastNotes(updatedNotes);
    setDraggedId(null);
  };

  const handleTextChange = (id, newText) => {
    const updatedNotes = notes.map(note => 
      note.id === id ? { ...note, text: newText } : note
    );
    setNotes(updatedNotes);
    broadcastNotes(updatedNotes);
  };

  const handleDownload = async () => {
    if (!boardRef.current) return;
    try {
      const canvas = await html2canvas(boardRef.current, { backgroundColor: null });
      const link = document.createElement("a");
      link.download = "collab-board.png";
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = (id) => {
    // 1. 本地立即删除（乐观更新）
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);

    // 2. 发送消息给服务器
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ 
            type: 'deleteNote', 
            data: { id: id } // 发送要删除的 note ID
        }));
    }
    
    // 注意：我们不需要在这里调用 broadcastNotes(updatedNotes);
    // 因为后端会发送 type: 'updateNotes' 的广播回来。
};

  return (
    <div className="app-container">
      <header className="toolbar">
        <h1>Collaborative Board</h1>
        <button onClick={handleAddNote} className="btn-add">+ Note</button>
        <button onClick={clearCanvas} className="btn-clear">Clear Drawings</button>
        <button onClick={handleDownload} className="btn-download">Save Image</button>
      </header>

      <div 
        className="board" 
        ref={boardRef} 
        onDragOver={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div ref={p5ContainerRef} className="p5-background"></div>

        {notes.map((note) => (
          <div
            key={note.id}
            className={`sticky-note ${draggedId === note.id ? 'dragging' : ''}`}
            style={{
              left: note.x,
              top: note.y,
              backgroundColor: note.color,
              zIndex: 10 
            }}
            draggable
            onMouseDown={(e) => e.stopPropagation()} 
            onDragStart={(e) => handleStickyDragStart(e, note.id)}
            onDragEnd={handleStickyDragEnd}
          >
            <button 
            className="delete-button" 
            onClick={() => handleDeleteNote(note.id)}
            onMouseDown={(e) => e.stopPropagation()} // 阻止删除按钮触发画线或拖动逻辑
        >
            &times;
        </button>

            <textarea
              value={note.text}
              onChange={(e) => handleTextChange(note.id, e.target.value)}
              onMouseDown={(e) => e.stopPropagation()} 
            />
          </div>
        ))}
      </div>
      
      <div className="instructions">
        <p>Drag to draw on background. Click "+ Note" to add stickers.</p>
      </div>
    </div>
  );
  
}