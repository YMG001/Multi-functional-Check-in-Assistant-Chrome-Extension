// 处理一键签到
async function handleOneClickSignIn() {
    try {
        // 获取所有配置的网站
        const result = await chrome.storage.local.get(['siteConfigs']);
        const configs = result.siteConfigs || {};
        
        // 记录签到结果
        const results = [];
        
        // 依次处理每个网站
        for (const [siteId, config] of Object.entries(configs)) {
            try {
                // 创建新标签页
                const tab = await new Promise((resolve) => {
                    chrome.tabs.create({ 
                        url: config.url, 
                        active: false 
                    }, (tab) => resolve(tab));
                });
                
                // 等待页面加载完成
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
                
                // 等待配置的等待时间
                await new Promise(resolve => setTimeout(resolve, (config.waitTime || 2) * 1000));
                
                // 执行签到
                const response = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'TRIGGER_SIGN_IN',
                        config: config
                    }, (response) => {
                        resolve(response);
                    });
                });
                
                // 记录结果
                results.push({
                    siteId,
                    name: config.name,
                    success: response?.success || false,
                    message: response?.message || '签到失败'
                });
                
                // 关闭标签页
                await new Promise(resolve => {
                    chrome.tabs.remove(tab.id, resolve);
                });
                
                // 每个网站之间等待1秒
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
        
        // 更新签到状态
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
        
        // 返回结果
        return {
            success: results.some(r => r.success),
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

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    if (message.type === 'ONE_CLICK_SIGN_IN') {
        handleOneClickSignIn().then(sendResponse);
        return true; // 保持消息通道打开
    }
}); 