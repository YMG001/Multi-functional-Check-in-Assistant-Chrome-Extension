# 多功能签到助手

这是一个支持多网站一键签到的Chrome浏览器扩展，具有可视化配置和智能等待功能。

## manifest.json 配置详解

```json
{
    "manifest_version": 3,
    "name": "多功能签到助手",
    "version": "2.0",
    "description": "支持多网站一键签到，可视化配置，智能等待的签到助手"
}
```

### 配置项说明

1. **基本信息**
   - `manifest_version`: Chrome扩展必须使用版本3
   - `name`: 扩展名称，显示在Chrome扩展管理页面
   - `version`: 扩展版本号
   - `description`: 扩展描述信息

2. **权限配置**
   - `storage`: 使用chrome.storage API存储配置数据
   - `activeTab`: 访问当前激活的标签页
   - `tabs`: 操作浏览器标签页
   - `scripting`: 执行脚本的权限
   - `host_permissions`: 允许扩展访问的网址范围

3. **界面配置**
   - `action`: 扩展图标点击时的行为配置
     - `default_popup`: 点击扩展图标时显示的弹出页面
     - `default_icon`: 扩展图标设置（支持多种尺寸）
   - `options_page`: 扩展的设置页面路径

4. **脚本注入**
   - `content_scripts`: 需要注入到网页中的内容脚本
     - `matches`: 匹配规则，指定在哪些页面注入脚本
     - `js`: 要注入的JavaScript文件列表
     - `run_at`: 指定脚本注入时机

5. **后台功能**
   - `background`: 后台服务工作者配置
     - `service_worker`: 后台脚本文件路径

## 核心功能模块

### 1. 后台服务（background.js）
- 处理一键签到功能
- 管理多标签页签到流程
- 处理消息通信

### 2. 内容脚本（content.js）
- 实现页面元素查找
- 执行签到操作
- 提供视觉反馈
- 处理测试功能

### 3. 弹出界面（popup.js）
- 显示网站列表
- 管理签到状态
- 提供操作入口
- 显示操作结果

### 4. 设置页面（options.js）
- 管理网站配置
- 提供可视化配置界面
- 支持配置测试
- 保存配置数据

## 使用说明

### 基本使用流程
1. 点击扩展图标打开popup页面
2. 点击"设置"按钮进入配置页面
3. 添加需要签到的网站配置
4. 返回popup页面，可以选择单个签到或一键签到

### 网站配置说明
1. **基本信息**
   - 网站名称：用于显示和识别
   - 网站URL：签到页面的完整地址
   - 等待时间：页面加载后的等待时间

2. **选择器配置**
   - 选择器类型：支持CSS/XPath/JavaScript
   - 签到按钮选择器：用于定位签到按钮
   - 已签到标识选择器：用于检测签到状态

3. **高级设置**
   - 关闭等待时间：签到成功后的等待时间
   - 自定义JavaScript：支持复杂的签到逻辑

## 开发技术栈
- Chrome Extension API
- JavaScript ES6+
- HTML5 & CSS3
- 异步编程
- 事件驱动架构

## 调试说明
1. 打开Chrome扩展管理页面（chrome://extensions/）
2. 开启开发者模式
3. 加载已解压的扩展程序
4. 查看后台页面和控制台输出

## 注意事项
1. 确保网站URL格式正确（包含http://或https://）
2. 选择器要尽可能精确定位到目标元素
3. 建议设置适当的等待时间，确保页面加载完成
4. 部分网站可能需要登录后才能进行签到
5. 请遵守网站的使用规则和条款 