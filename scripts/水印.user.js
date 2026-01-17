// ==UserScript==
// @name         PhotoShop - 水印滤镜 Pro (Watermark)
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  为XPhotoShop添加“滤镜 > 水印”功能，支持文字/图片平铺，支持智能排版与预览
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 注入样式
    const style = document.createElement('style');
    style.textContent = `
        .ps-wm-dialog {
            background: #3a3a3a; border: 1px solid #555; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            width: 380px; display: flex; flex-direction: column; border-radius: 2px;
            font-family: "Segoe UI", sans-serif; font-size: 13px; color: #dcdcdc;
            user-select: none;
        }
        .ps-wm-header {
            background: #2a2a2a; padding: 10px 15px; font-weight: 600; border-bottom: 1px solid #222;
        }
        .ps-wm-tabs {
            display: flex; background: #222; border-bottom: 1px solid #444;
        }
        .ps-wm-tab {
            flex: 1; text-align: center; padding: 10px; cursor: pointer; color: #888; transition: 0.2s;
        }
        .ps-wm-tab.active {
            color: #eee; background: #3a3a3a; border-top: 2px solid #3498db;
        }
        .ps-wm-body { padding: 20px; max-height: 500px; overflow-y: auto; }
        
        .ps-form-row { margin-bottom: 12px; display: flex; align-items: center; }
        .ps-form-row label { width: 70px; color: #aaa; }
        .ps-form-row input[type="text"], 
        .ps-form-row input[type="number"], 
        .ps-form-row select {
            flex: 1; background: #222; border: 1px solid #555; color: #eee; padding: 5px; outline: none;
        }
        .ps-form-row input[type="range"] { flex: 1; cursor: pointer; }
        .ps-range-val { width: 45px; text-align: right; margin-left: 8px; color: #888; font-size: 12px; }
        
        /* 分隔线 */
        .ps-divider { border: 0; border-top: 1px solid #444; margin: 15px 0; }
        .ps-section-title { font-weight: bold; color: #888; margin-bottom: 10px; display: block; }

        /* 自定义文件上传样式 */
        .ps-file-upload {
            display: inline-block; padding: 8px 12px; cursor: pointer;
            background: #444; border: 1px solid #555; border-radius: 3px;
            width: 100%; text-align: center; transition: 0.2s; box-sizing: border-box;
        }
        .ps-file-upload:hover { background: #505050; }
        input[type="file"] { display: none; }
        
        /* 图片预览区域 */
        .ps-img-preview-box {
            margin-top: 10px; background: #222; border: 1px dashed #555; 
            padding: 10px; text-align: center; min-height: 60px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        #wm-preview-img { max-width: 100%; max-height: 120px; object-fit: contain; display: none; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        #wm-file-name { margin-top: 5px; color: #888; font-size: 12px; word-break: break-all; }

        .ps-wm-footer {
            display: flex; justify-content: flex-end; padding: 12px; gap: 10px;
            border-top: 1px solid #444; background: #333;
        }
        .ps-btn {
            background: #555; border: 1px solid #222; color: #eee; padding: 5px 16px; 
            cursor: pointer; border-radius: 2px;
        }
        .ps-btn:hover { background: #666; }
        .ps-btn.primary { background: #1f65a3; border-color: #103f69; }
        .ps-btn.primary:hover { background: #267ac1; }
    `;
    document.head.appendChild(style);

    // 等待应用加载
    const waitForApp = setInterval(() => {
        if (window.photoShopApp) {
            clearInterval(waitForApp);
            initWatermarkPlugin(window.photoShopApp);
        }
    }, 500);

    function initWatermarkPlugin(app) {
        // 直接添加菜单项，不再检测菜单是否存在
        app.menuManager.addMenuItem('滤镜', {
            label: '水印 (Watermark)...',
            action: 'filter-watermark',
            handler: () => showWatermarkDialog(app),
            divider: true
        });
    }

    function showWatermarkDialog(app) {
        if (!app.layerManager.activeItem || app.layerManager.activeItem.isGroup) {
            Toast.show('请先选择一个普通图层', 'warning');
            return;
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
        `;

        overlay.innerHTML = `
            <div class="ps-wm-dialog">
                <div class="ps-wm-header">添加水印</div>
                <div class="ps-wm-tabs">
                    <div class="ps-wm-tab active" data-mode="text">文字水印</div>
                    <div class="ps-wm-tab" data-mode="image">图片水印</div>
                </div>
                <div class="ps-wm-body">
                    <!-- 文字设置面板 -->
                    <div id="panel-text">
                        <div class="ps-form-row">
                            <label>内容:</label>
                            <input type="text" id="wm-text" value="CONFIDENTIAL">
                        </div>
                        <div class="ps-form-row">
                            <label>字体:</label>
                            <select id="wm-font">
                                <option value="Arial">Arial</option>
                                <option value="Microsoft YaHei">微软雅黑</option>
                                <option value="SimHei">黑体</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                            </select>
                        </div>
                        <div class="ps-form-row">
                            <label>字号:</label>
                            <input type="number" id="wm-size" value="24" min="8" max="200">
                        </div>
                        <div class="ps-form-row">
                            <label>颜色:</label>
                            <input type="color" id="wm-color" value="#808080" style="height:30px; cursor:pointer;">
                        </div>
                        <div class="ps-form-row">
                            <label>角度:</label>
                            <input type="range" id="wm-angle" min="-180" max="180" value="-45">
                            <span class="ps-range-val" id="val-angle">-45°</span>
                        </div>
                    </div>

                    <!-- 图片设置面板 -->
                    <div id="panel-image" style="display:none;">
                        <div class="ps-form-row" style="display:block;">
                            <label for="wm-file-input" class="ps-file-upload">
                                <i style="margin-right:5px">🖼️</i> 选择图片文件...
                            </label>
                            <input type="file" id="wm-file-input" accept="image/*">
                            
                            <div class="ps-img-preview-box">
                                <img id="wm-preview-img" alt="预览">
                                <span id="wm-file-name">未选择文件</span>
                            </div>
                        </div>
                        <div class="ps-form-row">
                            <label>缩放:</label>
                            <input type="range" id="wm-scale" min="10" max="200" value="100">
                            <span class="ps-range-val" id="val-scale">100%</span>
                        </div>
                        <div class="ps-form-row">
                            <label>角度:</label>
                            <input type="range" id="wm-img-angle" min="-180" max="180" value="-45">
                            <span class="ps-range-val" id="val-img-angle">-45°</span>
                        </div>
                    </div>

                    <!-- 通用设置 / 密度设置 -->
                    <hr class="ps-divider">
                    <span class="ps-section-title">排版与混合</span>
                    
                    <div class="ps-form-row">
                        <label>横向间距:</label>
                        <input type="range" id="wm-gap-x" min="0.1" max="5.0" step="0.1" value="0.5">
                        <span class="ps-range-val" id="val-gap-x">0.5x</span>
                    </div>
                    <div class="ps-form-row">
                        <label>纵向间距:</label>
                        <input type="range" id="wm-gap-y" min="0.1" max="5.0" step="0.1" value="0.5">
                        <span class="ps-range-val" id="val-gap-y">0.5x</span>
                    </div>
                    <div class="ps-form-row">
                        <label>不透明度:</label>
                        <input type="range" id="wm-opacity" min="0" max="100" value="30">
                        <span class="ps-range-val" id="val-opacity">30%</span>
                    </div>
                </div>
                <div class="ps-wm-footer">
                    <button class="ps-btn" id="btn-cancel">取消</button>
                    <button class="ps-btn primary" id="btn-apply">应用</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // --- 逻辑处理 ---
        let currentMode = 'text';
        let selectedImage = null;

        // Tab 切换
        const tabs = overlay.querySelectorAll('.ps-wm-tab');
        const panelText = overlay.querySelector('#panel-text');
        const panelImage = overlay.querySelector('#panel-image');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentMode = tab.dataset.mode;
                if (currentMode === 'text') {
                    panelText.style.display = 'block';
                    panelImage.style.display = 'none';
                } else {
                    panelText.style.display = 'none';
                    panelImage.style.display = 'block';
                }
            });
        });

        // 滑块数值绑定
        const bindRange = (id, unit = '') => {
            const range = overlay.querySelector(`#wm-${id}`);
            const val = overlay.querySelector(`#val-${id}`);
            range.addEventListener('input', () => val.textContent = range.value + unit);
        };
        bindRange('angle', '°');
        bindRange('img-angle', '°');
        bindRange('opacity', '%');
        bindRange('scale', '%');
        bindRange('gap-x', 'x');
        bindRange('gap-y', 'x');

        // 图片文件处理 (预览 + 记录)
        const fileInput = overlay.querySelector('#wm-file-input');
        const fileNameDisplay = overlay.querySelector('#wm-file-name');
        const previewImg = overlay.querySelector('#wm-preview-img');
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    previewImg.src = evt.target.result;
                    previewImg.style.display = 'block'; // 显示缩略图
                    
                    const img = new Image();
                    img.onload = () => { selectedImage = img; };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // 按钮事件
        overlay.querySelector('#btn-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        overlay.querySelector('#btn-apply').addEventListener('click', () => {
            const options = {
                mode: currentMode,
                opacity: parseInt(overlay.querySelector('#wm-opacity').value) / 100,
                gapX: parseFloat(overlay.querySelector('#wm-gap-x').value),
                gapY: parseFloat(overlay.querySelector('#wm-gap-y').value)
            };

            if (currentMode === 'text') {
                options.text = overlay.querySelector('#wm-text').value;
                options.fontFamily = overlay.querySelector('#wm-font').value;
                options.fontSize = parseInt(overlay.querySelector('#wm-size').value);
                options.color = overlay.querySelector('#wm-color').value;
                options.angle = parseInt(overlay.querySelector('#wm-angle').value);
            } else {
                if (!selectedImage) {
                    Toast.show('请先选择图片', 'warning');
                    return;
                }
                options.image = selectedImage;
                options.scale = parseInt(overlay.querySelector('#wm-scale').value) / 100;
                options.angle = parseInt(overlay.querySelector('#wm-img-angle').value);
            }

            applyWatermark(app, options);
            document.body.removeChild(overlay);
        });
    }

    function applyWatermark(app, options) {
        const layer = app.layerManager.getActiveLayer();
        const ctx = layer.ctx;
        const width = layer.canvas.width;
        const height = layer.canvas.height;

        ctx.save();
        ctx.globalAlpha = options.opacity;

        // --- 1. 计算单元格基础尺寸 ---
        let contentWidth, contentHeight;
        
        if (options.mode === 'text') {
            ctx.font = `${options.fontSize}px "${options.fontFamily}"`;
            const metrics = ctx.measureText(options.text);
            
            // 智能检测：使用 measureText 获取精确宽度
            contentWidth = metrics.width;
            // 智能检测：使用字号作为基础高度 (Canvas获取精确文字高度较复杂，字号是很好的近似)
            contentHeight = options.fontSize;
        } else {
            contentWidth = options.image.width * options.scale;
            contentHeight = options.image.height * options.scale;
        }

        // --- 2. 计算网格步长 (基础尺寸 + 间距) ---
        // 间距是基于内容尺寸的倍数 (gapX * contentWidth)
        const stepX = contentWidth + (contentWidth * options.gapX);
        const stepY = contentHeight + (contentHeight * options.gapY);

        // 防止死循环
        if (stepX < 1) return; 
        if (stepY < 1) return;

        // --- 3. 平铺绘制 ---
        // 为了覆盖旋转后的空白，向四周扩展绘制范围
        // 计算对角线长度作为最大旋转半径
        const diag = Math.sqrt(contentWidth*contentWidth + contentHeight*contentHeight);
        const margin = diag * 1.5; 

        for (let y = -margin; y < height + margin; y += stepY) {
            // 错位排列 (Brick layout): 偶数行偏移半个步长
            const offsetX = (Math.floor(y / stepY) % 2 === 0) ? 0 : stepX / 2;
            
            for (let x = -margin; x < width + margin; x += stepX) {
                const drawX = x + offsetX;
                const drawY = y;

                ctx.save();
                // 移动到单元格中心
                ctx.translate(drawX + contentWidth/2, drawY + contentHeight/2); 
                
                // 旋转
                ctx.rotate(options.angle * Math.PI / 180);

                if (options.mode === 'text') {
                    ctx.fillStyle = options.color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = `${options.fontSize}px "${options.fontFamily}"`;
                    ctx.fillText(options.text, 0, 0);
                } else {
                    // 绘制图片 (居中)
                    ctx.drawImage(
                        options.image, 
                        -contentWidth/2, 
                        -contentHeight/2, 
                        contentWidth, 
                        contentHeight
                    );
                }

                ctx.restore();
            }
        }

        ctx.restore();
        
        app.render();
        app.saveHistory();
        Toast.show('水印添加成功', 'success');
    }

})();