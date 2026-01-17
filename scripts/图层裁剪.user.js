// ==UserScript==
// @name         PhotoShop - 图层裁剪
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  裁剪选中的图层或全部图层，支持可视化拖动裁剪框
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("图层裁剪脚本开始执行...");

    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.log('PhotoShop应用未加载，等待中...');
            return false;
        }

        console.log('图层裁剪插件已加载');

        // 添加裁剪选中图层菜单项
        app.menuManager.addMenuItem('编辑', {
            label: '裁剪选中图层...',
            action: 'crop-selected-layers',
            handler: (app) => {
                showCropDialog(app, 'selected');
            },
            position: 'bottom',
            divider: true
        });

        // 添加裁剪全部图层菜单项
        app.menuManager.addMenuItem('编辑', {
            label: '裁剪全部图层...',
            action: 'crop-all-layers',
            handler: (app) => {
                showCropDialog(app, 'all');
            },
            position: 'bottom',
            divider: false
        });

        return true;
    }

    function tryInit() {
        if (!initPlugin()) {
            let attempts = 0;
            const maxAttempts = 100;
            const interval = setInterval(() => {
                attempts++;
                if (initPlugin()) {
                    clearInterval(interval);
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.error('PhotoShop应用加载超时');
                }
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    /**
     * 显示裁剪对话框
     */
    function showCropDialog(app, mode = 'selected') {
        const isAll = mode === 'all';

        // 获取要裁剪的图层（递归获取所有选中项中的图层）
        function getLayersFromItems(items) {
            const layers = [];
            items.forEach(item => {
                if (item.isGroup) {
                    layers.push(...item.getAllLayers());
                } else {
                    layers.push(item);
                }
            });
            return layers;
        }

        const targetLayers = isAll
            ? app.layerManager.getAllLayers()
            : getLayersFromItems(app.layerManager.selectedItems);

        if (targetLayers.length === 0) {
            alert(isAll ? '没有可裁剪的图层' : '请先选择要裁剪的图层');
            return;
        }

        // 创建预览画布
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = app.config.width;
        previewCanvas.height = app.config.height;
        const previewCtx = previewCanvas.getContext('2d');

        // 渲染所有图层到预览画布
        app.layerManager.layers.forEach(item => {
            renderItem(item, previewCtx);
        });

        function renderItem(item, ctx) {
            if (item.isGroup) {
                if (item.visible) {
                    item.children.forEach(child => renderItem(child, ctx));
                }
            } else if (item.visible) {
                ctx.globalAlpha = item.opacity;
                ctx.drawImage(item.canvas, 0, 0);
                ctx.globalAlpha = 1;
            }
        }

        // 创建对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '600px';
        dialog.style.maxWidth = '90vw';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = `裁剪图层 (${targetLayers.length} 个)`;

        // 预览容器
        const previewContainer = document.createElement('div');
        previewContainer.style.position = 'relative';
        previewContainer.style.width = '100%';
        previewContainer.style.height = '400px';
        previewContainer.style.backgroundColor = '#1e1e1e';
        previewContainer.style.marginBottom = '15px';
        previewContainer.style.overflow = 'hidden';
        previewContainer.style.display = 'flex';
        previewContainer.style.justifyContent = 'center';
        previewContainer.style.alignItems = 'center';

        // 预览画布显示
        const displayCanvas = document.createElement('canvas');
        const scale = Math.min(560 / previewCanvas.width, 380 / previewCanvas.height);
        displayCanvas.width = previewCanvas.width * scale;
        displayCanvas.height = previewCanvas.height * scale;
        displayCanvas.style.imageRendering = 'pixelated';
        const displayCtx = displayCanvas.getContext('2d');
        displayCtx.imageSmoothingEnabled = false;
        displayCtx.drawImage(previewCanvas, 0, 0, displayCanvas.width, displayCanvas.height);

        previewContainer.appendChild(displayCanvas);

        // 裁剪框
        const cropBox = document.createElement('div');
        cropBox.style.position = 'absolute';
        cropBox.style.border = '2px solid #4CAF50';
        cropBox.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.5)';
        cropBox.style.cursor = 'move';
        cropBox.style.boxSizing = 'border-box';

        // 初始裁剪区域（整个画布）
        let cropX = 0, cropY = 0, cropW = previewCanvas.width, cropH = previewCanvas.height;

        // 信息显示
        const infoDiv = document.createElement('div');
        infoDiv.style.textAlign = 'center';
        infoDiv.style.color = '#aaa';
        infoDiv.style.fontSize = '12px';
        infoDiv.style.marginBottom = '15px';

        function updateInfo() {
            infoDiv.textContent = `裁剪区域: X=${Math.round(cropX)}, Y=${Math.round(cropY)}, W=${Math.round(cropW)}, H=${Math.round(cropH)}`;
        }

        function updateCropBox() {
            const rect = displayCanvas.getBoundingClientRect();
            const containerRect = previewContainer.getBoundingClientRect();
            cropBox.style.left = (rect.left - containerRect.left + cropX * scale) + 'px';
            cropBox.style.top = (rect.top - containerRect.top + cropY * scale) + 'px';
            cropBox.style.width = (cropW * scale) + 'px';
            cropBox.style.height = (cropH * scale) + 'px';
            updateInfo();
        }

        previewContainer.appendChild(cropBox);
        updateCropBox();

        // 拖动裁剪框
        let isDragging = false;
        let dragStartX = 0, dragStartY = 0;
        let startCropX = 0, startCropY = 0;

        cropBox.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            startCropX = cropX;
            startCropY = cropY;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = (e.clientX - dragStartX) / scale;
            const dy = (e.clientY - dragStartY) / scale;
            cropX = Math.max(0, Math.min(previewCanvas.width - cropW, startCropX + dx));
            cropY = Math.max(0, Math.min(previewCanvas.height - cropH, startCropY + dy));
            updateCropBox();
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // 调整大小手柄
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.style.position = 'absolute';
            handle.style.width = '10px';
            handle.style.height = '10px';
            handle.style.backgroundColor = '#4CAF50';
            handle.style.border = '1px solid white';

            const isCorner = pos.length === 2;
            if (isCorner) {
                if (pos.includes('n')) handle.style.top = '-5px';
                if (pos.includes('s')) handle.style.bottom = '-5px';
                if (pos.includes('w')) handle.style.left = '-5px';
                if (pos.includes('e')) handle.style.right = '-5px';
                handle.style.cursor = pos + '-resize';
            } else {
                if (pos === 'n') { handle.style.top = '-5px'; handle.style.left = 'calc(50% - 5px)'; handle.style.cursor = 'ns-resize'; }
                if (pos === 's') { handle.style.bottom = '-5px'; handle.style.left = 'calc(50% - 5px)'; handle.style.cursor = 'ns-resize'; }
                if (pos === 'w') { handle.style.left = '-5px'; handle.style.top = 'calc(50% - 5px)'; handle.style.cursor = 'ew-resize'; }
                if (pos === 'e') { handle.style.right = '-5px'; handle.style.top = 'calc(50% - 5px)'; handle.style.cursor = 'ew-resize'; }
            }

            let resizing = false;
            let resizeStartX = 0, resizeStartY = 0;
            let startX = 0, startY = 0, startW = 0, startH = 0;

            handle.addEventListener('mousedown', (e) => {
                resizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                startX = cropX;
                startY = cropY;
                startW = cropW;
                startH = cropH;
                e.stopPropagation();
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!resizing) return;
                const dx = (e.clientX - resizeStartX) / scale;
                const dy = (e.clientY - resizeStartY) / scale;

                if (pos.includes('w')) {
                    const newX = Math.max(0, Math.min(startX + startW - 1, startX + dx));
                    cropW = startW - (newX - startX);
                    cropX = newX;
                }
                if (pos.includes('e')) {
                    cropW = Math.max(1, Math.min(previewCanvas.width - startX, startW + dx));
                }
                if (pos.includes('n')) {
                    const newY = Math.max(0, Math.min(startY + startH - 1, startY + dy));
                    cropH = startH - (newY - startY);
                    cropY = newY;
                }
                if (pos.includes('s')) {
                    cropH = Math.max(1, Math.min(previewCanvas.height - startY, startH + dy));
                }

                updateCropBox();
            });

            document.addEventListener('mouseup', () => {
                resizing = false;
            });

            cropBox.appendChild(handle);
        });

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '裁剪';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = () => {
            applyCrop(app, targetLayers, Math.round(cropX), Math.round(cropY), Math.round(cropW), Math.round(cropH));
            document.body.removeChild(overlay);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(previewContainer);
        dialog.appendChild(infoDiv);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // ESC键取消
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * 应用裁剪
     */
    function applyCrop(app, layers, x, y, w, h) {
        const isAll = layers.length === app.layerManager.getAllLayers().length;

        if (isAll) {
            // 裁剪全部图层：改变画布大小
            layers.forEach(layer => {
                const imageData = layer.ctx.getImageData(x, y, w, h);
                layer.canvas.width = w;
                layer.canvas.height = h;
                layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
                layer.ctx.imageSmoothingEnabled = false;
                layer.ctx.putImageData(imageData, 0, 0);
            });

            app.config.width = w;
            app.config.height = h;
            app.canvasManager.resize(w, h);
            app.selectionManager.resize(w, h);
        } else {
            // 裁剪选中图层：只清除选区外的像素
            layers.forEach(layer => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.imageSmoothingEnabled = false;

                const imageData = layer.ctx.getImageData(x, y, w, h);
                tempCtx.putImageData(imageData, 0, 0);

                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                layer.ctx.drawImage(tempCanvas, x, y);
            });
        }

        app.renderLayerList();
        app.render();
        app.saveHistory();

        console.log(`裁剪完成: ${layers.length} 个图层`);
        alert(`成功裁剪 ${layers.length} 个图层`);
    }

})();
