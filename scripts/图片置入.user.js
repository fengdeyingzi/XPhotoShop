// ==UserScript==
// @name         PhotoShop - 图片置入 (Place Image)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  支持置入外部图片，可调整大小和位置，按Shift等比例缩放
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let placeState = null;

    function init() {
        const app = window.photoShopApp;
        if (!app) {
            setTimeout(init, 100);
            return;
        }

        addMenuEntry(app);
        console.log('PhotoShop 图片置入插件 v1.0 已加载');
    }

    // 添加菜单项
    function addMenuEntry(app) {
        app.menuManager.addMenuItem('文件', {
            label: '置入...',
            action: 'place-image',
            handler: () => {
                openImagePicker(app);
            }
        });
    }

    // 打开文件选择器
    function openImagePicker(app) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                loadImage(file, app);
            }
            document.body.removeChild(input);
        };

        document.body.appendChild(input);
        input.click();
    }

    // 加载图片
    function loadImage(file, app) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                startPlacement(img, app);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 开始置入流程
    function startPlacement(img, app) {
        // 创建新图层
        const layerName = `置入图层 ${Date.now()}`;
        app.layerManager.addLayer(app.config.width, app.config.height, layerName);
        const layerIndex = app.layerManager.layers.length - 1;
        app.layerManager.setActiveLayer(layerIndex);
        const layer = app.layerManager.getActiveLayer();

        // 计算初始位置和大小（居中，适应画布）
        const scale = Math.min(
            app.config.width / img.width,
            app.config.height / img.height,
            1 // 不放大，只缩小
        );

        const width = img.width * scale;
        const height = img.height * scale;
        const x = (app.config.width - width) / 2;
        const y = (app.config.height - height) / 2;

        // 初始化置入状态
        placeState = {
            app,
            layer,
            layerIndex,
            img,
            x,
            y,
            width,
            height,
            originalWidth: width,
            originalHeight: height,
            isDragging: false,
            isResizing: false,
            dragStart: null,
            resizeHandle: null,
            shiftKey: false,
            animationFrameId: null
        };

        // 绘制初始预览
        drawPlacementPreview();

        // 显示提示
        showPlacementHint();

        // 绑定事件
        bindPlacementEvents();

        // 启动持续渲染
        startContinuousRender();
    }

    // 启动持续渲染
    function startContinuousRender() {
        if (!placeState) return;

        const render = () => {
            if (!placeState) return;

            // 重新绘制预览（包括边框和控制点）
            const { app, layer, img, x, y, width, height } = placeState;

            // 清空图层
            layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

            // 绘制图片
            layer.ctx.drawImage(img, x, y, width, height);

            // 渲染图层
            app.render();

            // 绘制边框、对角线和控制点
            const displayCtx = app.canvasManager.displayCtx;

            displayCtx.save();

            // 绘制对角线（类似 PS 的效果）
            displayCtx.strokeStyle = '#00aaff';
            displayCtx.lineWidth = 1;
            displayCtx.setLineDash([]);
            displayCtx.beginPath();
            displayCtx.moveTo(x, y);
            displayCtx.lineTo(x + width, y + height);
            displayCtx.moveTo(x + width, y);
            displayCtx.lineTo(x, y + height);
            displayCtx.stroke();

            // 绘制边框
            displayCtx.strokeStyle = '#00aaff';
            displayCtx.lineWidth = 2;
            displayCtx.setLineDash([]);
            displayCtx.strokeRect(x, y, width, height);

            // 绘制8个控制点
            const handles = getResizeHandles();
            displayCtx.fillStyle = '#ffffff';
            displayCtx.strokeStyle = '#00aaff';
            displayCtx.lineWidth = 2;
            displayCtx.setLineDash([]);
            handles.forEach(handle => {
                displayCtx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
                displayCtx.strokeRect(handle.x - 4, handle.y - 4, 8, 8);
            });

            displayCtx.restore();

            // 继续下一帧
            placeState.animationFrameId = requestAnimationFrame(render);
        };

        placeState.animationFrameId = requestAnimationFrame(render);
    }

    // 绘制置入预览（用于拖动时的即时更新）
    function drawPlacementPreview() {
        // 这个函数现在由 startContinuousRender 处理
        // 保留此函数以兼容现有代码
    }

    // 获取调整大小的控制点
    function getResizeHandles() {
        if (!placeState) return [];

        const { x, y, width, height } = placeState;
        return [
            { name: 'nw', x, y },
            { name: 'n', x: x + width / 2, y },
            { name: 'ne', x: x + width, y },
            { name: 'e', x: x + width, y: y + height / 2 },
            { name: 'se', x: x + width, y: y + height },
            { name: 's', x: x + width / 2, y: y + height },
            { name: 'sw', x, y: y + height },
            { name: 'w', x, y: y + height / 2 }
        ];
    }

    // 检测鼠标是否在控制点上
    function getHandleAtPoint(mx, my) {
        const handles = getResizeHandles();
        for (const handle of handles) {
            const dx = mx - handle.x;
            const dy = my - handle.y;
            if (Math.sqrt(dx * dx + dy * dy) < 8) {
                return handle.name;
            }
        }
        return null;
    }

    // 检测鼠标是否在图片区域内
    function isPointInImage(mx, my) {
        if (!placeState) return false;
        const { x, y, width, height } = placeState;
        return mx >= x && mx <= x + width && my >= y && my <= y + height;
    }

    // 显示提示信息
    function showPlacementHint() {
        const hint = document.createElement('div');
        hint.id = 'placement-hint';
        hint.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
        `;
        hint.textContent = '拖动调整位置 | 拖动控制点调整大小 | 按住 Shift 等比例缩放 | 按 Enter 确认 | 按 Esc 取消';
        document.body.appendChild(hint);
    }

    // 移除提示信息
    function removePlacementHint() {
        const hint = document.getElementById('placement-hint');
        if (hint) {
            document.body.removeChild(hint);
        }
    }

    // 绑定置入事件
    function bindPlacementEvents() {
        const canvas = placeState.app.canvasManager.displayCanvas;

        const handleMouseDown = (e) => {
            if (!placeState) return;

            const pos = placeState.app.canvasManager.getMousePos(e);
            const handle = getHandleAtPoint(pos.x, pos.y);

            if (handle) {
                // 开始调整大小
                placeState.isResizing = true;
                placeState.resizeHandle = handle;
                placeState.dragStart = { x: pos.x, y: pos.y };
                placeState.startBounds = {
                    x: placeState.x,
                    y: placeState.y,
                    width: placeState.width,
                    height: placeState.height
                };
            } else if (isPointInImage(pos.x, pos.y)) {
                // 开始拖动
                placeState.isDragging = true;
                placeState.dragStart = {
                    x: pos.x - placeState.x,
                    y: pos.y - placeState.y
                };
            }
        };

        const handleMouseMove = (e) => {
            if (!placeState) return;

            const pos = placeState.app.canvasManager.getMousePos(e);
            placeState.shiftKey = e.shiftKey;

            if (placeState.isResizing) {
                handleResize(pos);
            } else if (placeState.isDragging) {
                placeState.x = pos.x - placeState.dragStart.x;
                placeState.y = pos.y - placeState.dragStart.y;
                // 持续渲染会自动更新显示
            } else {
                // 更新光标
                const handle = getHandleAtPoint(pos.x, pos.y);
                if (handle) {
                    canvas.style.cursor = getCursorForHandle(handle);
                } else if (isPointInImage(pos.x, pos.y)) {
                    canvas.style.cursor = 'move';
                } else {
                    canvas.style.cursor = 'default';
                }
            }
        };

        const handleMouseUp = () => {
            if (!placeState) return;
            placeState.isDragging = false;
            placeState.isResizing = false;
            placeState.resizeHandle = null;
        };

        const handleKeyDown = (e) => {
            if (!placeState) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                confirmPlacement();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelPlacement();
            } else if (e.key === 'Shift') {
                placeState.shiftKey = true;
            }
        };

        const handleKeyUp = (e) => {
            if (!placeState) return;
            if (e.key === 'Shift') {
                placeState.shiftKey = false;
            }
        };

        // 保存事件处理器以便后续移除
        placeState.eventHandlers = {
            mousedown: handleMouseDown,
            mousemove: handleMouseMove,
            mouseup: handleMouseUp,
            keydown: handleKeyDown,
            keyup: handleKeyUp
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    }

    // 处理调整大小
    function handleResize(pos) {
        if (!placeState || !placeState.resizeHandle) return;

        const { resizeHandle, dragStart, startBounds, shiftKey } = placeState;
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;

        let newX = startBounds.x;
        let newY = startBounds.y;
        let newWidth = startBounds.width;
        let newHeight = startBounds.height;

        // 根据控制点计算新的尺寸
        switch (resizeHandle) {
            case 'nw':
                newX = startBounds.x + dx;
                newY = startBounds.y + dy;
                newWidth = startBounds.width - dx;
                newHeight = startBounds.height - dy;
                break;
            case 'n':
                newY = startBounds.y + dy;
                newHeight = startBounds.height - dy;
                break;
            case 'ne':
                newY = startBounds.y + dy;
                newWidth = startBounds.width + dx;
                newHeight = startBounds.height - dy;
                break;
            case 'e':
                newWidth = startBounds.width + dx;
                break;
            case 'se':
                newWidth = startBounds.width + dx;
                newHeight = startBounds.height + dy;
                break;
            case 's':
                newHeight = startBounds.height + dy;
                break;
            case 'sw':
                newX = startBounds.x + dx;
                newWidth = startBounds.width - dx;
                newHeight = startBounds.height + dy;
                break;
            case 'w':
                newX = startBounds.x + dx;
                newWidth = startBounds.width - dx;
                break;
        }

        // 按住 Shift 键时等比例缩放
        if (shiftKey) {
            const aspectRatio = placeState.originalWidth / placeState.originalHeight;

            if (resizeHandle.includes('e') || resizeHandle.includes('w')) {
                newHeight = newWidth / aspectRatio;
                if (resizeHandle.includes('n')) {
                    newY = startBounds.y + startBounds.height - newHeight;
                }
            } else {
                newWidth = newHeight * aspectRatio;
                if (resizeHandle.includes('w')) {
                    newX = startBounds.x + startBounds.width - newWidth;
                }
            }
        }

        // 限制最小尺寸
        if (newWidth < 10) newWidth = 10;
        if (newHeight < 10) newHeight = 10;

        placeState.x = newX;
        placeState.y = newY;
        placeState.width = newWidth;
        placeState.height = newHeight;

        // 持续渲染会自动更新显示
    }

    // 获取控制点对应的光标样式
    function getCursorForHandle(handle) {
        const cursors = {
            'nw': 'nw-resize',
            'n': 'n-resize',
            'ne': 'ne-resize',
            'e': 'e-resize',
            'se': 'se-resize',
            's': 's-resize',
            'sw': 'sw-resize',
            'w': 'w-resize'
        };
        return cursors[handle] || 'default';
    }

    // 确认置入
    function confirmPlacement() {
        if (!placeState) return;

        const { app, layer, img, x, y, width, height } = placeState;

        // 清空图层并绘制最终图片
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.drawImage(img, x, y, width, height);

        // 保存历史
        app.saveHistory();
        app.render();
        app.renderLayerList();

        // 清理
        cleanupPlacement();

        if (window.Toast) {
            Toast.show('图片置入成功', 'success');
        }
    }

    // 取消置入
    function cancelPlacement() {
        if (!placeState) return;

        const { app, layerIndex } = placeState;

        // 删除创建的图层
        app.layerManager.layers.splice(layerIndex, 1);
        if (app.layerManager.activeLayerIndex >= layerIndex) {
            app.layerManager.activeLayerIndex = Math.max(0, app.layerManager.activeLayerIndex - 1);
        }

        app.render();
        app.renderLayerList();

        // 清理
        cleanupPlacement();

        if (window.Toast) {
            Toast.show('已取消置入', 'info');
        }
    }

    // 清理置入状态
    function cleanupPlacement() {
        if (!placeState) return;

        // 停止持续渲染
        if (placeState.animationFrameId) {
            cancelAnimationFrame(placeState.animationFrameId);
        }

        const canvas = placeState.app.canvasManager.displayCanvas;

        // 移除事件监听器
        if (placeState.eventHandlers) {
            canvas.removeEventListener('mousedown', placeState.eventHandlers.mousedown);
            window.removeEventListener('mousemove', placeState.eventHandlers.mousemove);
            window.removeEventListener('mouseup', placeState.eventHandlers.mouseup);
            window.removeEventListener('keydown', placeState.eventHandlers.keydown);
            window.removeEventListener('keyup', placeState.eventHandlers.keyup);
        }

        // 恢复光标
        canvas.style.cursor = 'default';

        // 移除提示
        removePlacementHint();

        // 清空状态
        placeState = null;
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
