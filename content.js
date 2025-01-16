// 查找元素
async function findElement(selector, type = 'css') {
    let element = null;
    
    try {
        switch (type.toLowerCase()) {
            case 'css':
                element = document.querySelector(selector);
                break;
            case 'xpath':
                element = document.evaluate(
                    selector,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                break;
            case 'js':
                // 使用Function构造器来执行JS代码
                element = new Function('return ' + selector)();
                break;
        }
    } catch (error) {
        console.error('查找元素时出错:', error);
        return null;
    }
    
    return element;
}

// 获取元素详细信息
function getElementDetails(element) {
    if (!element) return null;
    
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    return {
        text: element.textContent?.trim() || element.value || element.alt || '',
        tagName: element.tagName.toLowerCase(),
        position: `(${Math.round(rect.left)}, ${Math.round(rect.top)})`,
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        visibility: {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            isVisible: computedStyle.display !== 'none' && 
                      computedStyle.visibility !== 'hidden' && 
                      computedStyle.opacity !== '0'
        },
        attributes: {
            id: element.id,
            class: element.className,
            type: element.type,
            href: element.href,
            src: element.src
        }
    };
}

// 添加视觉反馈样式
function addVisualFeedbackStyles() {
    const styleId = 'visual-feedback-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .sign-helper-highlight {
            position: relative !important;
            transition: all 0.3s ease-in-out !important;
            box-shadow: 0 0 0 2px #2196F3,
                       0 0 15px rgba(33, 150, 243, 0.5) !important;
            border-radius: 4px !important;
            z-index: 10000 !important;
        }

        .sign-helper-highlight::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border-radius: 6px;
            background: rgba(33, 150, 243, 0.2);
            animation: pulse 1.5s infinite;
        }

        .sign-helper-pointer {
            position: fixed;
            width: 20px;
            height: 20px;
            background: rgba(244, 67, 54, 0.9);
            border: 2px solid white;
            border-radius: 50%;
            pointer-events: none;
            z-index: 10001;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
            animation: pointer-appear 0.3s ease-out;
        }

        .sign-helper-pointer.clicking {
            transform: scale(0.8);
            background: rgba(244, 67, 54, 0.7);
        }

        .sign-helper-tooltip {
            position: fixed;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            pointer-events: none;
            z-index: 10002;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: tooltip-appear 0.3s ease-out;
            white-space: nowrap;
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.05); opacity: 0.4; }
            100% { transform: scale(1); opacity: 0.6; }
        }

        @keyframes pointer-appear {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes tooltip-appear {
            0% { transform: translateY(10px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// 创建视觉反馈元素
function createVisualElements() {
    // 创建鼠标指针
    const pointer = document.createElement('div');
    pointer.className = 'sign-helper-pointer';
    
    // 创建提示框
    const tooltip = document.createElement('div');
    tooltip.className = 'sign-helper-tooltip';
    
    document.body.appendChild(pointer);
    document.body.appendChild(tooltip);
    
    return { pointer, tooltip };
}

// 移动视觉元素到目标位置
async function moveToElement(element, pointer, tooltip, message) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // 更新提示框位置和内容
    tooltip.textContent = message;
    tooltip.style.left = `${centerX + 30}px`;
    tooltip.style.top = `${centerY}px`;
    
    // 平滑移动指针
    pointer.style.left = `${centerX - 10}px`;
    pointer.style.top = `${centerY - 10}px`;
    
    // 等待过渡完成
    await new Promise(resolve => setTimeout(resolve, 300));
}

// 模拟点击动作
async function simulateClick(pointer) {
    pointer.classList.add('clicking');
    await new Promise(resolve => setTimeout(resolve, 200));
    pointer.classList.remove('clicking');
    await new Promise(resolve => setTimeout(resolve, 200));
}

// 清理视觉效果
async function cleanupVisualEffects(element, pointer, tooltip) {
    // 淡出效果
    pointer.style.opacity = '0';
    tooltip.style.opacity = '0';
    element.classList.remove('sign-helper-highlight');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    pointer.remove();
    tooltip.remove();
}

// 测试配置
async function testConfig(config, needDetails = false) {
    try {
        // 添加视觉反馈样式
        addVisualFeedbackStyles();
        
        const element = await findElement(config.signSelector, config.selectorType);
        
        if (!element) {
            return {
                success: false,
                message: '未找到目标元素'
            };
        }
        
        // 创建视觉元素
        const { pointer, tooltip } = createVisualElements();
        
        // 第一步：高亮显示元素
        element.classList.add('sign-helper-highlight');
        await moveToElement(element, pointer, tooltip, '找到目标元素');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 第二步：显示可点击状态
        await moveToElement(element, pointer, tooltip, '准备点击元素');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 第三步：模拟点击
        await moveToElement(element, pointer, tooltip, '模拟点击事件');
        await simulateClick(pointer);
        
        // 获取元素详情
        const details = getElementDetails(element);
        
        // 清理视觉效果
        await cleanupVisualEffects(element, pointer, tooltip);
        
        return {
            success: true,
            message: '测试完成',
            elementDetails: needDetails ? details : null
        };
    } catch (error) {
        console.error('测试配置时出错:', error);
        return {
            success: false,
            message: error.message || '测试过程出错'
        };
    }
}

// 执行签到
async function executeSignIn(config) {
    try {
        const element = await findElement(config.signSelector, config.selectorType);
        
        if (!element) {
            return {
                success: false,
                message: '未找到签到按钮'
            };
        }
        
        // 确保元素在视口内
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 等待滚动完成
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 尝试点击
        element.click();
        
        // 等待可能的动画或加载
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 如果配置了已签到标识，检查是否签到成功
        if (config.signedSelector) {
            const signedElement = await findElement(config.signedSelector, config.selectorType);
            if (signedElement) {
                return {
                    success: true,
                    message: '签到成功'
                };
            }
        }
        
        // 如果没有配置已签到标识，假定点击成功就是签到成功
        return {
            success: true,
            message: '已点击签到按钮'
        };
    } catch (error) {
        console.error('执行签到时出错:', error);
        return {
            success: false,
            message: error.message || '签到过程出错'
        };
    }
}

// 监听来自popup或options页面的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    switch (message.type) {
        case 'TEST_CONFIG':
            testConfig(message.config, message.needDetails)
                .then(sendResponse);
            break;
        case 'TRIGGER_SIGN_IN':
            executeSignIn(message.config)
                .then(sendResponse);
            break;
    }
    
    // 返回true表示将异步发送响应
    return true;
}); 