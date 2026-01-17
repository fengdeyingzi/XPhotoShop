// ==UserScript==
// @name         PhotoShop - 背景移除工具
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  根据背景图片移除图层中的背景像素
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

        console.log('背景移除插件已加载');

        app.menuManager.addMenuItem('图像', {
            label: '移除背景...',
            action: 'remove-background',
            handler: () => showRemoveBackgroundDialog(app),
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

    function showRemoveBackgroundDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '600px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '背景移除工具';

        const content = document.createElement('div');
        content.style.padding = '15px';

        // 说明文字
        const description = document.createElement('div');
        description.innerHTML = '<p style="color: #aaa; margin-bottom: 15px;">选择背景图片，根据颜色误差范围移除图层中的背景像素。</p>';
        content.appendChild(description);

        // 文件选择区域
        const fileGroup = document.createElement('div');
        fileGroup.style.marginBottom = '15px';

        const fileLabel = document.createElement('label');
        fileLabel.textContent = '背景图片:';
        fileLabel.style.color = '#ddd';
        fileLabel.style.display = 'block';
        fileLabel.style.marginBottom = '8px';

        const fileInputWrapper = document.createElement('div');
        fileInputWrapper.style.position = 'relative';
        fileInputWrapper.style.display = 'inline-block';
        fileInputWrapper.style.width = '100%';

        const fileButton = document.createElement('button');
        fileButton.textContent = '选择背景图片';
        fileButton.className = 'dialog-btn';
        fileButton.style.width = '100%';
        fileButton.style.padding = '10px';
        fileButton.style.cursor = 'pointer';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        const fileNameDisplay = document.createElement('div');
        fileNameDisplay.style.marginTop = '8px';
        fileNameDisplay.style.color = '#90caf9';
        fileNameDisplay.style.fontSize = '12px';

        fileButton.onclick = () => fileInput.click();

        fileInputWrapper.appendChild(fileButton);
        fileInputWrapper.appendChild(fileInput);

        fileGroup.appendChild(fileLabel);
        fileGroup.appendChild(fileInputWrapper);
        fileGroup.appendChild(fileNameDisplay);

        // 图层选择区域
        const layerGroup = document.createElement('div');
        layerGroup.style.marginBottom = '15px';

        const layerLabel = document.createElement('label');
        layerLabel.textContent = '选择图层:';
        layerLabel.style.color = '#ddd';
        layerLabel.style.display = 'block';
        layerLabel.style.marginBottom = '8px';

        const layerListContainer = document.createElement('div');
        layerListContainer.style.maxHeight = '150px';
        layerListContainer.style.overflowY = 'auto';
        layerListContainer.style.backgroundColor = '#222';
        layerListContainer.style.border = '1px solid #444';
        layerListContainer.style.borderRadius = '3px';
        layerListContainer.style.padding = '8px';

        const allLayers = app.layerManager.getAllItems().filter(item => !item.isGroup);
        const layerCheckboxes = [];

        const selectAllDiv = document.createElement('div');
        selectAllDiv.style.marginBottom = '8px';
        selectAllDiv.style.paddingBottom = '8px';
        selectAllDiv.style.borderBottom = '1px solid #444';

        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.checked = true;
        selectAllCheckbox.id = 'select-all-layers';

        const selectAllLabel = document.createElement('label');
        selectAllLabel.htmlFor = 'select-all-layers';
        selectAllLabel.textContent = '全选';
        selectAllLabel.style.color = '#90caf9';
        selectAllLabel.style.marginLeft = '5px';
        selectAllLabel.style.cursor = 'pointer';

        selectAllDiv.appendChild(selectAllCheckbox);
        selectAllDiv.appendChild(selectAllLabel);
        layerListContainer.appendChild(selectAllDiv);

        allLayers.forEach((layer, index) => {
            const layerDiv = document.createElement('div');
            layerDiv.style.marginBottom = '5px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.id = `layer-${index}`;
            checkbox.dataset.layerIndex = index;

            const label = document.createElement('label');
            label.htmlFor = `layer-${index}`;
            label.textContent = layer.name;
            label.style.color = '#ddd';
            label.style.marginLeft = '5px';
            label.style.cursor = 'pointer';

            layerDiv.appendChild(checkbox);
            layerDiv.appendChild(label);
            layerListContainer.appendChild(layerDiv);
            layerCheckboxes.push(checkbox);
        });

        selectAllCheckbox.addEventListener('change', () => {
            layerCheckboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
        });

        layerCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                selectAllCheckbox.checked = layerCheckboxes.every(c => c.checked);
            });
        });

        layerGroup.appendChild(layerLabel);
        layerGroup.appendChild(layerListContainer);

        // 误差范围设置
        const toleranceGroup = document.createElement('div');
        toleranceGroup.style.display = 'flex';
        toleranceGroup.style.alignItems = 'center';
        toleranceGroup.style.gap = '10px';
        toleranceGroup.style.marginBottom = '15px';

        const toleranceLabel = document.createElement('label');
        toleranceLabel.textContent = '颜色误差范围:';
        toleranceLabel.style.color = '#ddd';
        toleranceLabel.style.minWidth = '120px';

        const toleranceSlider = document.createElement('input');
        toleranceSlider.type = 'range';
        toleranceSlider.min = '0';
        toleranceSlider.max = '255';
        toleranceSlider.value = '10';
        toleranceSlider.style.flex = '1';

        const toleranceValue = document.createElement('span');
        toleranceValue.textContent = toleranceSlider.value;
        toleranceValue.style.color = '#aaa';
        toleranceValue.style.minWidth = '40px';
        toleranceValue.style.textAlign = 'right';

        toleranceGroup.appendChild(toleranceLabel);
        toleranceGroup.appendChild(toleranceSlider);
        toleranceGroup.appendChild(toleranceValue);

        // 预览区域
        const previewArea = document.createElement('div');
        previewArea.style.marginTop = '15px';
        previewArea.style.padding = '10px';
        previewArea.style.backgroundColor = '#222';
        previewArea.style.borderRadius = '5px';
        previewArea.style.minHeight = '200px';
        previewArea.style.display = 'none';
        previewArea.style.textAlign = 'center';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.style.maxWidth = '100%';
        previewCanvas.style.imageRendering = 'pixelated';
        previewCanvas.style.border = '1px solid #444';
        previewArea.appendChild(previewCanvas);

        content.appendChild(fileGroup);
        content.appendChild(layerGroup);
        content.appendChild(toleranceGroup);
        content.appendChild(previewArea);

        // 按钮区域
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.style.marginTop = '20px';

        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = '分析背景';
        analyzeBtn.className = 'dialog-btn dialog-btn-ok';
        analyzeBtn.disabled = true;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '移除背景';
        removeBtn.className = 'dialog-btn dialog-btn-ok';
        removeBtn.disabled = true;
        removeBtn.style.marginLeft = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.style.marginLeft = '10px';

        buttons.appendChild(analyzeBtn);
        buttons.appendChild(removeBtn);
        buttons.appendChild(cancelBtn);

        // 更新误差值显示
        toleranceSlider.addEventListener('input', () => {
            toleranceValue.textContent = toleranceSlider.value;
        });

        // 背景图片数据
        let backgroundImageData = null;

        // 文件选择处理
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileNameDisplay.textContent = `已选择: ${file.name}`;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = app.config.width;
                    canvas.height = app.config.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    backgroundImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    analyzeBtn.disabled = false;
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // 分析背景
        analyzeBtn.onclick = () => {
            if (!backgroundImageData) {
                alert('请先选择背景图片');
                return;
            }

            const selectedLayers = layerCheckboxes
                .filter(cb => cb.checked)
                .map(cb => allLayers[parseInt(cb.dataset.layerIndex)]);

            if (selectedLayers.length === 0) {
                alert('请至少选择一个图层');
                return;
            }

            const tolerance = parseInt(toleranceSlider.value);

            // 创建预览：合并选中图层去除背景后的效果
            previewCanvas.width = app.config.width;
            previewCanvas.height = app.config.height;
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

            for (const layer of selectedLayers) {
                if (!layer.visible) continue;
                const preview = removeBackground(layer, backgroundImageData, tolerance, false);
                previewCtx.globalAlpha = layer.opacity;
                previewCtx.putImageData(preview, 0, 0);
                previewCtx.globalAlpha = 1;
            }

            previewArea.style.display = 'block';
            removeBtn.disabled = false;
        };

        // 移除背景
        removeBtn.onclick = () => {
            if (!backgroundImageData) {
                alert('请先选择背景图片');
                return;
            }

            const selectedLayers = layerCheckboxes
                .filter(cb => cb.checked)
                .map(cb => allLayers[parseInt(cb.dataset.layerIndex)]);

            if (selectedLayers.length === 0) {
                alert('请至少选择一个图层');
                return;
            }

            if (!confirm(`确定要移除选中的 ${selectedLayers.length} 个图层的背景吗？\n\n此操作会修改图层内容。`)) {
                return;
            }

            const tolerance = parseInt(toleranceSlider.value);

            for (const layer of selectedLayers) {
                const result = removeBackground(layer, backgroundImageData, tolerance, true);
                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                layer.ctx.putImageData(result, 0, 0);
            }

            app.renderLayerList();
            app.render();
            app.saveHistory();

            alert(`已完成 ${selectedLayers.length} 个图层的背景移除！`);
            document.body.removeChild(overlay);
        };

        // 取消按钮
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function removeBackground(layer, backgroundImageData, tolerance, modify) {
        const width = layer.canvas.width;
        const height = layer.canvas.height;
        const layerData = layer.ctx.getImageData(0, 0, width, height);
        const bgData = backgroundImageData.data;
        const layerPixels = layerData.data;

        for (let i = 0; i < layerPixels.length; i += 4) {
            const lr = layerPixels[i];
            const lg = layerPixels[i + 1];
            const lb = layerPixels[i + 2];
            const la = layerPixels[i + 3];

            const br = bgData[i];
            const bg = bgData[i + 1];
            const bb = bgData[i + 2];

            // 检查颜色是否在误差范围内
            if (Math.abs(lr - br) <= tolerance &&
                Math.abs(lg - bg) <= tolerance &&
                Math.abs(lb - bb) <= tolerance) {
                // 移除背景像素（设置为透明）
                layerPixels[i + 3] = 0;
            }
        }

        return layerData;
    }
})();
