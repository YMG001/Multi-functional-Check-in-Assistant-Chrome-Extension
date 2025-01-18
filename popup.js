/**
 * popup.js
 * 这是扩展的弹出页面脚本，负责展示网站列表和处理用户交互
 * 包括显示签到状态、执行签到操作、打开设置页面等功能
 */

// 存储网站配置和签到状态的全局变量
let siteConfigs = {};
let signInStatuses = {};

/**
 * 显示操作结果通知
 * @param {string} message - 要显示的消息
 * @param {string} type - 通知类型：success/error
 */
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    // 3秒后自动隐藏通知
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

/**
 * 更新网站的签到状态显示
 * @param {Element} siteElement - 网站元素
 * @param {string} status - 状态：success/pending/error
 * @param {string} message - 状态消息
 */
function updateSiteStatus(siteElement, status, message) {
    const statusBadge = siteElement.querySelector('.status-badge');
    const spinner = siteElement.querySelector('.loading-spinner');
    const signInBtn = siteElement.querySelector('.sign-in-btn');
    
    // 更新状态标签
    statusBadge.textContent = message;
    statusBadge.className = 'status-badge';
    
    // 根据不同状态更新UI
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

/**
 * 创建网站列表项元素
 * @param {string} siteId - 网站ID
 * @param {Object} config - 网站配置
 * @returns {Element} 创建的网站元素
 */
function createSiteElement(siteId, config) {
    const template = document.getElementById('site-template');
    const container = document.createElement('div');
    container.innerHTML = template.innerHTML;
    const siteElement = container.firstElementChild;
    
    // 设置网站信息
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

/**
 * 检查指定网站今天是否已经签到
 * @param {Object} status - 网站的签到状态
 * @returns {boolean} 是否已签到
 */
function isSignedInToday(status) {
    if (!status?.lastSignInDate) return false;
    
    const lastSignIn = new Date(status.lastSignInDate);
    const today = new Date();
    
    // 比较年月日是否相同
    return lastSignIn.getDate() === today.getDate() &&
           lastSignIn.getMonth() === today.getMonth() &&
           lastSignIn.getFullYear() === today.getFullYear();
}

/**
 * 更新整个界面显示
 * 包括网站列表和空状态提示
 */
function updateUI() {
    const container = document.querySelector('.sites-container');
    container.innerHTML = '';
    
    // 如果没有配置任何网站，显示空状态
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
    
    // 创建所有网站的列表项
    Object.entries(siteConfigs).forEach(([siteId, config]) => {
        const siteElement = createSiteElement(siteId, config);
        container.appendChild(siteElement);
    });
}

/**
 * 处理单个网站的签到操作
 * @param {string} siteId - 要签到的网站ID
 */
async function handleSingleSignIn(siteId) {
    const config = siteConfigs[siteId];
    if (!config) return;
    
    const siteElement = document.querySelector(`[data-site-id="${siteId}"]`);
    updateSiteStatus(siteElement, 'pending', '正在签到...');
    
    try {
        // 获取是否显示签到过程的设置
        const showProcess = document.getElementById('showProcessSwitch').checked;
        
        // 创建新标签页访问目标网站
        const tab = await new Promise((resolve, reject) => {
            chrome.tabs.create({ 
                url: config.url, 
                active: showProcess  // 根据设置决定是否显示标签页
            }, (newTab) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(newTab);
                }
            });
        });
        
        // 如果需要显示过程，确保窗口可见
        if (showProcess) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
        
        // 等待页面加载完成
        await new Promise((resolve, reject) => {
            function checkComplete() {
                chrome.tabs.get(tab.id, function(tabInfo) {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    
                    if (!tabInfo) {
                        reject(new Error('标签页不存在'));
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
        
        // 执行签到操作
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'TRIGGER_SIGN_IN',
                config: config
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
        
        // 处理签到结果
        if (response?.success) {
            updateSiteStatus(siteElement, 'success', '签到成功');
            showNotification(`${config.name} 签到成功！`);
            
            // 更新签到状态
            signInStatuses[siteId] = {
                lastSignInDate: new Date().toISOString(),
                lastMessage: response.message
            };
            await chrome.storage.local.set({ signInStatuses });

            // 如果设置了关闭等待时间，则等待指定时间
            if (config.closeWaitTime > 0) {
                updateSiteStatus(siteElement, 'success', `等待${config.closeWaitTime}秒后关闭`);
                await new Promise(resolve => setTimeout(resolve, config.closeWaitTime * 1000));
            }
        } else {
            updateSiteStatus(siteElement, 'error', '签到失败');
            showNotification(`${config.name} 签到失败: ${response?.message || '未知错误'}`, 'error');
        }
        
        // 关闭标签页
        await new Promise((resolve, reject) => {
            chrome.tabs.remove(tab.id, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
        
    } catch (error) {
        console.error('签到过程出错:', error);
        updateSiteStatus(siteElement, 'error', '签到失败');
        showNotification(`${config.name} 签到失败: ${error.message || '未知错误'}`, 'error');
    }
}

/**
 * 处理一键签到功能
 * 通过background脚本执行所有网站的签到
 */
async function handleOneClickSignIn() {
    // 禁用所有按钮，防止重复操作
    document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    
    try {
        // 获取是否显示签到过程的设置
        const showProcess = document.getElementById('showProcessSwitch').checked;
        
        // 发送一键签到请求给background脚本
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ 
                type: 'ONE_CLICK_SIGN_IN',
                showProcess: showProcess  // 传递显示选项
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
        
        if (response?.success) {
            showNotification('一键签到完成！');
            // 重新加载状态以更新显示
            await loadConfigsAndStatus();
        } else {
            showNotification('一键签到失败: ' + (response?.message || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('一键签到出错:', error);
        showNotification('一键签到失败: ' + (error.message || '未知错误'), 'error');
    } finally {
        // 恢复按钮状态
        document.querySelectorAll('.btn').forEach(btn => btn.disabled = false);
    }
}

/**
 * 打开扩展的设置页面
 */
function openSettings() {
    chrome.runtime.openOptionsPage();
}

/**
 * 从存储中加载配置和状态
 */
async function loadConfigsAndStatus() {
    const result = await chrome.storage.local.get(['siteConfigs', 'signInStatuses']);
    siteConfigs = result.siteConfigs || {};
    signInStatuses = result.signInStatuses || {};
    updateUI();
}

/**
 * 保存显示过程设置到存储
 */
async function saveShowProcessSetting() {
    const showProcess = document.getElementById('showProcessSwitch').checked;
    await chrome.storage.local.set({ showProcess });
}

/**
 * 从存储中加载显示过程设置
 */
async function loadShowProcessSetting() {
    const result = await chrome.storage.local.get(['showProcess']);
    document.getElementById('showProcessSwitch').checked = result.showProcess || false;
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    // 如果配置更新了，重新加载界面
    if (message.type === 'CONFIG_UPDATED') {
        loadConfigsAndStatus();
    }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载配置和状态
    loadConfigsAndStatus();
    
    // 加载显示过程设置
    loadShowProcessSetting();
    
    // 绑定按钮事件
    document.getElementById('oneClickSignIn').addEventListener('click', handleOneClickSignIn);
    document.getElementById('openSettings').addEventListener('click', openSettings);
    
    // 绑定显示过程开关事件
    document.getElementById('showProcessSwitch').addEventListener('change', saveShowProcessSetting);
}); 