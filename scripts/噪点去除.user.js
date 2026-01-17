// ==UserScript==
// @name         PhotoShop - 噪点去除工具
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  智能检测并去除图层中的噪点，将噪点转换为透明色
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

        console.log('噪点去除插件已加载');

        app.menuManager.addMenuItem('图像', {
            label: '去除噪点...',
            action: 'remove-noise',
            handler: () => showNoiseRemovalDialog(app),
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

    function showNoiseRemovalDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '500px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '噪点去除工具';

        const content = document.createElement('div');
        content.style.padding = '20px';

        // 说明
        const description = document.createElement('div');
        description.style.cssText = 'color: #aaa; margin-bottom: 20px; font-size: 12px; line-height: 1.5;';
        description.innerHTML = '检测并去除图层中的噪点。噪点检测条件：像素面积小于设定值，且上下左右至少指定数量方向有透明像素。';
        content.appendChild(description);

        // 处理范围选择
        const scopeGroup = document.createElement('div');
        scopeGroup.style.marginBottom = '20px';

        const scopeLabel = document.createElement('label');
        scopeLabel.style.cssText = 'display: block; margin-bottom: 10px; font-size: 13px; color: #ddd; font-weight: 600;';
        scopeLabel.textContent = '处理范围:';

        const scopeRadios = document.createElement('div');
        scopeRadios.style.cssText = 'display: flex; gap: 20px;';
        scopeRadios.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer; font-size: 12px; color: #b0b0b0;">
                <input type="radio" name="scope" value="current" checked style="margin-right: 8px; accent-color: #6ba4ff;"> 当前图层
            </label>
            <label style="display: flex; align-items: center; cursor: pointer; font-size: 12px; color: #b0b0b0;">
                <input type="radio" name="scope" value="all" style="margin-right: 8px; accent-color: #6ba4ff;"> 所有图层
            </label>
        `;

        scopeGroup.appendChild(scopeLabel);
        scopeGroup.appendChild(scopeRadios);

        // 噪点面积阈值
        const areaGroup = document.createElement('div');
        areaGroup.style.marginBottom = '20px';

        const areaLabel = document.createElement('div');
        areaLabel.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #b0b0b0;';
        areaLabel.innerHTML = '<span>噪点面积阈值</span><span id="areaValue" style="color: #6ba4ff; font-weight: 600;">4</span>';

        const areaSlider = document.createElement('input');
        areaSlider.type = 'range';
        areaSlider.min = '1';
        areaSlider.max = '20';
        areaSlider.value = '4';
        areaSlider.style.cssText = 'width: 100%; height: 8px; -webkit-appearance: none; appearance: none; background: rgba(0, 0, 0, 0.3); border-radius: 5px; outline: none;';

        const areaDesc = document.createElement('div');
        areaDesc.style.cssText = 'margin-top: 5px; font-size: 11px; color: #888;';
        areaDesc.textContent = '小于此面积（像素数）的连通区域将被视为噪点';

        areaGroup.appendChild(areaLabel);
        areaGroup.appendChild(areaSlider);
        areaGroup.appendChild(areaDesc);

        // 透明方向要求
        const directionGroup = document.createElement('div');
        directionGroup.style.marginBottom = '20px';

        const directionLabel = document.createElement('div');
        directionLabel.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #b0b0b0;';
        directionLabel.innerHTML = '<span>透明方向要求</span><span id="directionValue" style="color: #6ba4ff; font-weight: 600;">3</span>';

        const directionSlider = document.createElement('input');
        directionSlider.type = 'range';
        directionSlider.min = '1';
        directionSlider.max = '4';
        directionSlider.value = '3';
        directionSlider.style.cssText = 'width: 100%; height: 8px; -webkit-appearance: none; appearance: none; background: rgba(0, 0, 0, 0.3); border-radius: 5px; outline: none;';

        const directionDesc = document.createElement('div');
        directionDesc.style.cssText = 'margin-top: 5px; font-size: 11px; color: #888;';
        directionDesc.textContent = '噪点上下左右至少需要几个方向有透明像素';

        directionGroup.appendChild(directionLabel);
        directionGroup.appendChild(directionSlider);
        directionGroup.appendChild(directionDesc);

        // 统计信息
        const statsBox = document.createElement('div');
        statsBox.style.cssText = 'background-color: #2a2a2a; border: 1px solid #555; border-radius: 5px; padding: 15px; margin-top: 20px; display: none;';
        statsBox.innerHTML = `
            <div style="display: flex; justify-content: space-around; gap: 10px;">
                <div style="text-align: center;">
                    <div id="noiseCount" style="font-size: 1.5rem; color: #6ba4ff; font-weight: 700;">0</div>
                    <div style="font-size: 0.85rem; color: #888;">检测到的噪点</div>
                </div>
                <div style="text-align: center;">
                    <div id="pixelsRemoved" style="font-size: 1.5rem; color: #6ba4ff; font-weight: 700;">0</div>
                    <div style="font-size: 0.85rem; color: #888;">移除的像素</div>
                </div>
                <div style="text-align: center;">
                    <div id="processTime" style="font-size: 1.5rem; color: #6ba4ff; font-weight: 700;">0ms</div>
                    <div style="font-size: 0.85rem; color: #888;">处理时间</div>
                </div>
            </div>
        `;

        content.appendChild(scopeGroup);
        content.appendChild(areaGroup);
        content.appendChild(directionGroup);
        content.appendChild(statsBox);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.style.marginTop = '20px';

        const processBtn = document.createElement('button');
        processBtn.textContent = '去除噪点';
        processBtn.className = 'dialog-btn dialog-btn-ok';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.style.marginLeft = '10px';

        buttons.appendChild(processBtn);
        buttons.appendChild(cancelBtn);

        // 更新滑块显示
        areaSlider.addEventListener('input', () => {
            document.getElementById('areaValue').textContent = areaSlider.value;
        });

        directionSlider.addEventListener('input', () => {
            document.getElementById('directionValue').textContent = directionSlider.value;
        });

        // 处理噪点
        processBtn.addEventListener('click', () => {
            const scope = document.querySelector('input[name="scope"]:checked').value;
            const maxNoiseArea = parseInt(areaSlider.value);
            const minTransparentDirections = parseInt(directionSlider.value);

            const layers = scope === 'all' ? app.layerManager.getAllLayers() : [app.layerManager.getActiveLayer()];

            if (!layers || layers.length === 0 || !layers[0]) {
                alert('没有可处理的图层');
                return;
            }

            const startTime = performance.now();
            let totalNoiseAreas = 0;
            let totalPixelsRemoved = 0;

            for (const layer of layers) {
                const result = removeNoiseFromLayer(layer, maxNoiseArea, minTransparentDirections);
                totalNoiseAreas += result.noiseAreas;
                totalPixelsRemoved += result.pixelsRemoved;
            }

            const endTime = performance.now();

            // 更新统计
            document.getElementById('noiseCount').textContent = totalNoiseAreas;
            document.getElementById('pixelsRemoved').textContent = totalPixelsRemoved;
            document.getElementById('processTime').textContent = `${Math.round(endTime - startTime)}ms`;
            statsBox.style.display = 'block';

            app.renderLayerList();
            app.render();
            app.saveHistory();

            alert(`处理完成！\n检测到 ${totalNoiseAreas} 个噪点\n移除了 ${totalPixelsRemoved} 个像素`);
        });

        cancelBtn.addEventListener('click', () => document.body.removeChild(overlay));

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function removeNoiseFromLayer(layer, maxNoiseArea, minTransparentDirections) {
        const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
        const data = imageData.data;
        const width = layer.canvas.width;
        const height = layer.canvas.height;

        const visited = new Array(width * height).fill(false);
        const isNoise = new Array(width * height).fill(false);

        let noiseAreas = 0;
        let pixelsRemoved = 0;

        // 遍历所有像素
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;

                if (visited[index] || data[index * 4 + 3] === 0) continue;

                // BFS查找连通区域
                const region = [];
                const queue = [[x, y]];
                visited[index] = true;

                while (queue.length > 0) {
                    const [cx, cy] = queue.shift();
                    const cIndex = cy * width + cx;
                    region.push([cx, cy]);

                    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

                    for (const [dx, dy] of directions) {
                        const nx = cx + dx;
                        const ny = cy + dy;

                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                        const nIndex = ny * width + nx;

                        if (!visited[nIndex] && data[nIndex * 4 + 3] > 0) {
                            visited[nIndex] = true;
                            queue.push([nx, ny]);
                        }
                    }
                }

                // 检查是否为噪点
                if (region.length <= maxNoiseArea) {
                    let allPixelsMeetCondition = true;

                    for (const [px, py] of region) {
                        let transparentDirections = 0;
                        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

                        for (const [dx, dy] of directions) {
                            const nx = px + dx;
                            const ny = py + dy;

                            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                                transparentDirections++;
                            } else {
                                const nIndex = (ny * width + nx) * 4;
                                if (data[nIndex + 3] === 0) {
                                    transparentDirections++;
                                }
                            }
                        }

                        if (transparentDirections < minTransparentDirections) {
                            allPixelsMeetCondition = false;
                            break;
                        }
                    }

                    if (allPixelsMeetCondition) {
                        noiseAreas++;
                        pixelsRemoved += region.length;

                        for (const [px, py] of region) {
                            const pIndex = py * width + px;
                            isNoise[pIndex] = true;
                        }
                    }
                }
            }
        }

        // 将噪点设置为透明
        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            if (isNoise[pixelIndex]) {
                data[i + 3] = 0;
            }
        }

        layer.ctx.putImageData(imageData, 0, 0);

        return { noiseAreas, pixelsRemoved };
    }
})();
