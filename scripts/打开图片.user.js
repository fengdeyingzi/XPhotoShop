// ==UserScript==
// @name         XPhotoShop 图片打开插件
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @author       风的影子
// @description  为XPhotoShop添加打开常见图片格式功能（JPG/PNG/BMP/WebP）
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 添加自定义对话框样式
    const style = document.createElement('style');
    style.textContent = `
        .custom-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        .custom-dialog {
            background: white;
            border-radius: 8px;
            padding: 24px;
            min-width: 320px;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .custom-dialog-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 12px;
            color: #333;
        }
        .custom-dialog-message {
            font-size: 14px;
            line-height: 1.5;
            color: #666;
            margin-bottom: 20px;
        }
        .custom-dialog-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .custom-dialog-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .custom-dialog-btn-primary {
            background: #3498db;
            color: white;
        }
        .custom-dialog-btn-primary:hover {
            background: #2980b9;
        }
        .custom-dialog-btn-secondary {
            background: #95a5a6;
            color: white;
        }
        .custom-dialog-btn-secondary:hover {
            background: #7f8c8d;
        }
    `;
    document.head.appendChild(style);

    // 自定义对话框函数
    function showDialog(title, message, primaryText, secondaryText) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';

            dialog.innerHTML = `
                <div class="custom-dialog-title">${title}</div>
                <div class="custom-dialog-message">${message}</div>
                <div class="custom-dialog-buttons">
                    <button class="custom-dialog-btn custom-dialog-btn-secondary" data-action="secondary">${secondaryText}</button>
                    <button class="custom-dialog-btn custom-dialog-btn-primary" data-action="primary">${primaryText}</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action) {
                    document.body.removeChild(overlay);
                    resolve(action === 'primary');
                }
            });
        });
    }

    // 等待应用加载
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(initOpenImageFeature, 1000);
    });

    function initOpenImageFeature() {
        const app = window.photoShopApp;
        
        if (!app) {
            console.warn('PhotoShop应用未找到，将在500ms后重试...');
            setTimeout(initOpenImageFeature, 500);
            return;
        }

        console.log('正在初始化图片打开插件...');

        // 检查Toast是否存在
        if (typeof Toast === 'undefined') {
            console.warn('Toast系统未找到，将使用alert替代');
        }

        // 添加"打开图片"菜单项到"文件"菜单的顶部
        app.menuManager.addMenuItem('文件', {
            label: '打开图片',
            action: 'open-image',
            handler: handleOpenImage,
            position: 'top',
            divider: false
        });

        console.log('图片打开插件初始化完成！');
        
    }

    function handleOpenImage(app) {
        // 创建文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.jpg,.jpeg,.png,.bmp,.webp,image/jpeg,image/png,image/bmp,image/webp';
        fileInput.multiple = false;
        fileInput.style.display = 'none';
        
        // 添加文件选择事件监听器
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                processImageFile(file, app);
            }
            
            // 清理文件输入
            document.body.removeChild(fileInput);
        });
        
        // 添加到文档并触发点击
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    async function processImageFile(file, app) {
        // 检查文件类型
        const validTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showNotification('不支持的图片格式。请选择JPG、PNG、BMP或WebP格式的图片。', 'warning');
            return;
        }

        // 询问是否重新创建画布
        const recreateCanvas = await showDialog(
            '打开图片',
            '请选择图片导入方式：',
            '重新创建画布',
            '适应当前画布'
        );

        console.log(`正在加载图片: ${file.name}`);

        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();

            img.onload = function() {
                try {
                    if (recreateCanvas) {
                        // 清除所有图层并重新创建画布
                        app.layerManager.clearLayers();

                        // 更新配置尺寸
                        app.config.width = img.width;
                        app.config.height = img.height;

                        // 调整画布和选区管理器尺寸
                        app.canvasManager.resize(img.width, img.height);
                        app.selectionManager.resize(img.width, img.height);

                        const newLayer = app.layerManager.addLayer(img.width, img.height, file.name.replace(/\.[^/.]+$/, ""));
                        newLayer.ctx.drawImage(img, 0, 0);

                        showNotification(`画布已重建: ${file.name} (${img.width}×${img.height})`, 'success');
                    } else {
                        // 将图片适应画布大小
                        const canvasWidth = app.canvasManager.width;
                        const canvasHeight = app.canvasManager.height;
                        const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height, 1);
                        const scaledWidth = Math.floor(img.width * scale);
                        const scaledHeight = Math.floor(img.height * scale);

                        const newLayer = app.layerManager.addLayer(canvasWidth, canvasHeight, file.name.replace(/\.[^/.]+$/, ""));
                        newLayer.ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

                        showNotification(`图片已置入: ${file.name} (${scaledWidth}×${scaledHeight})`, 'success');
                    }

                    app.layerManager.setActiveLayer(app.layerManager.layers.length - 1);
                    app.renderLayerList();
                    app.render();

                    if (app.saveHistory) {
                        app.saveHistory();
                    } else if (app.eventManager && app.eventManager.saveState) {
                        app.eventManager.saveState({
                            layers: app.layerManager.layers,
                            activeLayerIndex: app.layerManager.activeLayerIndex
                        });
                    }
                } catch (error) {
                    console.error('处理图片时出错:', error);
                    showNotification(`处理图片失败: ${error.message}`, 'error');
                }
            };

            img.onerror = function() {
                showNotification('图片加载失败，可能文件已损坏', 'error');
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            showNotification('读取文件失败', 'error');
        };

        reader.readAsDataURL(file);
    }

    // 显示通知的辅助函数（兼容Toast和alert）
    function showNotification(message, type = 'info') {
        // 优先使用Toast系统
        if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
            Toast.show(message, type, 3000);
        } else {
            // 备用方案：使用alert或控制台日志
            const prefix = type === 'error' ? '❌ ' : 
                          type === 'warning' ? '⚠️ ' : 
                          type === 'success' ? '✅ ' : 'ℹ️ ';
            
            console.log(`${prefix}${message}`);
            
            // 对于重要错误，使用alert
            if (type === 'error') {
                alert(`错误: ${message}`);
            }
        }
    }

    // 备用初始化方法
    let initAttempts = 0;
    const maxInitAttempts = 20;
    
    function tryInit() {
       
    
                    initOpenImageFeature();
       
      
    }
    
    // 如果DOMContentLoaded事件已经触发，直接尝试初始化
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        tryInit();
    }

    // 调试信息
    console.log('XPhotoShop 图片打开插件已加载');
    
    // 添加全局辅助函数，方便调试
    window.__photoShopImageLoader = {
        version: '1.0.1',
        reload: function() {
            if (window.photoShopApp) {
                // 移除旧的菜单项（如果存在）
                if (window.photoShopApp.menuManager && window.photoShopApp.menuManager.removeMenuItem) {
                    window.photoShopApp.menuManager.removeMenuItem('open-image');
                }
                initOpenImageFeature();
                return '重新初始化完成';
            }
            return '应用未加载';
        },
        checkApp: function() {
            return {
                appExists: !!window.photoShopApp,
                toastExists: typeof Toast !== 'undefined',
                menuManager: window.photoShopApp ? !!window.photoShopApp.menuManager : false
            };
        }
    };

})();