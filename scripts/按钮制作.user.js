// ==UserScript==
// @name         PhotoShop - 安卓9-Patch按钮生成器 Ultimate (Auto)
// @namespace    http://tampermonkey.net/
// @version      2.3.0
// @description  XPhotoShop插件：支持阴影、焦点色、覆盖色、优化9-Patch区域
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === CSS 样式 ===
    const style = document.createElement('style');
    style.textContent = `
        .ps-dialog-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: "Segoe UI", sans-serif; font-size: 13px; color: #dcdcdc;
            user-select: none;
        }
        .ps-9path-dialog {
            background: #3a3a3a; border: 1px solid #555; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            width: 900px; height: 600px; display: flex; flex-direction: column; border-radius: 4px;
        }
        .ps-dialog-header {
            background: #2a2a2a; padding: 10px 15px; font-weight: 600; border-bottom: 1px solid #222;
            display: flex; justify-content: space-between; align-items: center;
        }
        .ps-dialog-content { display: flex; flex: 1; overflow: hidden; }
        
        /* 左侧控制面板 */
        .ps-panel-left {
            width: 320px; background: #333; border-right: 1px solid #444; padding: 15px;
            display: flex; flex-direction: column; gap: 8px; overflow-y: auto;
        }
        
        .ps-control-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
        .ps-control-group label { color: #aaa; font-size: 12px; display: flex; justify-content: space-between; }
        .ps-control-group select, .ps-control-group input[type="number"], .ps-control-group input[type="text"] {
            background: #222; border: 1px solid #555; color: #eee; padding: 5px; outline: none; border-radius: 2px;
        }
        
        .ps-color-row { display: flex; align-items: center; gap: 10px; }
        input[type="color"].ps-color-input {
            width: 100% !important; height: 28px !important; border: 1px solid #555 !important;
            padding: 2px !important; background: #222 !important; cursor: pointer;
            border-radius: 2px; outline: none;min-height:28px;
        }
        input[type="color"].ps-color-input::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"].ps-color-input::-webkit-color-swatch { border: none; border-radius: 1px; }
        input[type="color"].ps-color-input::-moz-color-swatch { border: none; border-radius: 1px; }
        
        .ps-slider-row { display: flex; align-items: center; gap: 10px; }
        .ps-slider-row input[type="range"] { flex: 1; }
        .ps-slider-val { width: 30px; text-align: right; color: #3498db; font-weight: bold; font-size: 12px; }

        .ps-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #eee; font-weight: bold; }
        .ps-checkbox-label input { margin: 0; width: 16px; height: 16px; }

        .ps-section-title { 
            font-weight: bold; color: #fff; margin-top: 8px; font-size: 12px; 
            border-left: 3px solid #3498db; padding-left: 6px; background: rgba(255,255,255,0.05); padding: 4px 6px;
        }

        /* 右侧预览面板 */
        .ps-panel-right {
            flex: 1; background: #222; display: flex; flex-direction: column;
            position: relative; overflow: hidden;
        }
        .ps-preview-toolbar {
            padding: 8px; background: #2a2a2a; border-bottom: 1px solid #444;
            display: flex; justify-content: center; color: #999; font-size: 11px; text-align: center;
        }
        .ps-canvas-container {
            flex: 1; display: flex; justify-content: center; align-items: center; overflow: auto;
            background-image: linear-gradient(45deg, #252525 25%, transparent 25%), 
                              linear-gradient(-45deg, #252525 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #252525 75%), 
                              linear-gradient(-45deg, transparent 75%, #252525 75%);
            background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
            padding: 20px;
        }
        canvas.preview-canvas {
            box-shadow: 0 0 20px rgba(0,0,0,0.5); 
            image-rendering: pixelated; 
        }

        .ps-dialog-footer {
            padding: 12px 15px; background: #2a2a2a; border-top: 1px solid #222;
            display: flex; justify-content: flex-end; gap: 10px;
        }
        .ps-btn {
            background: #555; border: 1px solid #222; color: #eee; padding: 6px 20px; 
            cursor: pointer; border-radius: 2px;
        }
        .ps-btn:hover { background: #666; }
        .ps-btn.primary { background: #27ae60; border-color: #1e8449; }
        .ps-btn.primary:hover { background: #2ecc71; }
        
        .ps-info-text { font-size: 11px; color: #777; margin-top: 5px; line-height: 1.4; }
    `;
    document.head.appendChild(style);

    // === 初始化 ===
    const waitForApp = setInterval(() => {
        if (window.photoShopApp) {
            clearInterval(waitForApp);
            init9PatchPlugin(window.photoShopApp);
        }
    }, 500);

    function init9PatchPlugin(app) {
        app.menuManager.addMenuItem('滤镜', {
            label: '安卓按钮生成器 Ultimate (Auto)...',
            action: 'tool-9patch-auto',
            handler: () => show9PatchDialog(app),
            position: 'bottom',
            divider: true
        });
    }

    // === 主逻辑 ===
    function show9PatchDialog(app) {
        const activeLayer = app.layerManager.getActiveLayer();
        if (!activeLayer) {
            Toast.show('请先选择一个图层以确定尺寸', 'warning');
            return;
        }

        // 默认参数
        const state = {
            // 基础尺寸 (图层尺寸)
            layerW: activeLayer.canvas.width,
            layerH: activeLayer.canvas.height,
            is9Patch: true,

            // 布局边距 (Margin)
            marginX: 2,
            marginY: 2,

            // 样式
            styleType: 'flat',
            shapeType: 'rounded',
            radius: 8,

            // 颜色
            colorStart: '#3498db',
            colorEnd: '#2980b9',
            colorMid: '#2c8fc7', // 水晶/金属中间色

            // 描边
            borderWidth: 2,
            borderColor: '#1a5276',

            // 状态相关颜色
            btnState: 'normal',
            focusColor: '#f39c12',
            pressOverlay: 'dark', // 'dark' or 'light'
            pressOverlayColor: '#000000',

            // 阴影
            shadowEnabled: false,
            shadowOffsetX: 2,
            shadowOffsetY: 2,
            shadowBlur: 4,
            shadowColor: '#000000'
        };

        // 构建 UI
        const overlay = document.createElement('div');
        overlay.className = 'ps-dialog-overlay';
        overlay.innerHTML = `
            <div class="ps-9path-dialog">
                <div class="ps-dialog-header">
                    <span>Android 9-Patch 按钮生成器 (自动计算版)</span>
                    <span style="font-size:11px; color:#aaa;">图层尺寸: ${state.layerW} x ${state.layerH}</span>
                </div>
                <div class="ps-dialog-content">
                    <!-- 左侧控制 -->
                    <div class="ps-panel-left">
                        
                        <!-- 布局设置 -->
                        <div class="ps-section-title">布局与边距 (Layout)</div>
                        <div class="ps-control-group">
                            <div>画布边距 X (Margin X)</div>
                            <div class="ps-slider-row">
                                <input type="range" id="sl-margin-x" min="0" max="50" value="${state.marginX}">
                                <span class="ps-slider-val" id="val-margin-x">${state.marginX}</span>
                            </div>
                        </div>
                        <div class="ps-control-group">
                            <div>画布边距 Y (Margin Y)</div>
                            <div class="ps-slider-row">
                                <input type="range" id="sl-margin-y" min="0" max="50" value="${state.marginY}">
                                <span class="ps-slider-val" id="val-margin-y">${state.marginY}</span>
                            </div>
                        </div>

                        <!-- 样式选择 -->
                        <div class="ps-section-title">外观风格</div>
                        <div class="ps-control-group">
                            <div>材质风格</div>
                            <select id="style-type">
                                <option value="flat">扁平 (Flat)</option>
                                <option value="gradient">渐变 (Gradient)</option>
                                <option value="crystal">水晶 (Crystal)</option>
                                <option value="metal">金属 (Metal)</option>
                            </select>
                        </div>
                        <div class="ps-control-group">
                            <div>形状</div>
                            <select id="shape-type">
                                <option value="rounded">圆角矩形</option>
                                <option value="capsule">胶囊形</option>
                                <option value="rect">直角矩形</option>
                            </select>
                        </div>

                        <!-- 颜色设置 -->
                        <div class="ps-section-title">色彩与状态</div>
                        <div class="ps-control-group">
                            <div>按钮状态 (State)</div>
                            <select id="btn-state">
                                <option value="normal">正常 (Normal)</option>
                                <option value="pressed">按下 (Pressed)</option>
                                <option value="focused">聚焦 (Focused)</option>
                            </select>
                        </div>

                        <div class="ps-control-group">
                            <div>主色调 (Start / End)</div>
                            <div class="ps-color-row">
                                <input type="color" id="col-start" value="${state.colorStart}" class="ps-color-input" title="起始颜色">
                                <input type="color" id="col-end" value="${state.colorEnd}" class="ps-color-input" title="结束颜色">
                            </div>
                        </div>

                        <div class="ps-control-group" id="grp-col-mid">
                            <div>中间色 (水晶/金属)</div>
                            <input type="color" id="col-mid" value="${state.colorMid}" class="ps-color-input">
                        </div>

                        <div class="ps-control-group" id="grp-focus-col">
                            <div>聚焦颜色</div>
                            <input type="color" id="col-focus" value="${state.focusColor}" class="ps-color-input">
                        </div>

                        <div class="ps-control-group" id="grp-press-overlay">
                            <div>按下覆盖</div>
                            <select id="press-overlay">
                                <option value="dark">暗色</option>
                                <option value="light">亮色</option>
                                <option value="custom">自定义</option>
                            </select>
                        </div>

                        <div class="ps-control-group" id="grp-press-col">
                            <div>覆盖颜色</div>
                            <input type="color" id="col-press" value="${state.pressOverlayColor}" class="ps-color-input">
                        </div>

                        <!-- 描边与圆角 -->
                        <div class="ps-section-title">轮廓设置</div>
                        <div class="ps-control-group">
                            <div>描边宽度 (Border)</div>
                            <div class="ps-slider-row">
                                <input type="range" id="sl-border-w" min="0" max="10" value="${state.borderWidth}">
                                <span class="ps-slider-val" id="val-border-w">${state.borderWidth}</span>
                            </div>
                        </div>
                        <div class="ps-control-group" id="grp-border-col">
                            <div>描边颜色</div>
                            <input type="color" id="col-border" value="${state.borderColor}" class="ps-color-input">
                        </div>
                        <div class="ps-control-group" id="grp-radius">
                            <div>圆角半径 (Radius)</div>
                            <div class="ps-slider-row">
                                <input type="range" id="sl-radius" min="0" max="50" value="${state.radius}">
                                <span class="ps-slider-val" id="val-radius">${state.radius}</span>
                            </div>
                        </div>

                        <!-- 阴影设置 -->
                        <div class="ps-section-title">阴影效果</div>
                        <div class="ps-checkbox-div" style="margin:5px 0;">
                            <input type="checkbox" id="chk-shadow"> 启用阴影
                        </div>
                        <div id="grp-shadow-settings">
                            <div class="ps-control-group">
                                <div>偏移 X</div>
                                <div class="ps-slider-row">
                                    <input type="range" id="sl-shadow-x" min="-10" max="10" value="${state.shadowOffsetX}">
                                    <span class="ps-slider-val" id="val-shadow-x">${state.shadowOffsetX}</span>
                                </div>
                            </div>
                            <div class="ps-control-group">
                                <div>偏移 Y</div>
                                <div class="ps-slider-row">
                                    <input type="range" id="sl-shadow-y" min="-10" max="10" value="${state.shadowOffsetY}">
                                    <span class="ps-slider-val" id="val-shadow-y">${state.shadowOffsetY}</span>
                                </div>
                            </div>
                            <div class="ps-control-group">
                                <div>模糊半径</div>
                                <div class="ps-slider-row">
                                    <input type="range" id="sl-shadow-blur" min="0" max="20" value="${state.shadowBlur}">
                                    <span class="ps-slider-val" id="val-shadow-blur">${state.shadowBlur}</span>
                                </div>
                            </div>
                            <div class="ps-control-group">
                                <div>阴影颜色</div>
                                <input type="color" id="col-shadow" value="${state.shadowColor}" class="ps-color-input">
                            </div>
                            <div class="ps-control-group">
                                <div>阴影透明度</div>
                                <div class="ps-slider-row">
                                    <input type="range" id="sl-shadow-opacity" min="0" max="100" value="${state.shadowOpacity}">
                                    <span class="ps-slider-val" id="val-shadow-opacity">${state.shadowOpacity}</span>%
                                </div>
                            </div>
                        </div>

                        <!-- 9-Patch -->
                        <div class="ps-section-title">9-Patch 标记</div>
                        <div class="ps-checkbox-div" style="margin:5px 0;">
                            <input type="checkbox" id="chk-9patch" checked> 生成 .9.png 格式
                        </div>
                        <div class="ps-info-text">
                            拉伸区域与内容区域将根据圆角和描边自动计算，无需手动设置。
                        </div>
                    </div>

                    <!-- 右侧预览 -->
                    <div class="ps-panel-right">
                        <div class="ps-preview-toolbar">
                            预览已放大 300% • 黑色边线: 9-Patch 标记 • 透明区: 画布边距
                        </div>
                        <div class="ps-canvas-container">
                            <canvas id="preview-canvas" class="preview-canvas"></canvas>
                        </div>
                    </div>
                </div>
                <div class="ps-dialog-footer">
                    <button class="ps-btn" id="btn-cancel">取消</button>
                    <button class="ps-btn primary" id="btn-ok">生成当前状态</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 绑定元素
        const canvas = overlay.querySelector('#preview-canvas');
        const ctx = canvas.getContext('2d');

        const inputs = {
            marginX: overlay.querySelector('#sl-margin-x'),
            marginY: overlay.querySelector('#sl-margin-y'),
            styleType: overlay.querySelector('#style-type'),
            shapeType: overlay.querySelector('#shape-type'),
            btnState: overlay.querySelector('#btn-state'),
            colStart: overlay.querySelector('#col-start'),
            colEnd: overlay.querySelector('#col-end'),
            colMid: overlay.querySelector('#col-mid'),
            colBorder: overlay.querySelector('#col-border'),
            colFocus: overlay.querySelector('#col-focus'),
            pressOverlay: overlay.querySelector('#press-overlay'),
            colPress: overlay.querySelector('#col-press'),
            borderW: overlay.querySelector('#sl-border-w'),
            radius: overlay.querySelector('#sl-radius'),
            is9Patch: overlay.querySelector('#chk-9patch'),
            shadowEnabled: overlay.querySelector('#chk-shadow'),
            shadowX: overlay.querySelector('#sl-shadow-x'),
            shadowY: overlay.querySelector('#sl-shadow-y'),
            shadowBlur: overlay.querySelector('#sl-shadow-blur'),
            shadowOpacity: overlay.querySelector('#sl-shadow-opacity'),
            colShadow: overlay.querySelector('#col-shadow'),

            // UI Groups
            grpRadius: overlay.querySelector('#grp-radius'),
            grpBorderCol: overlay.querySelector('#grp-border-col'),
            grpColMid: overlay.querySelector('#grp-col-mid'),
            grpFocusCol: overlay.querySelector('#grp-focus-col'),
            grpPressOverlay: overlay.querySelector('#grp-press-overlay'),
            grpPressCol: overlay.querySelector('#grp-press-col'),
            grpShadowSettings: overlay.querySelector('#grp-shadow-settings'),

            // Value Displays
            valMarginX: overlay.querySelector('#val-margin-x'),
            valMarginY: overlay.querySelector('#val-margin-y'),
            valBorderW: overlay.querySelector('#val-border-w'),
            valRadius: overlay.querySelector('#val-radius'),
            valShadowX: overlay.querySelector('#val-shadow-x'),
            valShadowY: overlay.querySelector('#val-shadow-y'),
            valShadowBlur: overlay.querySelector('#val-shadow-blur'),
            valShadowOpacity: overlay.querySelector('#val-shadow-opacity')
        };

        // === 绘制逻辑 ===
        const draw = () => {
            const w = state.layerW;
            const h = state.layerH;

            canvas.width = w;
            canvas.height = h;

            // 预览放大
            const zoom = 3;
            canvas.style.width = (w * zoom) + 'px';
            canvas.style.height = (h * zoom) + 'px';

            ctx.clearRect(0, 0, w, h);

            // === 1. 计算阴影占用空间 ===
            let shadowSpaceX = 0, shadowSpaceY = 0;
            if (state.shadowEnabled) {
                shadowSpaceX = Math.abs(state.shadowOffsetX) + state.shadowBlur;
                shadowSpaceY = Math.abs(state.shadowOffsetY) + state.shadowBlur;
            }

            // === 2. 计算按钮实际绘制区域 ===
            // 9-Patch 模式下，至少保留 1px 边距用于绘制黑线
            const effectiveMarginX = state.is9Patch ? Math.max(1, state.marginX) : state.marginX;
            const effectiveMarginY = state.is9Patch ? Math.max(1, state.marginY) : state.marginY;

            // 考虑阴影空间
            const btnX = effectiveMarginX + (state.shadowOffsetX < 0 ? shadowSpaceX : 0);
            const btnY = effectiveMarginY + (state.shadowOffsetY < 0 ? shadowSpaceY : 0);
            const btnW = w - (effectiveMarginX * 2) - shadowSpaceX;
            const btnH = h - (effectiveMarginY * 2) - shadowSpaceY;

            if (btnW <= 0 || btnH <= 0) return;

            // === 2. 计算路径 ===
            const bw = state.borderWidth;
            const inset = bw / 2; 
            
            const dx = btnX + inset;
            const dy = btnY + inset;
            const dw = btnW - bw;
            const dh = btnH - bw;

            // 计算圆角
            let r = state.radius;
            if (state.shapeType === 'capsule') r = Math.min(btnW, btnH) / 2;
            if (state.shapeType === 'rect') r = 0;
            // 修正圆角
            const drawR = Math.max(0, r - inset);

            // === 3. 首先绘制阴影（在底部）===
            if (state.shadowEnabled) {
                ctx.save();
                // 为阴影创建一个新的路径，稍微扩大一些以获得更好的效果
                const shadowPath = new Path2D();
                const shadowInset = 0; // 阴影不需要描边偏移
                const shadowDx = btnX;
                const shadowDy = btnY;
                const shadowDw = btnW;
                const shadowDh = btnH;
                const shadowR = Math.max(0, r);
                
                if (state.shapeType === 'rect' || shadowR <= 0) {
                    shadowPath.rect(shadowDx, shadowDy, shadowDw, shadowDh);
                } else {
                    shadowPath.moveTo(shadowDx + shadowR, shadowDy);
                    shadowPath.lineTo(shadowDx + shadowDw - shadowR, shadowDy);
                    shadowPath.quadraticCurveTo(shadowDx + shadowDw, shadowDy, shadowDx + shadowDw, shadowDy + shadowR);
                    shadowPath.lineTo(shadowDx + shadowDw, shadowDy + shadowDh - shadowR);
                    shadowPath.quadraticCurveTo(shadowDx + shadowDw, shadowDy + shadowDh, shadowDx + shadowDw - shadowR, shadowDy + shadowDh);
                    shadowPath.lineTo(shadowDx + shadowR, shadowDy + shadowDh);
                    shadowPath.quadraticCurveTo(shadowDx, shadowDy + shadowDh, shadowDx, shadowDy + shadowDh - shadowR);
                    shadowPath.lineTo(shadowDx, shadowDy + shadowR);
                    shadowPath.quadraticCurveTo(shadowDx, shadowDy, shadowDx + shadowR, shadowDy);
                }
                shadowPath.closePath();
                
                // 将透明度应用到阴影颜色
                const shadowColorWithAlpha = hexToRgba(state.shadowColor, state.shadowOpacity / 100);
                
                // 设置阴影效果
                ctx.shadowOffsetX = state.shadowOffsetX;
                ctx.shadowOffsetY = state.shadowOffsetY;
                ctx.shadowBlur = state.shadowBlur;
                ctx.shadowColor = shadowColorWithAlpha;
                
                // 填充阴影
                ctx.fillStyle = shadowColorWithAlpha;
                ctx.fill(shadowPath);
                ctx.restore();
            }

            // === 4. 绘制按钮主体 ===
            // 创建按钮路径
            const btnPath = new Path2D();
            if (state.shapeType === 'rect' || drawR <= 0) {
                btnPath.rect(dx, dy, dw, dh);
            } else {
                btnPath.moveTo(dx + drawR, dy);
                btnPath.lineTo(dx + dw - drawR, dy);
                btnPath.quadraticCurveTo(dx + dw, dy, dx + dw, dy + drawR);
                btnPath.lineTo(dx + dw, dy + dh - drawR);
                btnPath.quadraticCurveTo(dx + dw, dy + dh, dx + dw - drawR, dy + dh);
                btnPath.lineTo(dx + drawR, dy + dh);
                btnPath.quadraticCurveTo(dx, dy + dh, dx, dy + dh - drawR);
                btnPath.lineTo(dx, dy + drawR);
                btnPath.quadraticCurveTo(dx, dy, dx + drawR, dy);
            }
            btnPath.closePath();

            // === 4. 填充样式 ===
            ctx.save();
            // 注意：这里不进行裁剪，因为阴影需要在按钮外部显示

            const fillY = btnY;
            const fillH = btnH;
            let sColor = state.colorStart;
            let eColor = state.colorEnd;
            let mColor = state.colorMid;

            if (state.styleType === 'flat') {
                ctx.fillStyle = sColor;
                ctx.fill(btnPath);
            }
            else if (state.styleType === 'gradient') {
                const grad = ctx.createLinearGradient(0, fillY, 0, fillY + fillH);
                grad.addColorStop(0, sColor);
                grad.addColorStop(1, eColor);
                ctx.fillStyle = grad;
                ctx.fill(btnPath);
            }
            else if (state.styleType === 'metal') {
                const grad = ctx.createLinearGradient(0, fillY, 0, fillY + fillH);
                grad.addColorStop(0, lightenColor(sColor, 40));
                grad.addColorStop(0.4, mColor);
                grad.addColorStop(0.6, sColor);
                grad.addColorStop(1, lightenColor(eColor, 20));
                ctx.fillStyle = grad;
                ctx.fill(btnPath);
            }
            else if (state.styleType === 'crystal') {
                const grad = ctx.createLinearGradient(0, fillY, 0, fillY + fillH);
                grad.addColorStop(0, sColor);
                grad.addColorStop(0.5, mColor);
                grad.addColorStop(1, eColor);
                ctx.fillStyle = grad;
                ctx.fill(btnPath);

                // 绘制高光效果
                ctx.save();
                // 清除阴影效果，避免高光部分也有阴影
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = 0;
                
                const shineH = fillH / 2;
                const shineGrad = ctx.createLinearGradient(0, fillY, 0, fillY + shineH);
                shineGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
                shineGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
                ctx.fillStyle = shineGrad;
                
                // 创建高光区域路径
                const shinePath = new Path2D();
                if (state.shapeType === 'rect' || drawR <= 0) {
                    shinePath.rect(dx, dy, dw, shineH - inset);
                } else {
                    const shineTopR = Math.max(0, r - inset);
                    shinePath.moveTo(dx + shineTopR, dy);
                    shinePath.lineTo(dx + dw - shineTopR, dy);
                    shinePath.quadraticCurveTo(dx + dw, dy, dx + dw, dy + shineTopR);
                    shinePath.lineTo(dx + dw, dy + shineH - inset - 1);
                    shinePath.lineTo(dx, dy + shineH - inset - 1);
                    shinePath.lineTo(dx, dy + shineTopR);
                    shinePath.quadraticCurveTo(dx, dy, dx + shineTopR, dy);
                }
                shinePath.closePath();
                ctx.fill(shinePath);
                ctx.restore();
            }

            // 状态覆盖
            if (state.btnState === 'pressed') {
                // 保存和恢复阴影设置
                ctx.save();
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = 0;
                
                if (state.pressOverlay === 'dark') {
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                } else if (state.pressOverlay === 'light') {
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                } else {
                    const rgb = hexToRgb(state.pressOverlayColor);
                    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.3)`;
                }
                
                // 创建覆盖层路径
                ctx.fill(btnPath);
                ctx.restore();
            }
            
            if (state.btnState === 'focused') {
                // 保存和恢复阴影设置
                ctx.save();
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = 0;
                
                const rgb = hexToRgb(state.focusColor);
                ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`;
                
                // 创建聚焦层路径
                ctx.fill(btnPath);
                ctx.restore();
            }

            ctx.restore();

            // 保存当前状态，准备描边
            ctx.save();
            
            // === 5. 描边 ===
            if (state.borderWidth > 0) {
                let borderColor = state.borderColor;
                if (state.btnState === 'focused') borderColor = state.focusColor;
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = state.borderWidth;
                
                // 清除阴影，避免描边也有阴影
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = 0;
                
                ctx.stroke(btnPath);
            }
            
            // 恢复之前的状态
            ctx.restore();

            // === 6. 9-Patch 标记 (优化版) ===
            if (state.is9Patch) {
                ctx.fillStyle = '#000000';

                // 顶部线 (水平拉伸)
                let stretchStartX = btnX + r;
                let stretchEndX = btnX + btnW - r;
                if (stretchEndX <= stretchStartX) {
                    const midX = btnX + btnW / 2;
                    stretchStartX = midX - 0.5;
                    stretchEndX = midX + 0.5;
                }
                ctx.fillRect(stretchStartX, 0, stretchEndX - stretchStartX, 1);

                // 左侧线 (垂直拉伸)
                let stretchStartY = btnY + r;
                let stretchEndY = btnY + btnH - r;
                if (stretchEndY <= stretchStartY) {
                    const midY = btnY + btnH / 2;
                    stretchStartY = midY - 0.5;
                    stretchEndY = midY + 0.5;
                }
                ctx.fillRect(0, stretchStartY, 1, stretchEndY - stretchStartY);

                // 计算内容区 Padding（最小化，让右侧和底部占用更多空间）
                const autoPad = Math.max(state.borderWidth, Math.ceil(r / 3));

                // 底部线 (水平内容区) - 优化：从边缘1px开始，占用最大空间
                const contentStartX = Math.max(1, btnX + autoPad);
                const contentEndX = Math.min(w - 1, btnX + btnW - autoPad);
                const contentW = Math.max(1, contentEndX - contentStartX);
                ctx.fillRect(contentStartX, h - 1, contentW, 1);

                // 右侧线 (垂直内容区) - 优化：从边缘1px开始，占用最大空间
                const contentStartY = Math.max(1, btnY + autoPad);
                const contentEndY = Math.min(h - 1, btnY + btnH - autoPad);
                const contentH = Math.max(1, contentEndY - contentStartY);
                ctx.fillRect(w - 1, contentStartY, 1, contentH);
            }
        };

        // === 辅助函数 ===
        function darkenColor(hex, percent) {
            let {r,g,b} = hexToRgb(hex);
            r = Math.max(0, r - r * (percent/100));
            g = Math.max(0, g - g * (percent/100));
            b = Math.max(0, b - b * (percent/100));
            return rgbToHex(r,g,b);
        }
        function lightenColor(hex, percent) {
            let {r,g,b} = hexToRgb(hex);
            r = Math.min(255, r + (255-r) * (percent/100));
            g = Math.min(255, g + (255-g) * (percent/100));
            b = Math.min(255, b + (255-b) * (percent/100));
            return rgbToHex(r,g,b);
        }
        function hexToRgb(hex) {
            const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return res ? { r: parseInt(res[1],16), g: parseInt(res[2],16), b: parseInt(res[3],16) } : {r:0,g:0,b:0};
        }
        function rgbToHex(r,g,b) {
            return "#" + ((1<<24)+(Math.round(r)<<16)+(Math.round(g)<<8)+Math.round(b)).toString(16).slice(1);
        }
        function hexToRgba(hex, alpha) {
            const {r,g,b} = hexToRgb(hex);
            return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
        }

        // === 事件绑定 ===
        const update = () => {
            state.marginX = parseInt(inputs.marginX.value);
            state.marginY = parseInt(inputs.marginY.value);
            state.styleType = inputs.styleType.value;
            state.shapeType = inputs.shapeType.value;
            state.btnState = inputs.btnState.value;
            state.colorStart = inputs.colStart.value;
            state.colorEnd = inputs.colEnd.value;
            state.colorMid = inputs.colMid.value;
            state.borderColor = inputs.colBorder.value;
            state.focusColor = inputs.colFocus.value;
            state.pressOverlay = inputs.pressOverlay.value;
            state.pressOverlayColor = inputs.colPress.value;
            state.borderWidth = parseInt(inputs.borderW.value);
            state.radius = parseInt(inputs.radius.value);
            state.is9Patch = inputs.is9Patch.checked;
            state.shadowEnabled = inputs.shadowEnabled.checked;
            state.shadowOffsetX = parseInt(inputs.shadowX.value);
            state.shadowOffsetY = parseInt(inputs.shadowY.value);
            state.shadowBlur = parseInt(inputs.shadowBlur.value);
            state.shadowOpacity = parseInt(inputs.shadowOpacity.value);
            state.shadowColor = inputs.colShadow.value;

            // UI 显隐
            inputs.grpRadius.style.display = state.shapeType === 'rounded' ? 'flex' : 'none';
            inputs.grpBorderCol.style.display = state.borderWidth > 0 ? 'flex' : 'none';
            inputs.grpColMid.style.display = (state.styleType === 'metal' || state.styleType === 'crystal') ? 'flex' : 'none';
            inputs.grpFocusCol.style.display = state.btnState === 'focused' ? 'flex' : 'none';
            inputs.grpPressOverlay.style.display = state.btnState === 'pressed' ? 'flex' : 'none';
            inputs.grpPressCol.style.display = (state.btnState === 'pressed' && state.pressOverlay === 'custom') ? 'flex' : 'none';
            inputs.grpShadowSettings.style.display = state.shadowEnabled ? 'block' : 'none';

            // 数值显示
            inputs.valMarginX.textContent = state.marginX;
            inputs.valMarginY.textContent = state.marginY;
            inputs.valBorderW.textContent = state.borderWidth;
            inputs.valRadius.textContent = state.radius;
            inputs.valShadowX.textContent = state.shadowOffsetX;
            inputs.valShadowY.textContent = state.shadowOffsetY;
            inputs.valShadowBlur.textContent = state.shadowBlur;
            inputs.valShadowOpacity.textContent = state.shadowOpacity;

            draw();
        };

        // 绑定所有输入
        Object.values(inputs).forEach(el => {
            if (el instanceof HTMLElement) {
                el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', update);
            }
        });

        overlay.querySelector('#btn-cancel').addEventListener('click', () => document.body.removeChild(overlay));
        
        overlay.querySelector('#btn-ok').addEventListener('click', () => {
            let name = 'btn_' + state.btnState;
            if (state.is9Patch) name += '.9.png';
            else name += '.png';
            
            const layer = app.layerManager.addLayer(canvas.width, canvas.height, name);
            layer.ctx.drawImage(canvas, 0, 0);
            
            app.render();
            app.renderLayerList();
            app.saveHistory();
            
            document.body.removeChild(overlay);
            Toast.show(`已生成 ${name}`, 'success');
        });

        // 初始绘制
        update();
    }
})();