// ==UserScript==
// @name         PhotoShop - 颜色替换
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  颜色替换工具，支持实时预览和批量替换
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

        console.log('颜色替换插件已加载');

        app.menuManager.addMenuItem('滤镜', {
            label: '颜色替换...',
            action: 'color-replace',
            handler: () => showColorReplaceDialog(app),
            position: 'bottom',
            divider: true
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

    function showColorReplaceDialog(app) {
        const activeItem = app.layerManager.activeItem;
        if (!activeItem || activeItem.isGroup) {
            alert('请选择一个图层（不是图层组）');
            return;
        }
        const layer = activeItem;

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '700px';
        dialog.style.maxHeight = '90vh';
        dialog.style.overflow = 'auto';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '颜色替换';

        const content = document.createElement('div');
        content.style.padding = '15px';

        // 预览区域
        const previewContainer = document.createElement('div');
        previewContainer.style.display = 'grid';
        previewContainer.style.gridTemplateColumns = '1fr 1fr';
        previewContainer.style.gap = '15px';
        previewContainer.style.marginBottom = '15px';

        // 原始图像
        const originalBox = document.createElement('div');
        const originalLabel = document.createElement('div');
        originalLabel.textContent = '原始图层';
        originalLabel.style.color = '#ddd';
        originalLabel.style.marginBottom = '5px';
        originalLabel.style.fontWeight = 'bold';

        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = layer.canvas.width;
        originalCanvas.height = layer.canvas.height;
        originalCanvas.style.width = '100%';
        originalCanvas.style.border = '1px solid #555';
        originalCanvas.style.imageRendering = 'pixelated';
        const originalCtx = originalCanvas.getContext('2d');
        originalCtx.drawImage(layer.canvas, 0, 0);

        originalBox.appendChild(originalLabel);
        originalBox.appendChild(originalCanvas);

        // 预览图像
        const previewBox = document.createElement('div');
        const previewLabel = document.createElement('div');
        previewLabel.textContent = '替换预览';
        previewLabel.style.color = '#ddd';
        previewLabel.style.marginBottom = '5px';
        previewLabel.style.fontWeight = 'bold';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = layer.canvas.width;
        previewCanvas.height = layer.canvas.height;
        previewCanvas.style.width = '100%';
        previewCanvas.style.border = '1px solid #555';
        previewCanvas.style.imageRendering = 'pixelated';
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.drawImage(layer.canvas, 0, 0);

        previewBox.appendChild(previewLabel);
        previewBox.appendChild(previewCanvas);

        previewContainer.appendChild(originalBox);
        previewContainer.appendChild(previewBox);

        // 控制区域
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.gap = '15px';

        // 源颜色选择
        const sourceGroup = document.createElement('div');
        sourceGroup.style.display = 'flex';
        sourceGroup.style.alignItems = 'center';
        sourceGroup.style.gap = '10px';

        const sourceLabel = document.createElement('label');
        sourceLabel.textContent = '源颜色:';
        sourceLabel.style.color = '#ddd';
        sourceLabel.style.minWidth = '80px';

        const sourceColor = document.createElement('input');
        sourceColor.type = 'color';
        sourceColor.value = '#000000';
        sourceColor.style.width = '60px';
        sourceColor.style.height = '30px';
        sourceColor.style.cursor = 'pointer';

        const pickBtn = document.createElement('button');
        pickBtn.textContent = '从图层取色';
        pickBtn.className = 'dialog-btn';
        pickBtn.style.padding = '5px 10px';
        pickBtn.onclick = () => {
            pickBtn.textContent = '点击图层选择颜色...';
            pickBtn.disabled = true;
            const handler = (e) => {
                const rect = originalCanvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / rect.width * originalCanvas.width);
                const y = Math.floor((e.clientY - rect.top) / rect.height * originalCanvas.height);
                const pixel = originalCtx.getImageData(x, y, 1, 1).data;
                sourceColor.value = rgbToHex(pixel[0], pixel[1], pixel[2]);
                updatePreview();
                originalCanvas.removeEventListener('click', handler);
                pickBtn.textContent = '从图层取色';
                pickBtn.disabled = false;
            };
            originalCanvas.addEventListener('click', handler);
        };

        const sourceHex = document.createElement('span');
        sourceHex.textContent = sourceColor.value;
        sourceHex.style.color = '#aaa';
        sourceHex.style.fontFamily = 'monospace';

        sourceGroup.appendChild(sourceLabel);
        sourceGroup.appendChild(sourceColor);
        sourceGroup.appendChild(pickBtn);
        sourceGroup.appendChild(sourceHex);

        // 目标颜色选择
        const targetGroup = document.createElement('div');
        targetGroup.style.display = 'flex';
        targetGroup.style.alignItems = 'center';
        targetGroup.style.gap = '10px';

        const targetLabel = document.createElement('label');
        targetLabel.textContent = '目标颜色:';
        targetLabel.style.color = '#ddd';
        targetLabel.style.minWidth = '80px';

        const targetColor = document.createElement('input');
        targetColor.type = 'color';
        targetColor.value = '#ffffff';
        targetColor.style.width = '60px';
        targetColor.style.height = '30px';
        targetColor.style.cursor = 'pointer';

        const pickTargetBtn = document.createElement('button');
        pickTargetBtn.textContent = '从图层取色';
        pickTargetBtn.className = 'dialog-btn';
        pickTargetBtn.style.padding = '5px 10px';
        pickTargetBtn.onclick = () => {
            pickTargetBtn.textContent = '点击图层选择颜色...';
            pickTargetBtn.disabled = true;
            const handler = (e) => {
                const rect = originalCanvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / rect.width * originalCanvas.width);
                const y = Math.floor((e.clientY - rect.top) / rect.height * originalCanvas.height);
                const pixel = originalCtx.getImageData(x, y, 1, 1).data;
                targetColor.value = rgbToHex(pixel[0], pixel[1], pixel[2]);
                updatePreview();
                originalCanvas.removeEventListener('click', handler);
                pickTargetBtn.textContent = '从图层取色';
                pickTargetBtn.disabled = false;
            };
            originalCanvas.addEventListener('click', handler);
        };

        const targetHex = document.createElement('span');
        targetHex.textContent = targetColor.value;
        targetHex.style.color = '#aaa';
        targetHex.style.fontFamily = 'monospace';

        targetGroup.appendChild(targetLabel);
        targetGroup.appendChild(targetColor);
        targetGroup.appendChild(pickTargetBtn);
        targetGroup.appendChild(targetHex);

        // 透明色选项
        const transparentGroup = document.createElement('div');
        transparentGroup.style.display = 'flex';
        transparentGroup.style.alignItems = 'center';
        transparentGroup.style.gap = '10px';
        transparentGroup.style.marginLeft = '90px';

        const transparentCheckbox = document.createElement('input');
        transparentCheckbox.type = 'checkbox';
        transparentCheckbox.id = 'transparentCheckbox';

        const transparentLabel = document.createElement('label');
        transparentLabel.htmlFor = 'transparentCheckbox';
        transparentLabel.textContent = '替换为透明色';
        transparentLabel.style.color = '#ddd';
        transparentLabel.style.cursor = 'pointer';

        transparentGroup.appendChild(transparentCheckbox);
        transparentGroup.appendChild(transparentLabel);

        // 容差滑块
        const toleranceGroup = document.createElement('div');
        toleranceGroup.style.display = 'flex';
        toleranceGroup.style.alignItems = 'center';
        toleranceGroup.style.gap = '10px';

        const toleranceLabel = document.createElement('label');
        toleranceLabel.textContent = '容差:';
        toleranceLabel.style.color = '#ddd';
        toleranceLabel.style.minWidth = '80px';

        const toleranceSlider = document.createElement('input');
        toleranceSlider.type = 'range';
        toleranceSlider.min = '0';
        toleranceSlider.max = '100';
        toleranceSlider.value = '10';
        toleranceSlider.style.flex = '1';

        const toleranceValue = document.createElement('span');
        toleranceValue.textContent = toleranceSlider.value;
        toleranceValue.style.color = '#aaa';
        toleranceValue.style.minWidth = '30px';

        toleranceGroup.appendChild(toleranceLabel);
        toleranceGroup.appendChild(toleranceSlider);
        toleranceGroup.appendChild(toleranceValue);

        controls.appendChild(sourceGroup);
        controls.appendChild(targetGroup);
        controls.appendChild(transparentGroup);
        controls.appendChild(toleranceGroup);

        // 更新预览函数
        const updatePreview = () => {
            sourceHex.textContent = sourceColor.value;
            targetHex.textContent = targetColor.value;
            toleranceValue.textContent = toleranceSlider.value;

            const imageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
            const newImageData = replaceColor(imageData, sourceColor.value, targetColor.value, parseInt(toleranceSlider.value), transparentCheckbox.checked);
            previewCtx.putImageData(newImageData, 0, 0);
        };

        sourceColor.addEventListener('input', updatePreview);
        targetColor.addEventListener('input', updatePreview);
        toleranceSlider.addEventListener('input', updatePreview);
        transparentCheckbox.addEventListener('change', updatePreview);

        content.appendChild(previewContainer);
        content.appendChild(controls);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.style.marginTop = '15px';

        const replaceCurrentBtn = document.createElement('button');
        replaceCurrentBtn.textContent = '替换当前图层';
        replaceCurrentBtn.className = 'dialog-btn dialog-btn-ok';
        replaceCurrentBtn.onclick = () => {
            const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            const newImageData = replaceColor(imageData, sourceColor.value, targetColor.value, parseInt(toleranceSlider.value), transparentCheckbox.checked);
            layer.ctx.putImageData(newImageData, 0, 0);
            app.render();
            app.renderLayerList();
            app.saveHistory();
            document.body.removeChild(overlay);
            alert('颜色替换完成');
        };

        const replaceAllBtn = document.createElement('button');
        replaceAllBtn.textContent = '替换所有图层';
        replaceAllBtn.className = 'dialog-btn dialog-btn-ok';
        replaceAllBtn.onclick = () => {
            let count = 0;
            const processLayers = (items) => {
                for (const item of items) {
                    if (item.isGroup) {
                        processLayers(item.children);
                    } else if (item.ctx && item.canvas) {
                        try {
                            const imageData = item.ctx.getImageData(0, 0, item.canvas.width, item.canvas.height);
                            const newImageData = replaceColor(imageData, sourceColor.value, targetColor.value, parseInt(toleranceSlider.value), transparentCheckbox.checked);
                            item.ctx.putImageData(newImageData, 0, 0);
                            count++;
                        } catch (e) {
                            console.error(`图层 "${item.name}" 无法进行颜色替换:`, e);
                        }
                    }
                }
            };
            processLayers(app.layerManager.layers);
            app.render();
            app.renderLayerList();
            app.saveHistory();
            document.body.removeChild(overlay);
            alert(`已替换 ${count} 个图层`);
        };

        const fillSelectionBtn = document.createElement('button');
        fillSelectionBtn.textContent = '填充选择区域';
        fillSelectionBtn.className = 'dialog-btn dialog-btn-ok';
        fillSelectionBtn.onclick = () => {
            if (!app.selectionManager.hasSelection) {
                alert('请先创建选区');
                return;
            }
            const target = transparentCheckbox.checked ? null : hexToRgb(targetColor.value);
            const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            const data = imageData.data;
            for (let y = 0; y < layer.canvas.height; y++) {
                for (let x = 0; x < layer.canvas.width; x++) {
                    if (app.selectionManager.isSelected(x, y)) {
                        const i = (y * layer.canvas.width + x) * 4;
                        if (target) {
                            data[i] = target.r;
                            data[i + 1] = target.g;
                            data[i + 2] = target.b;
                        } else {
                            data[i + 3] = 0;
                        }
                    }
                }
            }
            layer.ctx.putImageData(imageData, 0, 0);
            app.render();
            app.renderLayerList();
            app.saveHistory();
            document.body.removeChild(overlay);
            alert('选区填充完成');
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        buttons.appendChild(replaceCurrentBtn);
        buttons.appendChild(replaceAllBtn);
        buttons.appendChild(fillSelectionBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    function replaceColor(imageData, sourceHex, targetHex, tolerance, toTransparent) {
        const data = new Uint8ClampedArray(imageData.data);
        const source = hexToRgb(sourceHex);
        const target = toTransparent ? null : hexToRgb(targetHex);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (Math.abs(r - source.r) <= tolerance &&
                Math.abs(g - source.g) <= tolerance &&
                Math.abs(b - source.b) <= tolerance) {
                if (target) {
                    data[i] = target.r;
                    data[i + 1] = target.g;
                    data[i + 2] = target.b;
                } else {
                    data[i + 3] = 0;
                }
            }
        }

        return new ImageData(data, imageData.width, imageData.height);
    }
})();
