// ==UserScript==
// @name         PhotoShop - 地图图块预览
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  在画布四周显示平铺预览，用于检查图块无缝拼接效果
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("地图图块预览脚本开始执行...");

    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.log('PhotoShop应用未加载，等待中...');
            return false;
        }

        console.log('地图图块预览插件已加载');

        // 在工具选项栏添加预览复选框
        const toolOptionsBar = document.getElementById('toolOptionsBar');

        const tilePreviewOption = document.createElement('div');
        tilePreviewOption.className = 'tool-options';
        tilePreviewOption.style.display = 'flex';
        tilePreviewOption.style.marginLeft = 'auto';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'tilePreviewCheckbox';
        checkbox.style.cursor = 'pointer';

        const label = document.createElement('label');
        label.htmlFor = 'tilePreviewCheckbox';
        label.textContent = '预览图块';
        label.style.cursor = 'pointer';
        label.style.marginLeft = '5px';
        label.style.color = '#dcdcdc';

        tilePreviewOption.appendChild(checkbox);
        tilePreviewOption.appendChild(label);
        toolOptionsBar.appendChild(tilePreviewOption);

        // 创建预览画布容器
        const canvasContainer = document.getElementById('canvasContainer');
        const tilePreviewContainer = document.createElement('div');
        tilePreviewContainer.id = 'tilePreviewContainer';
        tilePreviewContainer.style.position = 'absolute';
        tilePreviewContainer.style.top = '0';
        tilePreviewContainer.style.left = '0';
        tilePreviewContainer.style.width = '100%';
        tilePreviewContainer.style.height = '100%';
        tilePreviewContainer.style.pointerEvents = 'none';
        tilePreviewContainer.style.display = 'none';

        // 创建四个方向的预览画布
        const directions = ['top', 'right', 'bottom', 'left'];
        directions.forEach(dir => {
            const canvas = document.createElement('canvas');
            canvas.className = `tile-preview-${dir}`;
            canvas.style.position = 'absolute';
            canvas.style.imageRendering = 'pixelated';
            tilePreviewContainer.appendChild(canvas);
        });

        canvasContainer.appendChild(tilePreviewContainer);

        // 更新预览
        function updateTilePreview() {
            if (!checkbox.checked) {
                tilePreviewContainer.style.display = 'none';
                return;
            }

            tilePreviewContainer.style.display = 'block';
            const displayCanvas = document.getElementById('displayCanvas');
            const rect = displayCanvas.getBoundingClientRect();
            const containerRect = canvasContainer.getBoundingClientRect();

            const offsetX = rect.left - containerRect.left;
            const offsetY = rect.top - containerRect.top;
            const w = rect.width;
            const h = rect.height;

            // 上方
            const topCanvas = tilePreviewContainer.querySelector('.tile-preview-top');
            topCanvas.width = displayCanvas.width;
            topCanvas.height = displayCanvas.height;
            topCanvas.style.width = w + 'px';
            topCanvas.style.height = h + 'px';
            topCanvas.style.left = offsetX + 'px';
            topCanvas.style.top = (offsetY - h) + 'px';
            topCanvas.getContext('2d').drawImage(displayCanvas, 0, 0);

            // 右方
            const rightCanvas = tilePreviewContainer.querySelector('.tile-preview-right');
            rightCanvas.width = displayCanvas.width;
            rightCanvas.height = displayCanvas.height;
            rightCanvas.style.width = w + 'px';
            rightCanvas.style.height = h + 'px';
            rightCanvas.style.left = (offsetX + w) + 'px';
            rightCanvas.style.top = offsetY + 'px';
            rightCanvas.getContext('2d').drawImage(displayCanvas, 0, 0);

            // 下方
            const bottomCanvas = tilePreviewContainer.querySelector('.tile-preview-bottom');
            bottomCanvas.width = displayCanvas.width;
            bottomCanvas.height = displayCanvas.height;
            bottomCanvas.style.width = w + 'px';
            bottomCanvas.style.height = h + 'px';
            bottomCanvas.style.left = offsetX + 'px';
            bottomCanvas.style.top = (offsetY + h) + 'px';
            bottomCanvas.getContext('2d').drawImage(displayCanvas, 0, 0);

            // 左方
            const leftCanvas = tilePreviewContainer.querySelector('.tile-preview-left');
            leftCanvas.width = displayCanvas.width;
            leftCanvas.height = displayCanvas.height;
            leftCanvas.style.width = w + 'px';
            leftCanvas.style.height = h + 'px';
            leftCanvas.style.left = (offsetX - w) + 'px';
            leftCanvas.style.top = offsetY + 'px';
            leftCanvas.getContext('2d').drawImage(displayCanvas, 0, 0);
        }

        // 监听复选框变化
        checkbox.addEventListener('change', updateTilePreview);

        // 劫持原始render方法
        const originalRender = app.render.bind(app);
        app.render = function() {
            originalRender();
            updateTilePreview();
        };

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

})();
