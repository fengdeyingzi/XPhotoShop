// ==UserScript==
// @name         PhotoShop - 对称检查工具
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  检查图层是否是水平对称的，支持裁切图层和像素容差设置
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

        console.log('对称检查插件已加载');

        // 在图层菜单中添加对称检查菜单项
        app.menuManager.addMenuItem('图层', {
            label: '对称检查...',
            action: 'symmetry-check',
            handler: () => showSymmetryDialog(app),
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

    function showSymmetryDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '700px';
        dialog.style.maxHeight = '80vh';
        dialog.style.overflow = 'auto';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '对称检查工具';

        const content = document.createElement('div');
        content.style.padding = '15px';

        // 说明文字
        const description = document.createElement('div');
        description.innerHTML = '<p style="color: #aaa; margin-bottom: 15px;">检查当前图层是否是水平对称的。首先会裁切图层内容，然后检查对称性。</p>';
        content.appendChild(description);

        // 控制区域
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.gap = '15px';

        // 像素容差设置
        const toleranceGroup = document.createElement('div');
        toleranceGroup.style.display = 'flex';
        toleranceGroup.style.alignItems = 'center';
        toleranceGroup.style.gap = '10px';

        const toleranceLabel = document.createElement('label');
        toleranceLabel.textContent = '像素容差:';
        toleranceLabel.style.color = '#ddd';
        toleranceLabel.style.minWidth = '120px';

        const toleranceSlider = document.createElement('input');
        toleranceSlider.type = 'range';
        toleranceSlider.min = '0';
        toleranceSlider.max = '255';
        toleranceSlider.value = '0';
        toleranceSlider.style.flex = '1';

        const toleranceValue = document.createElement('span');
        toleranceValue.textContent = toleranceSlider.value;
        toleranceValue.style.color = '#aaa';
        toleranceValue.style.minWidth = '40px';
        toleranceValue.style.textAlign = 'right';

        toleranceGroup.appendChild(toleranceLabel);
        toleranceGroup.appendChild(toleranceSlider);
        toleranceGroup.appendChild(toleranceValue);

        // 显示裁切边界选项
        const showCropGroup = document.createElement('div');
        showCropGroup.style.display = 'flex';
        showCropGroup.style.alignItems = 'center';
        showCropGroup.style.gap = '10px';

        const showCropLabel = document.createElement('label');
        showCropLabel.textContent = '显示裁切边界:';
        showCropLabel.style.color = '#ddd';
        showCropLabel.style.minWidth = '120px';

        const showCropCheckbox = document.createElement('input');
        showCropCheckbox.type = 'checkbox';
        showCropCheckbox.checked = true;
        showCropCheckbox.style.cursor = 'pointer';

        showCropGroup.appendChild(showCropLabel);
        showCropGroup.appendChild(showCropCheckbox);

        controls.appendChild(toleranceGroup);
        controls.appendChild(showCropGroup);

        // 预览区域
        const previewContainer = document.createElement('div');
        previewContainer.style.display = 'grid';
        previewContainer.style.gridTemplateColumns = '1fr 1fr';
        previewContainer.style.gap = '15px';
        previewContainer.style.marginTop = '15px';
        previewContainer.style.marginBottom = '15px';

        // 原始图像
        const originalBox = document.createElement('div');
        const originalLabel = document.createElement('div');
        originalLabel.textContent = '原始图层';
        originalLabel.style.color = '#ddd';
        originalLabel.style.marginBottom = '5px';
        originalLabel.style.fontWeight = 'bold';

        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = 200;
        originalCanvas.height = 200;
        originalCanvas.style.width = '100%';
        originalCanvas.style.border = '1px solid #555';
        originalCanvas.style.imageRendering = 'pixelated';
        originalCanvas.style.backgroundColor = '#1a1a1a';

        originalBox.appendChild(originalLabel);
        originalBox.appendChild(originalCanvas);

        // 对称预览图像
        const symmetryBox = document.createElement('div');
        const symmetryLabel = document.createElement('div');
        symmetryLabel.textContent = '对称预览';
        symmetryLabel.style.color = '#ddd';
        symmetryLabel.style.marginBottom = '5px';
        symmetryLabel.style.fontWeight = 'bold';

        const symmetryCanvas = document.createElement('canvas');
        symmetryCanvas.width = 200;
        symmetryCanvas.height = 200;
        symmetryCanvas.style.width = '100%';
        symmetryCanvas.style.border = '1px solid #555';
        symmetryCanvas.style.imageRendering = 'pixelated';
        symmetryCanvas.style.backgroundColor = '#1a1a1a';

        symmetryBox.appendChild(symmetryLabel);
        symmetryBox.appendChild(symmetryCanvas);

        previewContainer.appendChild(originalBox);
        previewContainer.appendChild(symmetryBox);
        content.appendChild(previewContainer);

        // 结果显示区域
        const resultArea = document.createElement('div');
        resultArea.id = 'symmetryResult';
        resultArea.style.marginTop = '20px';
        resultArea.style.padding = '10px';
        resultArea.style.backgroundColor = '#222';
        resultArea.style.borderRadius = '5px';
        resultArea.style.minHeight = '50px';
        resultArea.style.color = '#ddd';
        resultArea.style.display = 'none';

        content.appendChild(controls);
        content.appendChild(resultArea);

        // 按钮区域
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        buttons.style.marginTop = '20px';

        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = '分析对称性';
        analyzeBtn.className = 'dialog-btn dialog-btn-ok';
        analyzeBtn.style.marginRight = '10px';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.className = 'dialog-btn dialog-btn-cancel';

        buttons.appendChild(analyzeBtn);
        buttons.appendChild(closeBtn);

        // 更新容差值显示
        toleranceSlider.addEventListener('input', () => {
            toleranceValue.textContent = toleranceSlider.value;
        });

        // 裁切图层数据
        function cropLayerData(layer) {
            const canvas = layer.canvas;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = 0;
            let maxY = 0;
            let hasContent = false;

            // 查找非透明像素的边界
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const alpha = data[(y * canvas.width + x) * 4 + 3];
                    if (alpha > 0) {
                        hasContent = true;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            // 如果全透明
            if (!hasContent) {
                return { isEmpty: true };
            }

            // 创建裁切后的画布
            const croppedWidth = maxX - minX + 1;
            const croppedHeight = maxY - minY + 1;
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = croppedWidth;
            croppedCanvas.height = croppedHeight;
            const croppedCtx = croppedCanvas.getContext('2d');

            croppedCtx.drawImage(
                canvas,
                minX, minY, croppedWidth, croppedHeight,
                0, 0, croppedWidth, croppedHeight
            );

            // 转换为base64
            const base64 = croppedCanvas.toDataURL('image/png');

            return {
                isEmpty: false,
                x: minX,
                y: minY,
                width: croppedWidth,
                height: croppedHeight,
                base64: base64,
                canvas: croppedCanvas
            };
        }

        // 检查水平对称性
        function checkHorizontalSymmetry(croppedData, tolerance) {
            if (croppedData.isEmpty) {
                return { isSymmetric: false, message: '图层内容为空' };
            }

            const canvas = croppedData.canvas;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            let totalPixels = 0;
            let mismatchedPixels = 0;
            const mismatches = []; // 存储不匹配的像素位置

            // 检查每个像素的水平对称性
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < Math.ceil(width / 2); x++) {
                    const mirrorX = width - x - 1;
                    
                    const idx1 = (y * width + x) * 4;
                    const idx2 = (y * width + mirrorX) * 4;

                    const r1 = data[idx1];
                    const g1 = data[idx1 + 1];
                    const b1 = data[idx1 + 2];
                    const a1 = data[idx1 + 3];

                    const r2 = data[idx2];
                    const g2 = data[idx2 + 1];
                    const b2 = data[idx2 + 2];
                    const a2 = data[idx2 + 3];

                    // 如果像素不透明才计入总数
                    if (a1 > 0 || a2 > 0) {
                        totalPixels++;

                        // 检查像素是否匹配（考虑容差）
                        const isMatch = 
                            Math.abs(r1 - r2) <= tolerance &&
                            Math.abs(g1 - g2) <= tolerance &&
                            Math.abs(b1 - b2) <= tolerance &&
                            Math.abs(a1 - a2) <= tolerance;

                        if (!isMatch) {
                            mismatchedPixels++;
                            mismatches.push({ x, y, mirrorX });
                        }
                    }
                }
            }

            if (totalPixels === 0) {
                return { isSymmetric: false, message: '没有有效的像素可检查' };
            }

            const symmetryRate = ((totalPixels - mismatchedPixels) / totalPixels) * 100;
            const isSymmetric = mismatchedPixels === 0;

            return {
                isSymmetric: isSymmetric,
                symmetryRate: symmetryRate,
                totalPixels: totalPixels,
                mismatchedPixels: mismatchedPixels,
                mismatches: mismatches,
                width: width,
                height: height,
                tolerance: tolerance
            };
        }

        // 绘制裁切和对称分析结果
        function drawPreview(result, croppedData, showCropBoundary) {
            const originalCtx = originalCanvas.getContext('2d');
            const symmetryCtx = symmetryCanvas.getContext('2d');

            // 清空画布
            originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
            symmetryCtx.clearRect(0, 0, symmetryCanvas.width, symmetryCanvas.height);

            if (croppedData.isEmpty) {
                originalCtx.fillStyle = '#ff6b6b';
                originalCtx.font = '12px Arial';
                originalCtx.textAlign = 'center';
                originalCtx.fillText('图层为空', 100, 100);
                return;
            }

            // 计算缩放比例以适应预览区域
            const scale = Math.min(
                (originalCanvas.width - 20) / croppedData.width,
                (originalCanvas.height - 20) / croppedData.height,
                10 // 最大缩放10倍
            );

            const scaledWidth = croppedData.width * scale;
            const scaledHeight = croppedData.height * scale;
            const offsetX = (originalCanvas.width - scaledWidth) / 2;
            const offsetY = (originalCanvas.height - scaledHeight) / 2;

            // 绘制原始裁切图像
            originalCtx.save();
            originalCtx.imageSmoothingEnabled = false;
            originalCtx.drawImage(
                croppedData.canvas,
                0, 0, croppedData.width, croppedData.height,
                offsetX, offsetY, scaledWidth, scaledHeight
            );

            // 绘制裁切边界（如果需要）
            if (showCropBoundary) {
                originalCtx.strokeStyle = '#4CAF50';
                originalCtx.lineWidth = 1;
                originalCtx.setLineDash([5, 5]);
                originalCtx.strokeRect(offsetX, offsetY, scaledWidth, scaledHeight);
                originalCtx.setLineDash([]);
            }
            originalCtx.restore();

            // 绘制对称分析结果
            symmetryCtx.save();
            symmetryCtx.imageSmoothingEnabled = false;
            symmetryCtx.drawImage(
                croppedData.canvas,
                0, 0, croppedData.width, croppedData.height,
                offsetX, offsetY, scaledWidth, scaledHeight
            );

            // 绘制对称轴
            symmetryCtx.strokeStyle = '#ffa726';
            symmetryCtx.lineWidth = 1;
            const centerX = offsetX + scaledWidth / 2;
            symmetryCtx.beginPath();
            symmetryCtx.moveTo(centerX, offsetY);
            symmetryCtx.lineTo(centerX, offsetY + scaledHeight);
            symmetryCtx.stroke();

            // 绘制不匹配的像素（如果有）
            if (result.mismatches && result.mismatches.length > 0) {
                // 只显示最多100个不匹配点，避免性能问题
                const maxPoints = Math.min(result.mismatches.length, 100);
                const step = Math.ceil(result.mismatches.length / maxPoints);

                symmetryCtx.fillStyle = 'rgba(255, 107, 107, 0.5)';
                for (let i = 0; i < result.mismatches.length; i += step) {
                    const mismatch = result.mismatches[i];
                    const x1 = offsetX + mismatch.x * scale;
                    const x2 = offsetX + mismatch.mirrorX * scale;
                    const y = offsetY + mismatch.y * scale;

                    // 绘制两个不匹配的点
                    symmetryCtx.fillRect(x1, y, scale, scale);
                    symmetryCtx.fillRect(x2, y, scale, scale);
                }
            }

            symmetryCtx.restore();
        }

        // 分析按钮点击处理
        analyzeBtn.onclick = () => {
            const activeItem = app.layerManager.activeItem;
            if (!activeItem || activeItem.isGroup) {
                alert('请先选择一个图层（不是图层组）');
                return;
            }

            const tolerance = parseInt(toleranceSlider.value);
            const showCropBoundary = showCropCheckbox.checked;

            // 清空结果
            resultArea.innerHTML = '';
            resultArea.style.display = 'none';

            try {
                // 裁切图层
                const croppedData = cropLayerData(activeItem);
                
                if (croppedData.isEmpty) {
                    resultArea.innerHTML = '<p style="color: #ff6b6b;">图层内容为空，无法进行对称检查。</p>';
                    resultArea.style.display = 'block';
                    return;
                }

                // 检查对称性
                const result = checkHorizontalSymmetry(croppedData, tolerance);
                
                // 绘制预览
                drawPreview(result, croppedData, showCropBoundary);

                // 显示结果
                let html = '';
                
                if (result.isSymmetric) {
                    html += `<p style="color: #4CAF50; font-weight: bold; margin-bottom: 10px;">✅ 完美水平对称！</p>`;
                } else {
                    html += `<p style="color: #ffa726; font-weight: bold; margin-bottom: 10px;">⚠️ 非完美水平对称</p>`;
                }
                
                html += `<div style="color: #ddd;">
                    <p><strong>裁切尺寸:</strong> ${croppedData.width} × ${croppedData.height} 像素</p>
                    <p><strong>对称率:</strong> ${result.symmetryRate.toFixed(2)}%</p>
                    <p><strong>检查像素数:</strong> ${result.totalPixels}</p>
                    <p><strong>不匹配像素:</strong> ${result.mismatchedPixels}</p>
                    <p><strong>像素容差:</strong> ${tolerance}</p>
                </div>`;
                
                if (result.mismatchedPixels > 0) {
                    html += `<p style="margin-top: 10px; color: #90caf9;">`;
                    if (result.mismatches.length <= 10) {
                        html += '<strong>不匹配位置:</strong> ';
                        const positions = result.mismatches.slice(0, 10).map(m => `(${m.x},${m.y})↔(${m.mirrorX},${m.y})`);
                        html += positions.join(', ');
                    } else {
                        html += `<strong>不匹配位置:</strong> 共 ${result.mismatches.length} 处（预览中标记了部分）`;
                    }
                    html += '</p>';
                }
                
                resultArea.innerHTML = html;
                resultArea.style.display = 'block';

            } catch (error) {
                console.error('对称检查时出错:', error);
                resultArea.innerHTML = `<p style="color: #ff6b6b;">检查失败: ${error.message}</p>`;
                resultArea.style.display = 'block';
            }
        };

        // 关闭按钮
        closeBtn.onclick = () => document.body.removeChild(overlay);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 自动分析当前图层
        setTimeout(() => {
            const activeItem = app.layerManager.activeItem;
            if (activeItem && !activeItem.isGroup) {
                analyzeBtn.click();
            }
        }, 100);
    }

    // 工具函数：将RGB值转换为十六进制
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // 工具函数：计算像素差异
    function getPixelDifference(pixel1, pixel2) {
        const dr = Math.abs(pixel1.r - pixel2.r);
        const dg = Math.abs(pixel1.g - pixel2.g);
        const db = Math.abs(pixel1.b - pixel2.b);
        const da = Math.abs(pixel1.a - pixel2.a);
        return Math.max(dr, dg, db, da);
    }
})();
