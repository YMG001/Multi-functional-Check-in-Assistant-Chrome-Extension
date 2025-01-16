// 网站配置和状态管理
let siteConfigs = {};
let signInStatuses = {};

// 显示通知
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// 更新网站状态显示
function updateSiteStatus(siteElement, status, message) {
    const statusBadge = siteElement.querySelector('.status-badge');
    const spinner = siteElement.querySelector('.loading-spinner');
    const signInBtn = siteElement.querySelector('.sign-in-btn');
    
    statusBadge.textContent = message;
    statusBadge.className = 'status-badge';
    
    switch (status) {
        case 'success':
            statusBadge.classList.add('status-success');
            spinner.style.display = 'none';
            signInBtn.disabled = true;
            signInBtn.textContent = '今日已签到';
            break;
        case 'pending':
            statusBadge.classList.add('status-pending');
            spinner.style.display = 'block';
            signInBtn.disabled = true;
            break;
        case 'error':
            statusBadge.classList.add('status-error');
            spinner.style.display = 'none';
            signInBtn.disabled = false;
            break;
        default:
            statusBadge.style.display = 'none';
            spinner.style.display = 'none';
            signInBtn.disabled = false;
    }
}

// 创建网站元素
function createSiteElement(siteId, config) {
    const template = document.getElementById('site-template');
    const container = document.createElement('div');
    container.innerHTML = template.innerHTML;
    const siteElement = container.firstElementChild;
    
    siteElement.dataset.siteId = siteId;
    siteElement.querySelector('.site-name').textContent = config.name;
    siteElement.querySelector('.site-url').textContent = new URL(config.url).hostname;
    
    // 绑定签到按钮事件
    const signInBtn = siteElement.querySelector('.sign-in-btn');
    signInBtn.addEventListener('click', () => handleSingleSignIn(siteId));
    
    // 检查今日是否已签到
    const status = signInStatuses[siteId];
    if (status && isSignedInToday(status)) {
        updateSiteStatus(siteElement, 'success', '今日已签到');
    }
    
    return siteElement;
}

// 检查今天是否已经签到
function isSignedInToday(status) {
    if (!status?.lastSignInDate) return false;
    
    const lastSignIn = new Date(status.lastSignInDate);
    const today = new Date();
    
    return lastSignIn.getDate() === today.getDate() &&
           lastSignIn.getMonth() === today.getMonth() &&
           lastSignIn.getFullYear() === today.getFullYear();
}

// 更新UI显示
function updateUI() {
    const container = document.querySelector('.sites-container');
    container.innerHTML = '';
    
    if (Object.keys(siteConfigs).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>还没有配置任何网站</p>
                <button id="addSiteBtn" class="btn btn-primary">添加网站</button>
            </div>
        `;
        document.getElementById('addSiteBtn')?.addEventListener('click', openSettings);
        return;
    }
    
    Object.entries(siteConfigs).forEach(([siteId, config]) => {
        const siteElement = createSiteElement(siteId, config);
        container.appendChild(siteElement);
    });
}

// 处理单个网站签到
async function handleSingleSignIn(siteId) {
    const config = siteConfigs[siteId];
    if (!config) return;
    
    const siteElement = document.querySelector(`[data-site-id="${siteId}"]`);
    updateSiteStatus(siteElement, 'pending', '正在签到...');
    
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
        
        // 处理结果
        if (response?.success) {
            updateSiteStatus(siteElement, 'success', '签到成功');
            showNotification(`${config.name} 签到成功！`);
            
            // 更新签到状态
            signInStatuses[siteId] = {
                lastSignInDate: new Date().toISOString(),
                lastMessage: response.message
            };
            await chrome.storage.local.set({ signInStatuses });
        } else {
            updateSiteStatus(siteElement, 'error', '签到失败');
            showNotification(`${config.name} 签到失败: ${response?.message || '未知错误'}`, 'error');
        }
        
        // 关闭标签页
        await new Promise(resolve => {
            chrome.tabs.remove(tab.id, resolve);
        });
        
    } catch (error) {
        console.error('签到过程出错:', error);
        updateSiteStatus(siteElement, 'error', '签到失败');
        showNotification(`${config.name} 签到失败: ${error.message || '未知错误'}`, 'error');
    }
}

// 处理一键签到
async function handleOneClickSignIn() {
    // 禁用所有按钮
    document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    
    try {
        const response = await chrome.runtime.sendMessage({ type: 'ONE_CLICK_SIGN_IN' });
        
        if (response?.success) {
            showNotification('一键签到完成！');
            // 重新加载状态
            await loadConfigsAndStatus();
        } else {
            showNotification('一键签到失败: ' + (response?.message || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('一键签到出错:', error);
        showNotification('一键签到失败: ' + error.message, 'error');
    } finally {
        // 恢复按钮状态
        document.querySelectorAll('.btn').forEach(btn => btn.disabled = false);
    }
}

// 打开设置页面
function openSettings() {
    chrome.runtime.openOptionsPage();
}

// 加载配置和状态
async function loadConfigsAndStatus() {
    const result = await chrome.storage.local.get(['siteConfigs', 'signInStatuses']);
    siteConfigs = result.siteConfigs || {};
    signInStatuses = result.signInStatuses || {};
    updateUI();
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    if (message.type === 'CONFIG_UPDATED') {
        loadConfigsAndStatus();
    }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载配置和状态
    loadConfigsAndStatus();
    
    // 绑定按钮事件
    document.getElementById('oneClickSignIn').addEventListener('click', handleOneClickSignIn);
    document.getElementById('openSettings').addEventListener('click', openSettings);
}); 