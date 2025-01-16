// 生成唯一ID
function generateUniqueId() {
    return 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 创建新的网站配置
function createSiteConfig(template, siteId = '', config = null) {
    const siteElement = template.content.cloneNode(true).querySelector('.site-config');
    siteElement.dataset.siteId = siteId || generateUniqueId();
    
    // 填充配置数据
    if (config) {
        siteElement.querySelector('.site-name').value = config.name || '';
        siteElement.querySelector('.site-url').value = config.url || '';
        siteElement.querySelector('.selector-type').value = config.selectorType || 'xpath';
        siteElement.querySelector('.wait-time').value = config.waitTime || 2;
        siteElement.querySelector('.sign-selector').value = config.signSelector || '';
        siteElement.querySelector('.signed-selector').value = config.signedSelector || '';
    }
    
    // 绑定按钮事件
    siteElement.querySelector('.test-btn').addEventListener('click', () => testSiteConfig(siteElement));
    siteElement.querySelector('.save-btn').addEventListener('click', () => saveSiteConfig(siteElement));
    siteElement.querySelector('.delete-btn').addEventListener('click', () => deleteSiteConfig(siteElement));
    
    return siteElement;
}

// 加载配置
function loadConfigs() {
    const sitesContainer = document.getElementById('sites-container');
    const template = document.getElementById('site-template');
    
    chrome.storage.local.get(['siteConfigs'], function(result) {
        const configs = result.siteConfigs || {};
        
        // 清空容器
        sitesContainer.innerHTML = '';
        
        // 添加所有配置
        Object.entries(configs).forEach(([siteId, config]) => {
            const siteElement = createSiteConfig(template, siteId, config);
            sitesContainer.appendChild(siteElement);
        });
    });
}

// 保存网站配置
async function saveSiteConfig(siteElement) {
    const siteId = siteElement.dataset.siteId;
    const config = {
        name: siteElement.querySelector('.site-name').value,
        url: siteElement.querySelector('.site-url').value,
        selectorType: siteElement.querySelector('.selector-type').value,
        waitTime: parseInt(siteElement.querySelector('.wait-time').value) || 2,
        signSelector: siteElement.querySelector('.sign-selector').value,
        signedSelector: siteElement.querySelector('.signed-selector').value
    };

    // 验证必填字段
    if (!config.name || !config.url || !config.signSelector) {
        showTestResult(siteElement, '请填写必填字段', false);
        return;
    }

    try {
        // 验证URL格式
        new URL(config.url);
        
        const result = await chrome.storage.local.get(['siteConfigs']);
        const configs = result.siteConfigs || {};
        configs[siteId] = config;
        
        await chrome.storage.local.set({ siteConfigs: configs });
        
        // 显示保存成功提示
        showTestResult(siteElement, '配置已保存', true);
        
        // 广播配置更新
        chrome.runtime.sendMessage({
            type: 'CONFIG_UPDATED',
            configs: configs
        });
        
        // 延迟1秒后返回到popup页面
        setTimeout(() => {
            window.close();
        }, 1000);
    } catch (error) {
        showTestResult(siteElement, '保存失败：' + error.message, false);
    }
}

// 删除网站配置
async function deleteSiteConfig(siteElement) {
    const siteId = siteElement.dataset.siteId;
    
    try {
        const result = await chrome.storage.local.get(['siteConfigs']);
        const configs = result.siteConfigs || {};
        delete configs[siteId];
        
        await chrome.storage.local.set({ siteConfigs: configs });
        
        // 广播配置更新
        chrome.runtime.sendMessage({
            type: 'CONFIG_UPDATED',
            configs: configs
        });
        
        // 移除元素
        siteElement.remove();
    } catch (error) {
        console.error('删除配置失败:', error);
    }
}

// 测试网站配置
async function testSiteConfig(siteElement) {
    const config = {
        name: siteElement.querySelector('.site-name').value,
        url: siteElement.querySelector('.site-url').value,
        selectorType: siteElement.querySelector('.selector-type').value,
        waitTime: parseInt(siteElement.querySelector('.wait-time').value) || 2,
        signSelector: siteElement.querySelector('.sign-selector').value,
        signedSelector: siteElement.querySelector('.signed-selector').value
    };

    // 验证必填字段
    if (!config.name || !config.url || !config.signSelector) {
        showTestResult(siteElement, '请填写必填字段', false);
        return;
    }

    // 验证URL格式
    try {
        new URL(config.url);
    } catch (error) {
        showTestResult(siteElement, '无效的URL格式', false);
        return;
    }

    let tab;
    try {
        showTestResult(siteElement, '正在打开测试页面...', true);
        
        // 打开新标签页
        tab = await new Promise((resolve) => {
            chrome.tabs.create({ 
                url: config.url, 
                active: true 
            }, (newTab) => resolve(newTab));
        });
        
        // 等待页面加载完成
        await new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20; // 最多等待10秒
            
            function checkComplete() {
                if (attempts >= maxAttempts) {
                    reject(new Error('页面加载超时'));
                    return;
                }
                
                chrome.tabs.get(tab.id, function(tabInfo) {
                    if (chrome.runtime.lastError) {
                        reject(new Error('标签页已关闭'));
                        return;
                    }
                    
                    if (tabInfo.status === 'complete') {
                        resolve();
                    } else {
                        attempts++;
                        setTimeout(checkComplete, 500);
                    }
                });
            }
            checkComplete();
        });
        
        // 等待配置的等待时间
        await new Promise(resolve => setTimeout(resolve, config.waitTime * 1000));
        
        showTestResult(siteElement, '正在测试配置...', true);
        
        // 执行测试，增加详细的元素信息返回
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'TEST_CONFIG',
                config: config,
                needDetails: true  // 请求返回详细信息
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
        
        if (response?.success) {
            let resultMessage = '测试成功：找到目标元素';
            if (response.elementDetails) {
                resultMessage += `\n元素文本：${response.elementDetails.text || '无文本'}`;
                resultMessage += `\n元素类型：${response.elementDetails.tagName}`;
                resultMessage += `\n元素位置：${response.elementDetails.position}`;
            }
            showTestResult(siteElement, resultMessage, true);
        } else {
            showTestResult(siteElement, '测试失败：' + (response?.message || '未知错误'), false);
        }
    } catch (error) {
        console.error('测试过程出错:', error);
        let errorMessage = '测试失败：';
        
        if (error.message.includes('Could not establish connection')) {
            errorMessage += '请确保页面已完全加载，可以刷新页面后重试';
        } else if (error.message.includes('页面加载超时')) {
            errorMessage += '页面加载时间过长，请检查网络连接';
        } else if (error.message.includes('标签页已关闭')) {
            errorMessage += '测试页面被意外关闭';
        } else {
            errorMessage += error.message || '无法连接到页面';
        }
        
        showTestResult(siteElement, errorMessage, false);
    } finally {
        // 如果测试失败，关闭测试标签页
        if (tab) {
            try {
                chrome.tabs.remove(tab.id);
            } catch (e) {
                console.error('关闭标签页失败:', e);
            }
        }
    }
}

// 显示测试结果（支持多行消息）
function showTestResult(siteElement, message, success) {
    const resultDiv = siteElement.querySelector('.test-result');
    // 将\n转换为<br>标签
    resultDiv.innerHTML = message.replace(/\n/g, '<br>');
    resultDiv.style.display = 'block';
    resultDiv.className = `test-result ${success ? 'test-success' : 'test-error'}`;
    
    // 如果不是最终结果，不要自动隐藏
    if (message.includes('成功') || message.includes('失败')) {
        // 对于详细信息，延长显示时间
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 5000);  // 增加到5秒
    }
}

// 返回到popup页面
function backToPopup() {
    window.close();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载现有配置
    loadConfigs();
    
    // 绑定返回按钮事件
    document.getElementById('backBtn').addEventListener('click', backToPopup);
    
    // 绑定添加按钮事件
    document.getElementById('addSiteBtn').addEventListener('click', function() {
        const template = document.getElementById('site-template');
        const sitesContainer = document.getElementById('sites-container');
        const newSite = createSiteConfig(template);
        sitesContainer.appendChild(newSite);
    });
}); 