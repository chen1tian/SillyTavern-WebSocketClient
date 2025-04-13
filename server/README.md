# WebSocket-TCP代理服务器

这是一个简单的代理服务器，用于将WebSocket连接转换为TCP连接。

## 功能

- 接收WebSocket连接（端口9919）
- 将WebSocket消息转发到TCP服务器（127.0.0.1:9919）
- 将TCP服务器的响应转发回WebSocket客户端
- 自动处理连接关闭和错误情况

## 安装

1. 确保已安装Node.js
2. 进入server目录
3. 运行以下命令安装依赖：
   ```bash
   npm install
   ```

## 使用方法

1. 启动代理服务器：
   ```bash
   npm start
   ```
2. 服务器将在端口9919上监听WebSocket连接
3. 所有WebSocket消息将被转发到TCP服务器（127.0.0.1:9919）

## 配置

可以在`proxy.js`文件中修改以下配置：

- `wsPort`: WebSocket服务器端口（默认：9919）
- `tcpHost`: TCP服务器地址（默认：127.0.0.1）
- `tcpPort`: TCP服务器端口（默认：9919）

## 注意事项

- 确保TCP服务器已经启动并正在运行
- 代理服务器会自动处理连接的建立和断开
- 如果TCP服务器关闭，WebSocket连接也会自动关闭 