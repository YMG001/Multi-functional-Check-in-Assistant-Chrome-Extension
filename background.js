/**
 * background.js
 * 这是扩展的后台脚本，负责处理一键签到功能和消息通信
 */

/**
 * 处理一键签到的主要函数
 * 遍历所有配置的网站，依次执行签到操作
 * @param {Object} options - 签到选项
 * @param {boolean} options.showProcess - 是否显示签到过程
 * @returns {Promise<{success: boolean, results?: Array, message?: string}>}
 */
async function handleOneClickSignIn(options = { showProcess: false }) {
    try {
        // 从本地存储获取所有配置的网站信息
        const result = await chrome.storage.local.get(['siteConfigs']);
        const configs = result.siteConfigs || {};
        
        // 用于记录每个网站的签到结果
        const results = [];
        
        // 依次处理每个网站的签到
        for (const [siteId, config] of Object.entries(configs)) {
            try {
                // 创建新标签页访问目标网站
                // active: options.showProcess 表示根据选项决定是否显示标签页
                const tab = await new Promise((resolve) => {
                    chrome.tabs.create({ 
                        url: config.url, 
                        active: options.showProcess  // 根据选项决定是否激活标签页
                    }, (tab) => resolve(tab));
                });
                
                // 如果需要显示过程，确保标签页可见
                if (options.showProcess) {
                    await chrome.windows.update(tab.windowId, { focused: true });
                }
                
                // 等待页面完全加载
                // 通过轮询检查标签页状态实现
                await new Promise((resolve) => {
                    function checkComplete() {
                        chrome.tabs.get(tab.id, function(tabInfo) {
                            if (chrome.runtime.lastError || !tabInfo) {
                                resolve();
                                return;
                            }
                            
                            if (tabInfo.status === 'complete') {
                                resolve();
                            } else {
                                setTimeout(checkComplete, 500);
                            }
                        });
                    }
                    checkComplete();
                });
                
                // 等待配置中指定的时间（默认2秒）
                // 这个等待时间用于确保页面上的元素都已经渲染完成
                await new Promise(resolve => setTimeout(resolve, (config.waitTime || 2) * 1000));
                
                // 向content script发送签到命令
                const response = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'TRIGGER_SIGN_IN',
                        config: config,
                        showProcess: options.showProcess  // 传递显示选项
                    }, (response) => {
                        resolve(response);
                    });
                });
                
                // 记录签到结果
                results.push({
                    siteId,
                    name: config.name,
                    success: response?.success || false,
                    message: response?.message || '签到失败'
                });

                // 如果签到成功且设置了关闭等待时间，则等待指定时间
                // 这个等待时间用于让用户能够看到签到结果
                if (response?.success && config.closeWaitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, config.closeWaitTime * 1000));
                }
                
                // 关闭签到用的标签页
                await new Promise(resolve => {
                    chrome.tabs.remove(tab.id, resolve);
                });
                
                // 每个网站之间等待1秒，避免过快操作
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`网站 ${config.name} 签到失败:`, error);
                results.push({
                    siteId,
                    name: config.name,
                    success: false,
                    message: error.message || '签到过程出错'
                });
            }
        }
        
        // 更新签到状态到本地存储
        const signInStatuses = {};
        results.forEach(result => {
            if (result.success) {
                signInStatuses[result.siteId] = {
                    lastSignInDate: new Date().toISOString(),
                    lastMessage: result.message
                };
            }
        });
        
        await chrome.storage.local.set({ signInStatuses });
        
        // 返回签到结果
        return {
            success: results.some(r => r.success), // 只要有一个网站签到成功就算成功
            results: results
        };
        
    } catch (error) {
        console.error('一键签到过程出错:', error);
        return {
            success: false,
            message: error.message || '一键签到失败'
        };
    }
}

// 监听来自popup页面的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    if (message.type === 'ONE_CLICK_SIGN_IN') {
        // 使用立即执行的async函数包装异步操作
        // 因为chrome.runtime.onMessage不支持直接使用async函数
        (async () => {
            try {
                const result = await handleOneClickSignIn({
                    showProcess: message.showProcess || false  // 从消息中获取显示选项
                });
                sendResponse(result);
            } catch (error) {
                console.error('一键签到执行出错:', error);
                sendResponse({
                    success: false,
                    message: error.message || '一键签到执行失败'
                });
            }
        })();
        return true; // 保持消息通道打开，等待异步操作完成
    }
}); 