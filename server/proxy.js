const WebSocket = require('ws');
const net = require('net');

// 配置
const config = {
    wsPort: 9918,  // WebSocket服务器端口
    tcpHost: '127.0.0.1',  // TCP服务器地址
    tcpPort: 9919   // TCP服务器端口
};

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: config.wsPort });

console.log(`WebSocket代理服务器启动在端口 ${config.wsPort}`);

// 存储所有活动的TCP连接
const tcpConnections = new Map();

wss.on('connection', (ws) => {
    console.log('新的WebSocket连接已建立');

    // 为每个WebSocket连接创建TCP连接
    const tcpClient = new net.Socket();
    
    // 存储TCP连接
    tcpConnections.set(ws, tcpClient);

    // 连接到TCP服务器
    tcpClient.connect(config.tcpPort, config.tcpHost, () => {
        console.log('已连接到TCP服务器');
    });

    // 处理WebSocket消息
    ws.on('message', (message) => {
        try {
            // 将WebSocket消息转发到TCP服务器
            tcpClient.write(message);
            console.log('转发到TCP服务器:', message.toString());
        } catch (error) {
            console.error('发送消息到TCP服务器时出错:', error);
        }
    });

    // 处理TCP服务器消息
    tcpClient.on('data', (data) => {
        try {
            // 将TCP服务器消息转发到WebSocket客户端
            ws.send(data.toString());
            console.log('转发到WebSocket客户端:', data.toString());
        } catch (error) {
            console.error('发送消息到WebSocket客户端时出错:', error);
        }
    });

    // 处理WebSocket连接关闭
    ws.on('close', () => {
        console.log('WebSocket连接已关闭');
        const tcpClient = tcpConnections.get(ws);
        if (tcpClient) {
            tcpClient.end();
            tcpConnections.delete(ws);
        }
    });

    // 处理TCP连接关闭
    tcpClient.on('close', () => {
        console.log('TCP连接已关闭');
        ws.close();
        tcpConnections.delete(ws);
    });

    // 处理错误
    tcpClient.on('error', (error) => {
        console.error('TCP连接错误:', error);
        ws.close();
        tcpConnections.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket连接错误:', error);
        const tcpClient = tcpConnections.get(ws);
        if (tcpClient) {
            tcpClient.end();
            tcpConnections.delete(ws);
        }
    });
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    wss.close(() => {
        console.log('WebSocket服务器已关闭');
        process.exit(0);
    });
}); 