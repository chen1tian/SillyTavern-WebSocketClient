import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { chat } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";


const extensionName = "SillyTavern-WebSocketClient";
const defaultSettings = {
    wsUrl: "127.0.0.1",
    wsPort: 9918,
    autoConnect: false
};

if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = {};
}

Object.assign(extension_settings[extensionName], defaultSettings);

let ws;
let autoConnectTimer = null;

// 更新调试日志
function updateDebugLog(message) {
    const debugLog = $('#debug_log');
    if (debugLog.length === 0) {
        console.warn('找不到调试日志元素');
        return;
    }
    const timestamp = new Date().toLocaleTimeString();
    const currentContent = debugLog.val();
    const newLine = `[${timestamp}] ${message}\n`;
    debugLog.val(currentContent + newLine);
    debugLog.scrollTop(debugLog[0].scrollHeight);
    // 同时在控制台输出，方便调试
    console.log(`[${extensionName}] ${message}`);
}

// 更新WebSocket状态显示
function updateWSStatus(connected) {
    const status = $('#ws_status');
    if (connected) {
        status.text('已连接').css('color', 'green');
    } else {
        status.text('未连接').css('color', 'red');
    }
}

// 更新连接按钮状态
function updateConnectionButtons(connected) {
    $('#ws_connect').prop('disabled', connected);
    $('#ws_disconnect').prop('disabled', !connected);
    $('#ws_url').prop('disabled', connected);
    $('#ws_port').prop('disabled', connected);
}

// 设置WebSocket连接
function setupWebSocket() {
    const wsUrl = $('#ws_url').val();
    const wsPort = $('#ws_port').val();
    updateDebugLog(`尝试连接WebSocket服务器: ws://${wsUrl}:${wsPort}`);

    try {
        ws = new WebSocket(`ws://${wsUrl}:${wsPort}`);

        ws.onopen = () => {
            updateWSStatus(true);
            updateConnectionButtons(true);
            updateDebugLog('WebSocket连接已建立');
            
            // 发送当前聊天历史
            sendChatHistory();
            
            // 发送测试消息
            sendTestMessage("WebSocket客户端已连接");
        };

        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                updateDebugLog(`收到消息: ${JSON.stringify(data)}`);

                // 处理接收到的消息
                if (data.type === 'chat_message') {
                    // 处理聊天消息
                    handleChatMessage(data);
                } else if (data.type === 'test_message') {
                    // 处理测试消息
                    updateDebugLog(`收到测试消息: ${data.content}`);
                } else if (data.type === 'error') {
                    // 处理错误消息
                    updateDebugLog(`收到错误消息: ${data.content}`);
                } else {
                    // 处理其他类型的消息
                    updateDebugLog(`收到未知类型消息: ${JSON.stringify(data)}`);
                }
            } catch (error) {
                updateDebugLog(`处理消息时出错: ${error.message}`);
                console.error(error);
            }
        };

        ws.onclose = () => {
            updateWSStatus(false);
            updateConnectionButtons(false);
            updateDebugLog('WebSocket连接已关闭');
            
            // 如果启用了自动重连，则开始尝试重新连接
            if (extension_settings[extensionName].autoConnect) {
                startAutoConnect();
            }
        };

        ws.onerror = (error) => {
            updateWSStatus(false);
            updateDebugLog(`WebSocket错误: ${error}`);
        };
    } catch (error) {
        updateWSStatus(false);
        updateDebugLog(`创建WebSocket连接时出错: ${error.message}`);
        console.error(error);
    }
}

// 发送测试消息
function sendTestMessage(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        updateDebugLog('无法发送测试消息：WebSocket未连接');
        return;
    }
    
    try {
        const messageData = {
            type: 'test_message',
            content: message
        };
        
        ws.send(JSON.stringify(messageData));
        updateDebugLog(`已发送测试消息: ${message}`);
    } catch (error) {
        updateDebugLog(`发送测试消息时出错: ${error.message}`);
        console.error(error);
    }
}

// 断开WebSocket连接
function disconnectWebSocket() {
    if (ws) {
        ws.close();
    }
    updateWSStatus(false);
    updateConnectionButtons(false);
    updateDebugLog('已断开WebSocket连接');
    
    // 如果启用了自动重连，则开始尝试重新连接
    if (extension_settings[extensionName].autoConnect) {
        startAutoConnect();
    }
}

// 自动重连功能
function startAutoConnect() {
    if (autoConnectTimer) {
        clearInterval(autoConnectTimer);
    }
    
    autoConnectTimer = setInterval(() => {
        if (!ws || ws.readyState === WebSocket.CLOSED) {
            updateDebugLog('自动尝试重新连接...');
            setupWebSocket();
        }
    }, 5000);
}

// 停止自动重连
function stopAutoConnect() {
    if (autoConnectTimer) {
        clearInterval(autoConnectTimer);
        autoConnectTimer = null;
    }
}

// 发送聊天历史到WebSocket服务器
function sendChatHistory() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        updateDebugLog('无法发送聊天历史：WebSocket未连接');
        return;
    }
    
    try {
        const context = getContext();
        const chatHistory = {
            type: 'chat_history',
            content: {
                messages: chat.map(msg => ({
                    role: msg.is_user ? 'user' : 'assistant',
                    content: msg.mes,
                    name: msg.name
                }))
            }
        };
        
        ws.send(JSON.stringify(chatHistory));
        updateDebugLog(`已发送聊天历史，共${chat.length}条消息`);
    } catch (error) {
        updateDebugLog(`发送聊天历史时出错: ${error.message}`);
        console.error(error);
    }
}

// 监听聊天变化事件
function onChatChanged() {
     // 获取最新的消息
     const latestMessage = chat[chat.length - 1];
     // 打印
     console.log("latestMessage", latestMessage);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
    }
    
    try {
        // 获取最新的消息
        const latestMessage = chat[chat.length - 1];
        if (!latestMessage) return;
        
        const messageData = {
            type: 'chat_message',
            content: {
                role: latestMessage.is_user ? 'user' : 'assistant',
                content: latestMessage.mes,
                name: latestMessage.name
            }
        };
        
        ws.send(JSON.stringify(messageData));
        updateDebugLog(`已发送消息: ${latestMessage.mes}`);
    } catch (error) {
        updateDebugLog(`发送消息时出错: ${error.message}`);
        console.error(error);
    }
}

// 处理聊天消息
function handleChatMessage(data) {
    try {
        if (!data.content) {
            updateDebugLog('收到的聊天消息格式不正确');
            return;
        }
        
        const { role, content, name } = data.content;
        
        // 显示接收到的消息
        displayReceivedMessage(role, content, name);
        
        // 如果需要，可以将消息添加到SillyTavern的聊天中
        // 这里需要根据SillyTavern的API来实现
        updateDebugLog(`收到聊天消息: ${content} (来自: ${name}, 角色: ${role})`);
    } catch (error) {
        updateDebugLog(`处理聊天消息时出错: ${error.message}`);
        console.error(error);
    }
}

// 显示接收到的消息
function displayReceivedMessage(role, content, name) {
    // 这里可以根据需要实现显示消息的逻辑
    // 例如，可以创建一个新的div来显示消息
    const messageDiv = $('<div>').addClass('received-message');
    messageDiv.append($('<div>').addClass('message-header').text(`${name} (${role})`));
    messageDiv.append($('<div>').addClass('message-content').text(content));
    
    // 将消息添加到调试日志下方
    $('#debug_log').after(messageDiv);
    
    // 滚动到消息
    messageDiv[0].scrollIntoView({ behavior: 'smooth' });
}

function handleIncomingMessage() {
    // Handle message
     // 获取最新的消息
     const latestMessage = chat[chat.length - 1];
     // 打印
     console.log("latestMessage", latestMessage);
}

// 初始化扩展
jQuery(async () => {
    // 加载HTML模板
    const template = await $.get(`/scripts/extensions/third-party/${extensionName}/index.html`);
    $('#extensions_settings').append(template);
    
    // 设置初始值
    $('#ws_url').val(extension_settings[extensionName].wsUrl);
    $('#ws_port').val(extension_settings[extensionName].wsPort);
    $('#ws_auto_connect').prop('checked', extension_settings[extensionName].autoConnect);
    
    // 绑定事件处理
    $('#ws_connect').on('click', setupWebSocket);
    $('#ws_disconnect').on('click', disconnectWebSocket);
    
    // 绑定测试消息按钮事件
    $('#send_test_message').on('click', function() {
        const message = $('#test_message').val();
        if (message) {
            sendTestMessage(message);
        } else {
            updateDebugLog('请输入测试消息');
        }
    });
    
    // 保存设置
    $('#ws_url').on('change', function() {
        extension_settings[extensionName].wsUrl = $(this).val();
        saveSettingsDebounced();
    });
    
    $('#ws_port').on('change', function() {
        extension_settings[extensionName].wsPort = $(this).val();
        saveSettingsDebounced();
    });
    
    $('#ws_auto_connect').on('change', function() {
        const isChecked = $(this).prop('checked');
        extension_settings[extensionName].autoConnect = isChecked;
        saveSettingsDebounced();
        
        if (isChecked) {
            updateDebugLog('已启用自动重连');
            startAutoConnect();
        } else {
            updateDebugLog('已禁用自动重连');
            stopAutoConnect();
        }
    });
    
    // 监听聊天变化事件    
    eventSource.on(event_types.MESSAGE_RECEIVED, onChatChanged);    
    updateDebugLog('WebSocket客户端扩展初始化完成');
    
    // 如果启用了自动连接，则立即连接
    if (extension_settings[extensionName].autoConnect) {
        setupWebSocket();
    }
});

