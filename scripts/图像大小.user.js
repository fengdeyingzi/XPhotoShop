// ==UserScript==
// @name         PhotoShop - 图像大小调整
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  调整画布和图层的尺寸
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) return false;

        console.log('图像大小插件已加载');

        app.menuManager.addMenuItem('图像', {
            label: '图像大小...',
            action: 'image-size',
            handler: () => showImageSizeDialog(app),
            position: 1
        });

        return true;
    }

    function tryInit() {
        if (!initPlugin()) {
            let attempts = 0;
            const interval = setInterval(() => {
                if (++attempts >= 100 || initPlugin()) clearInterval(interval);
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    function showImageSizeDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '480px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '图像大小';

        const content = document.createElement('div');
        content.style.padding = '20px';

        // 原始尺寸
        const originalWidth = app.config.width;
        const originalHeight = app.config.height;
        const aspectRatio = originalWidth / originalHeight;
        let isLinked = true;

        // 像素尺寸区域
        const pixelSection = document.createElement('div');
        pixelSection.style.marginBottom = '20px';

        const sectionTitle = document.createElement('div');
        sectionTitle.style.fontSize = '13px';
        sectionTitle.style.fontWeight = '600';
        sectionTitle.style.marginBottom = '12px';
        sectionTitle.style.color = '#d0d0d0';
        sectionTitle.style.display = 'flex';
        sectionTitle.style.justifyContent = 'space-between';

        const titleText = document.createElement('span');
        titleText.textContent = '像素尺寸';

        const resetLink = document.createElement('a');
        resetLink.href = '#';
        resetLink.style.cssText = 'font-size: 11px; color: #6ba4ff; text-decoration: none;';
        resetLink.textContent = '复位';

        sectionTitle.appendChild(titleText);
        sectionTitle.appendChild(resetLink);

        // 宽度输入
        const widthRow = createDimensionRow('宽度:', originalWidth, 'widthInput');
        const widthInput = widthRow.querySelector('input');

        // 高度输入
        const heightRow = createDimensionRow('高度:', originalHeight, 'heightInput');
        const heightInput = heightRow.querySelector('input');

        // 链接图标
        const linkIcon = document.createElement('div');
        linkIcon.style.cssText = 'margin: 0 12px; color: #6ba4ff; cursor: pointer; font-size: 16px; width: 20px; text-align: center;';
        linkIcon.innerHTML = '🔗';
        heightRow.appendChild(linkIcon);

        // 尺寸信息
        const sizeInfo = document.createElement('div');
        sizeInfo.style.cssText = 'margin-top: 10px; font-size: 11px; color: #90caf9;';
        updateSizeInfo();

        pixelSection.appendChild(sectionTitle);
        pixelSection.appendChild(widthRow);
        pixelSection.appendChild(heightRow);
        pixelSection.appendChild(sizeInfo);

        // 当前图像信息
        const infoBox = document.createElement('div');
        infoBox.style.cssText = 'background-color: #2a2a2a; border: 1px solid #555; border-radius: 2px; padding: 10px; margin-bottom: 20px; font-size: 11px; color: #b0b0b0;';
        infoBox.innerHTML = `当前图像尺寸: <strong style="color: #e0e0e0;">${originalWidth} × ${originalHeight} 像素</strong> (宽高比: ${aspectRatio.toFixed(2)})`;

        // 重采样选项
        const resampleSection = document.createElement('div');
        resampleSection.style.marginBottom = '20px';

        const resampleCheck = document.createElement('label');
        resampleCheck.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; font-size: 12px; color: #b0b0b0; cursor: pointer;';
        resampleCheck.innerHTML = '<input type="checkbox" id="resampleCheck" checked style="margin-right: 8px; accent-color: #6ba4ff;"> 重新采样';

        const resampleSelect = document.createElement('select');
        resampleSelect.style.cssText = 'width: 100%; background-color: #2a2a2a; border: 1px solid #555; color: #f0f0f0; padding: 8px; font-size: 12px; border-radius: 2px;';
        resampleSelect.innerHTML = `
            <option value="nearest-neighbor">邻近（硬边缘）</option>
            <option value="bilinear">两次线性</option>
            <option value="bicubic" selected>两次立方（较平滑渐变）</option>
        `;

        const constrainCheck = document.createElement('label');
        constrainCheck.style.cssText = 'display: flex; align-items: center; margin-top: 12px; font-size: 12px; color: #b0b0b0; cursor: pointer;';
        constrainCheck.innerHTML = '<input type="checkbox" id="constrainCheck" checked style="margin-right: 8px; accent-color: #6ba4ff;"> 约束比例';

        resampleSection.appendChild(resampleCheck);
        resampleSection.appendChild(resampleSelect);
        resampleSection.appendChild(constrainCheck);

        content.appendChild(pixelSection);
        content.appendChild(infoBox);
        content.appendChild(resampleSection);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.style.marginTop = '20px';

        const okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.className = 'dialog-btn dialog-btn-ok';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.style.marginLeft = '10px';

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        // 事件处理
        widthInput.addEventListener('input', () => {
            if (isLinked && document.getElementById('constrainCheck').checked) {
                const newHeight = Math.round(widthInput.value / aspectRatio);
                heightInput.value = newHeight;
            }
            updateSizeInfo();
        });

        heightInput.addEventListener('input', () => {
            if (isLinked && document.getElementById('constrainCheck').checked) {
                const newWidth = Math.round(heightInput.value * aspectRatio);
                widthInput.value = newWidth;
            }
            updateSizeInfo();
        });

        linkIcon.addEventListener('click', () => {
            isLinked = !isLinked;
            linkIcon.innerHTML = isLinked ? '🔗' : '🔓';
            linkIcon.style.color = isLinked ? '#6ba4ff' : '#666';
        });

        resetLink.addEventListener('click', (e) => {
            e.preventDefault();
            widthInput.value = originalWidth;
            heightInput.value = originalHeight;
            updateSizeInfo();
        });

        okBtn.addEventListener('click', () => {
            const newWidth = parseInt(widthInput.value);
            const newHeight = parseInt(heightInput.value);

            if (newWidth < 1 || newHeight < 1 || newWidth > 10000 || newHeight > 10000) {
                alert('请输入有效的尺寸 (1-10000)');
                return;
            }

            const resample = document.getElementById('resampleCheck').checked;
            const method = resampleSelect.value;

            // 调整画布
            app.canvasManager.resize(newWidth, newHeight);
            app.selectionManager.resize(newWidth, newHeight);

            // 调整所有图层
            if (resample) {
                resizeLayersWithResampling(app.layerManager.getAllLayers(), newWidth, newHeight, method);
            } else {
                app.layerManager.resizeLayers(newWidth, newHeight);
            }

            app.config.width = newWidth;
            app.config.height = newHeight;
            app.renderLayerList();
            app.render();
            app.saveHistory();

            document.body.removeChild(overlay);
        });

        cancelBtn.addEventListener('click', () => document.body.removeChild(overlay));

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        function createDimensionRow(label, value, inputId) {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; margin-bottom: 12px; align-items: center;';

            const labelEl = document.createElement('div');
            labelEl.style.cssText = 'width: 80px; font-size: 12px; color: #b0b0b0;';
            labelEl.textContent = label;

            const inputWrapper = document.createElement('div');
            inputWrapper.style.cssText = 'flex: 1; display: flex; align-items: center;';

            const input = document.createElement('input');
            input.type = 'number';
            input.id = inputId;
            input.value = value;
            input.min = '1';
            input.max = '10000';
            input.style.cssText = 'width: 120px; background-color: #2a2a2a; border: 1px solid #555; color: #f0f0f0; padding: 6px 8px; font-size: 13px; border-radius: 2px; margin-right: 8px;';

            const unit = document.createElement('span');
            unit.style.cssText = 'font-size: 12px; color: #b0b0b0; width: 40px;';
            unit.textContent = '像素';

            const original = document.createElement('span');
            original.style.cssText = 'font-size: 11px; color: #888; margin-left: 15px;';
            original.textContent = `原稿: ${value} px`;

            inputWrapper.appendChild(input);
            inputWrapper.appendChild(unit);
            inputWrapper.appendChild(original);

            row.appendChild(labelEl);
            row.appendChild(inputWrapper);

            return row;
        }

        function updateSizeInfo() {
            const w = parseInt(widthInput.value) || 1;
            const h = parseInt(heightInput.value) || 1;
            const newSizeMB = (w * h * 3) / (1024 * 1024);
            const originalSizeMB = (originalWidth * originalHeight * 3) / (1024 * 1024);
            const change = newSizeMB - originalSizeMB;

            let changeText = '';
            if (Math.abs(change) < 0.01) {
                changeText = '(无显著变化)';
            } else if (change > 0) {
                changeText = `<span style="color: #ff9d5c;">(增加 ${Math.abs(change).toFixed(2)} MB)</span>`;
            } else {
                changeText = `<span style="color: #8fdf8f;">(减少 ${Math.abs(change).toFixed(2)} MB)</span>`;
            }

            sizeInfo.innerHTML = `新图像大小: ${newSizeMB.toFixed(2)} MB ${changeText}`;
        }

        function resizeLayersWithResampling(layers, newWidth, newHeight, method) {
            for (const layer of layers) {
                const oldCanvas = layer.canvas;
                const oldWidth = oldCanvas.width;
                const oldHeight = oldCanvas.height;

                // 创建临时画布保存原始内容
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = oldWidth;
                tempCanvas.height = oldHeight;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(oldCanvas, 0, 0);

                // 调整图层画布大小
                layer.canvas.width = newWidth;
                layer.canvas.height = newHeight;
                layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
                layer.ctx.imageSmoothingEnabled = false;

                // 根据方法进行重采样
                if (method === 'nearest-neighbor') {
                    // 邻近插值（像素艺术）
                    layer.ctx.imageSmoothingEnabled = false;
                    layer.ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
                } else if (method === 'bilinear' || method === 'bicubic') {
                    // 双线性/双三次插值
                    layer.ctx.imageSmoothingEnabled = true;
                    layer.ctx.imageSmoothingQuality = 'high';
                    layer.ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
                } else {
                    // 默认
                    layer.ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
                }
            }
        }
    }
})();
