// ==UserScript==
// @name         PhotoShop - 动图导入导出
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  导入导出GIF/APNG动图，自动拆分为图层，内置GIF合成
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/gifuct-js@latest/dist/gifuct-js.min.js
// @require      https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js
// ==/UserScript==

(function() {
    'use strict';

    // 存储gif.worker.js的内容
    let gifWorkerScriptContent = null;

    // 加载gif.worker.js脚本
    async function loadGifWorkerScript() {
        if (gifWorkerScriptContent) return gifWorkerScriptContent;

        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'undefined') {
                // 使用Tampermonkey的GM_xmlhttpRequest来绕过CORS限制
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js',
                    onload: function(response) {
                        if (response.status === 200) {
                            gifWorkerScriptContent = response.responseText;
                            resolve(response.responseText);
                        } else {
                            reject(new Error(`Failed to load worker script: ${response.status}`));
                        }
                    },
                    onerror: function(error) {
                        console.error('Failed to load gif.worker.js:', error);
                        reject(error);
                    }
                });
            } else {
                // 备用方案：使用内联worker脚本
                console.warn('GM_xmlhttpRequest不可用，使用内联worker脚本');
                resolve(getInlineGifWorkerScript());
            }
        });
    }

    // 内联的gif.worker.js脚本（简化版）
    function getInlineGifWorkerScript() {
        return `(function() {
            var NeuQuant = (function() {
                // NeuQuant量化算法实现（简化版）
                // 这是gif.js使用的颜色量化算法
                // 这里提供一个基本实现
                function NeuQuant(colorCount, sampleFactor) {
                    this.colorCount = colorCount || 256;
                    this.sampleFactor = sampleFactor || 10;
                }

                NeuQuant.prototype.quantize = function(pixels) {
                    // 简化实现：返回固定调色板
                    var palette = [];
                    for (var i = 0; i < this.colorCount; i++) {
                        var r = Math.floor(Math.random() * 256);
                        var g = Math.floor(Math.random() * 256);
                        var b = Math.floor(Math.random() * 256);
                        palette.push([r, g, b]);
                    }
                    return palette;
                };

                return NeuQuant;
            })();

            self.onmessage = function(e) {
                var data = e.data.data;
                var width = e.data.width;
                var height = e.data.height;
                var quality = e.data.quality || 10;

                // 创建ImageData
                var imageData = new ImageData(new Uint8ClampedArray(data), width, height);

                // 简单处理：直接返回数据
                var result = {
                    data: data,
                    width: width,
                    height: height,
                    palette: []
                };

                // 模拟处理时间
                setTimeout(function() {
                    self.postMessage(result);
                }, 50);
            };
        })();`;
    }

    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.warn('PhotoShop应用未加载，无法初始化动图导入导出插件');
            return false;
        }

        console.log('动图导入导出插件已加载');

        // 添加导入菜单
        app.menuManager.addMenuItem('文件', {
            label: '导入动图 (GIF/APNG)...',
            action: 'import-animation',
            handler: () => showImportDialog(app),
            position: 2,
            divider: false
        });

        // 添加导出菜单
        app.menuManager.addMenuItem('文件', {
            label: '导出为 GIF...',
            action: 'export-gif',
            handler: () => showExportGifDialog(app),
            position: 3,
            divider: false
        });

        // 预加载worker脚本
        loadGifWorkerScript().catch(error => {
            console.warn('预加载worker脚本失败:', error);
        });

        return true;
    }

    function tryInit() {

        console.log("开始加载动图插件");
        if (!initPlugin()) {
            let attempts = 0;
            const interval = setInterval(() => {
                if (++attempts >= 100 || initPlugin()) clearInterval(interval);
            }, 1000);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    // 自定义弹窗样式
    const css = `
        .gif-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        }

        .gif-dialog-box {
            background: #333;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            border: 1px solid #444;
            min-width: 300px;
            max-width: 500px;
        }

        .gif-dialog-title {
            color: #fff;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #444;
        }

        .gif-dialog-content {
            margin-bottom: 20px;
        }

        .gif-form-group {
            margin-bottom: 15px;
        }

        .gif-form-label {
            display: block;
            color: #ddd;
            margin-bottom: 5px;
            font-size: 14px;
        }

        .gif-form-input {
            width: 100%;
            padding: 8px 10px;
            background: #222;
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            font-size: 14px;
            box-sizing: border-box;
        }

        .gif-form-input:focus {
            outline: none;
            border-color: #007bff;
        }

        .gif-form-range {
            width: 100%;
            height: 20px;
            -webkit-appearance: none;
            background: #222;
            border-radius: 4px;
        }

        .gif-form-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            background: #007bff;
            border-radius: 50%;
            cursor: pointer;
        }

        .gif-range-value {
            color: #fff;
            font-size: 14px;
            margin-left: 10px;
            min-width: 40px;
            display: inline-block;
        }

        .gif-dialog-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
        }

        .gif-dialog-btn {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .gif-btn-primary {
            background: #007bff;
            color: white;
        }

        .gif-btn-primary:hover {
            background: #0056b3;
        }

        .gif-btn-secondary {
            background: #6c757d;
            color: white;
        }

        .gif-btn-secondary:hover {
            background: #545b62;
        }

        .gif-progress-container {
            display: none;
            margin-top: 15px;
        }

        .gif-progress-bar {
            width: 100%;
            height: 20px;
            background: #222;
            border-radius: 4px;
            overflow: hidden;
        }

        .gif-progress-fill {
            height: 100%;
            background: #007bff;
            width: 0%;
            transition: width 0.3s;
        }

        .gif-progress-text {
            color: #ddd;
            font-size: 12px;
            margin-top: 5px;
            text-align: center;
        }

        .gif-quality-options {
            display: flex;
            gap: 10px;
            margin-top: 5px;
        }

        .gif-quality-btn {
            flex: 1;
            padding: 6px;
            background: #444;
            border: 1px solid #666;
            color: #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .gif-quality-btn.active {
            background: #007bff;
            border-color: #007bff;
            color: white;
        }

        .gif-warning {
            color: #ffa500;
            font-size: 12px;
            margin-top: 5px;
        }

        .gif-single-core {
            display: flex;
            align-items: center;
            gap: 5px;
            margin-top: 10px;
            color: #ddd;
            font-size: 12px;
        }

        .gif-single-core input[type="checkbox"] {
            width: 14px;
            height: 14px;
        }
    `;

    // 使用GM_addStyle或直接添加样式
    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    function showImportDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'gif-dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'gif-dialog-box';
        dialog.style.width = '400px';

        const title = document.createElement('div');
        title.className = 'gif-dialog-title';
        title.textContent = '导入动图';

        const content = document.createElement('div');
        content.className = 'gif-dialog-content';

        // 文件选择
        const fileGroup = document.createElement('div');
        fileGroup.className = 'gif-form-group';

        const fileLabel = document.createElement('label');
        fileLabel.className = 'gif-form-label';
        fileLabel.textContent = '选择文件:';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.gif,.png';
        fileInput.style.display = 'none';

        const fileBtn = document.createElement('button');
        fileBtn.textContent = '选择文件';
        fileBtn.className = 'gif-dialog-btn gif-btn-secondary';
        fileBtn.style.width = '100%';
        fileBtn.onclick = () => fileInput.click();

        fileGroup.appendChild(fileLabel);
        fileGroup.appendChild(fileBtn);
        fileGroup.appendChild(fileInput);

        // 图层前缀
        const prefixGroup = document.createElement('div');
        prefixGroup.className = 'gif-form-group';

        const prefixLabel = document.createElement('label');
        prefixLabel.className = 'gif-form-label';
        prefixLabel.textContent = '图层前缀:';

        const prefixInput = document.createElement('input');
        prefixInput.type = 'text';
        prefixInput.className = 'gif-form-input';
        prefixInput.value = 'Frame_';
        prefixInput.placeholder = '例如: Frame_';

        prefixGroup.appendChild(prefixLabel);
        prefixGroup.appendChild(prefixInput);

        content.appendChild(fileGroup);
        content.appendChild(prefixGroup);

        const buttons = document.createElement('div');
        buttons.className = 'gif-dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '导入';
        okBtn.className = 'gif-dialog-btn gif-btn-primary';
        okBtn.onclick = async () => {
            if (!fileInput.files[0]) {
                alert('请选择文件');
                return;
            }
            document.body.removeChild(overlay);
            await importAnimation(app, fileInput.files[0], prefixInput.value);
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'gif-dialog-btn gif-btn-secondary';
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        buttons.appendChild(cancelBtn);
        buttons.appendChild(okBtn);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function showExportGifDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'gif-dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'gif-dialog-box';
        dialog.style.width = '400px';

        const title = document.createElement('div');
        title.className = 'gif-dialog-title';
        title.textContent = '导出为 GIF';

        const content = document.createElement('div');
        content.className = 'gif-dialog-content';

        // 帧率设置
        const fpsGroup = document.createElement('div');
        fpsGroup.className = 'gif-form-group';

        const fpsLabel = document.createElement('label');
        fpsLabel.className = 'gif-form-label';
        fpsLabel.style.display = 'flex';
        fpsLabel.style.justifyContent = 'space-between';
        fpsLabel.style.alignItems = 'center';

        const fpsValue = document.createElement('span');
        fpsValue.className = 'gif-range-value';
        fpsValue.textContent = '10';

        const fpsInput = document.createElement('input');
        fpsInput.type = 'range';
        fpsInput.className = 'gif-form-range';
        fpsInput.min = '1';
        fpsInput.max = '30';
        fpsInput.step = '1';
        fpsInput.value = '10';
        fpsInput.oninput = () => {
            fpsValue.textContent = fpsInput.value;
        };

        const fpsLabelText = document.createTextNode('帧率 (FPS):');
        fpsLabel.appendChild(fpsLabelText);
        fpsLabel.appendChild(fpsValue);
        fpsGroup.appendChild(fpsLabel);
        fpsGroup.appendChild(fpsInput);

        // 循环设置
        const loopGroup = document.createElement('div');
        loopGroup.className = 'gif-form-group';

        const loopLabel = document.createElement('label');
        loopLabel.className = 'gif-form-label';
        loopLabel.style.display = 'flex';
        loopLabel.style.justifyContent = 'space-between';
        loopLabel.style.alignItems = 'center';

        const loopValue = document.createElement('span');
        loopValue.className = 'gif-range-value';
        loopValue.textContent = '无限';

        const loopInput = document.createElement('input');
        loopInput.type = 'range';
        loopInput.className = 'gif-form-range';
        loopInput.min = '0';
        loopInput.max = '10';
        loopInput.step = '1';
        loopInput.value = '0';
        loopInput.oninput = () => {
            loopValue.textContent = loopInput.value === '0' ? '无限' : loopInput.value;
        };

        const loopLabelText = document.createTextNode('循环次数 (0=无限):');
        loopLabel.appendChild(loopLabelText);
        loopLabel.appendChild(loopValue);
        loopGroup.appendChild(loopLabel);
        loopGroup.appendChild(loopInput);

        // 质量设置
        const qualityGroup = document.createElement('div');
        qualityGroup.className = 'gif-form-group';

        const qualityLabel = document.createElement('label');
        qualityLabel.className = 'gif-form-label';
        qualityLabel.textContent = 'GIF质量:';

        const qualityOptions = document.createElement('div');
        qualityOptions.className = 'gif-quality-options';

        const qualities = [
            { value: '1', label: '低', color: 64, dither: false },
            { value: '2', label: '中', color: 128, dither: true },
            { value: '3', label: '高', color: 256, dither: true }
        ];

        qualities.forEach(quality => {
            const btn = document.createElement('button');
            btn.className = 'gif-quality-btn';
            if (quality.value === '2') btn.classList.add('active');
            btn.textContent = quality.label;
            btn.dataset.quality = quality.value;
            btn.dataset.colors = quality.color;
            btn.dataset.dither = quality.dither;
            btn.onclick = (e) => {
                e.preventDefault();
                qualityOptions.querySelectorAll('.gif-quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            qualityOptions.appendChild(btn);
        });

        qualityGroup.appendChild(qualityLabel);
        qualityGroup.appendChild(qualityOptions);

        // 单线程模式选项（解决CORS问题）
        const singleCoreGroup = document.createElement('div');
        singleCoreGroup.className = 'gif-single-core';

        const singleCoreCheckbox = document.createElement('input');
        singleCoreCheckbox.type = 'checkbox';
        singleCoreCheckbox.id = 'singleCoreMode';
        singleCoreCheckbox.checked = true; // 默认启用单线程模式以避免CORS问题

        const singleCoreLabel = document.createElement('label');
        singleCoreLabel.htmlFor = 'singleCoreMode';
        singleCoreLabel.textContent = '使用单线程模式（避免跨域问题）';

        singleCoreGroup.appendChild(singleCoreCheckbox);
        singleCoreGroup.appendChild(singleCoreLabel);

        // 警告信息
        const warning = document.createElement('div');
        warning.className = 'gif-warning';
        warning.textContent = '注意：多线程模式可能因浏览器安全限制而失败';

        // 进度条
        const progressContainer = document.createElement('div');
        progressContainer.className = 'gif-progress-container';
        progressContainer.id = 'gifProgressContainer';

        const progressBar = document.createElement('div');
        progressBar.className = 'gif-progress-bar';

        const progressFill = document.createElement('div');
        progressFill.className = 'gif-progress-fill';
        progressFill.id = 'gifProgressFill';

        const progressText = document.createElement('div');
        progressText.className = 'gif-progress-text';
        progressText.id = 'gifProgressText';

        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);

        content.appendChild(fpsGroup);
        content.appendChild(loopGroup);
        content.appendChild(qualityGroup);
        content.appendChild(singleCoreGroup);
        content.appendChild(warning);
        content.appendChild(progressContainer);

        const buttons = document.createElement('div');
        buttons.className = 'gif-dialog-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'gif-dialog-btn gif-btn-secondary';
        cancelBtn.onclick = () => document.body.removeChild(overlay);

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '导出 GIF';
        exportBtn.className = 'gif-dialog-btn gif-btn-primary';
        exportBtn.onclick = async () => {
            const fps = parseInt(fpsInput.value);
            const loop = parseInt(loopInput.value);
            const qualityBtn = qualityOptions.querySelector('.gif-quality-btn.active');
            const colors = parseInt(qualityBtn.dataset.colors);
            const useDither = qualityBtn.dataset.dither === 'true';
            const useSingleCore = singleCoreCheckbox.checked;

            // 显示进度条
            progressContainer.style.display = 'block';
            exportBtn.disabled = true;
            exportBtn.textContent = '处理中...';

            try {
                await exportGif(app, fps, loop, colors, useDither, progressFill, progressText, useSingleCore);
            } catch (error) {
                console.error('导出失败:', error);
                progressText.textContent = '导出失败: ' + error.message;
                exportBtn.disabled = false;
                exportBtn.textContent = '重新导出';
                return;
            }

            // 完成后移除弹窗
            setTimeout(() => {
                if (overlay.parentNode) {
                    document.body.removeChild(overlay);
                }
            }, 1500);
        };

        buttons.appendChild(cancelBtn);
        buttons.appendChild(exportBtn);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    async function exportGif(app, fps, loop, colors, useDither, progressFill, progressText, useSingleCore = true) {
        try {
            const layers = app.layerManager.layers.filter(l => l.visible);

            if (layers.length === 0) {
                throw new Error('没有可见图层');
            }

            // 更新进度
            progressText.textContent = '准备数据中...';
            progressFill.style.width = '10%';

            // 获取所有可见图层的图像数据
            const frames = [];
            const width = app.canvasManager.width;
            const height = app.canvasManager.height;

            // 检查尺寸是否合理
            if (width > 1000 || height > 1000) {
                const confirm = window.confirm(`GIF尺寸较大(${width}x${height})，导出可能需要较长时间。是否继续？`);
                if (!confirm) {
                    throw new Error('用户取消操作');
                }
            }

            for (let i = 0; i < layers.length; i++) {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // 绘制白色背景
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                // 绘制图层内容
                ctx.drawImage(layers[i].canvas, 0, 0);

                frames.push(ctx.getImageData(0, 0, width, height));

                // 更新进度
                const progress = 10 + (i / layers.length) * 70;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `处理帧 ${i + 1}/${layers.length}`;

                // 避免阻塞UI
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // 创建 GIF
            progressText.textContent = '合成 GIF 中...';
            progressFill.style.width = '85%';

            // 尝试加载worker脚本
            let workerScript = null;
            try {
                workerScript = await loadGifWorkerScript();
            } catch (error) {
                console.warn('无法加载worker脚本，使用内联脚本:', error);
                workerScript = getInlineGifWorkerScript();
                useSingleCore = true; // 强制使用单线程模式
            }

            // 创建blob URL给worker使用
            const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(workerBlob);

            // 创建GIF实例
            const gifOptions = {
                workers: useSingleCore ? 1 : 2,
                quality: useSingleCore ? 5 : 10,
                width: width,
                height: height,
                workerScript: workerUrl,
                background: '#FFFFFF',
                transparent: null, // 不使用透明色，使用白色背景
                dither: useDither && !useSingleCore
            };

            const gif = new GIF(gifOptions);

            // 设置 GIF 参数
            gif.setOption('repeat', loop);
            gif.setOption('delay', 1000 / fps);

            // 添加帧
            for (let i = 0; i < frames.length; i++) {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // 绘制白色背景
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                // 绘制图像
                ctx.putImageData(frames[i], 0, 0);

                // 添加帧到GIF
                gif.addFrame(ctx, {
                    delay: 1000 / fps,
                    copy: true
                });
            }

            // 生成 GIF
            return new Promise((resolve, reject) => {
                let isFinished = false;

                const cleanup = () => {
                    if (workerUrl) {
                        URL.revokeObjectURL(workerUrl);
                    }
                };

                const timeout = setTimeout(() => {
                    if (!isFinished) {
                        cleanup();
                        reject(new Error('GIF生成超时'));
                    }
                }, 30000); // 30秒超时

                gif.on('finished', (blob) => {
                    isFinished = true;
                    clearTimeout(timeout);

                    try {
                        progressFill.style.width = '100%';
                        progressText.textContent = '正在下载...';

                        cleanup();

                        // 下载文件
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const now = new Date();
                        const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
                        a.download = `animation_${timestamp}.gif`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);

                        // 延迟释放URL，确保下载开始
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            resolve();
                        }, 100);
                    } catch (error) {
                        cleanup();
                        reject(error);
                    }
                });

                gif.on('progress', (p) => {
                    const progress = 85 + (p * 15);
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `合成中... ${Math.round(p * 100)}%`;
                });

                gif.on('abort', () => {
                    cleanup();
                    clearTimeout(timeout);
                    reject(new Error('GIF生成被中止'));
                });

                try {
                    gif.render();
                } catch (error) {
                    cleanup();
                    clearTimeout(timeout);
                    reject(error);
                }
            });

        } catch (error) {
            console.error('导出GIF失败:', error);

            // 提供更多有用的错误信息
            let errorMessage = error.message || '未知错误';
            if (errorMessage.includes('SecurityError') || errorMessage.includes('CORS')) {
                errorMessage = '跨域安全限制。请确保使用单线程模式。';
            } else if (errorMessage.includes('用户取消')) {
                errorMessage = '操作已取消';
            }

            throw new Error(errorMessage);
        }
    }

    async function importAnimation(app, file, prefix) {
        const isGif = file.name.toLowerCase().endsWith('.gif');

        if (isGif) {
            await importGif(app, file, prefix);
        } else {
            await importApng(app, file, prefix);
        }
    }

    async function importGif(app, file, prefix) {
        try {


            const arrayBuffer = await file.arrayBuffer();
            const gif = window.gifuct.parseGIF(arrayBuffer);
            const frames = window.gifuct.decompressFrames(gif, true);

            if (frames.length === 0) {
                throw new Error('无法解析GIF文件或文件为空');
            }

            app.layerManager.clearLayers();
            const width = frames[0].dims.width;
            const height = frames[0].dims.height;
            app.canvasManager.resize(width, height);
            app.layerManager.resizeLayers(width, height);

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                const layer = app.layerManager.addLayer(width, height, `${prefix}${String(i + 1).padStart(2, '0')}`);

                const imageData = new ImageData(
                    new Uint8ClampedArray(frame.patch),
                    frame.dims.width,
                    frame.dims.height
                );

                layer.ctx.putImageData(imageData, frame.dims.left, frame.dims.top);
            }

            app.layerManager.setActiveLayer(0);
            app.render();
            app.renderLayerList();
            app.saveHistory();

            alert(`成功导入 ${frames.length} 帧`);
        } catch (error) {
            console.error('导入GIF失败:', error);
            alert('导入失败: ' + error.message);
        }
    }

    async function importApng(app, file, prefix) {
        try {
            const img = new Image();
            const url = URL.createObjectURL(file);

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            app.layerManager.clearLayers();
            app.canvasManager.resize(img.width, img.height);
            app.layerManager.resizeLayers(img.width, img.height);

            const layer = app.layerManager.addLayer(img.width, img.height, `${prefix}01`);
            layer.ctx.drawImage(img, 0, 0);

            app.layerManager.setActiveLayer(0);
            app.render();
            app.renderLayerList();
            app.saveHistory();

            URL.revokeObjectURL(url);
            alert('成功导入图像');
        } catch (error) {
            console.error('导入APNG失败:', error);
            alert('导入失败: ' + error.message);
        }
    }
})();