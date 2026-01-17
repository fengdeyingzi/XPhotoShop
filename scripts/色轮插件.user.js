// ==UserScript==
// @name         PhotoShop色轮插件
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  为XPhotoShop添加Coolorus风格色轮
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 样式定义
    const STYLES = `
        .cw-root {
            --bg-panel: #333333;
            --bg-header: #2a2a2a;
            --text-main: #e0e0e0;
            --border: #444444;
            font-family: 'Segoe UI', sans-serif;
            color: var(--text-main);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 0;
            background-color: var(--bg-panel);
            user-select: none;
        }

        .cw-root * { box-sizing: border-box; }

        /* --- 工具栏 --- */
        .cw-toolbar {
            width: 100%;
            padding: 0 15px 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        /* 颜色预览 */
        .cw-preview-group { position: relative; width: 50px; height: 50px; }
        .cw-preview-circle {
            width: 46px; height: 46px;
            border-radius: 50%;
            border: 2px solid #2a2a2a;
            position: absolute;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        #cwPrevColor { background: #ff0000; top: 0; left: 15px; z-index: 1; }
        #cwCurrColor { background: #00ff00; top: 5px; left: 0; z-index: 2; }

        /* 形状切换按钮 */
        .cw-shape-tools { display: flex; gap: 8px; }
        .cw-tool-btn {
            width: 24px; height: 24px;
            border-radius: 50%;
            background: #444;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            border: 1px solid #222;
            transition: all 0.2s;
        }
        .cw-tool-btn:hover, .cw-tool-btn.active { background: #555; border-color: #888; }
        .cw-tool-btn svg { width: 14px; height: 14px; fill: #ccc; }
        .cw-tool-btn.active svg { fill: #fff; }

        /* --- 色轮区域 --- */
        .cw-wheel-area {
            position: relative;
            width: 260px; height: 260px;
            margin: 0 auto;
        }

        .cw-hue-ring {
            width: 100%; height: 100%;
            border-radius: 50%;
            background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
            position: relative;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
        }
        .cw-hue-ring::after {
            content: '';
            position: absolute;
            top: 30px; left: 30px; right: 30px; bottom: 30px;
            background: var(--bg-panel);
            border-radius: 50%;
            pointer-events: none;
        }

        .cw-ring-handle {
            width: 16px; height: 16px;
            border: 2px solid #fff;
            border-radius: 50%;
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 3px rgba(0,0,0,0.8);
            pointer-events: none;
            z-index: 10;
        }

        /* --- 核心形状容器 --- */
        .cw-sv-container {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 130px; height: 130px;
            z-index: 5;
            cursor: crosshair;
        }

        .cw-sv-shape {
            width: 100%; height: 100%;
            position: relative;
            overflow: hidden;
            transition: clip-path 0.3s ease;
        }

        /* 渐变层 */
        .cw-grad-layer { position: absolute; inset: 0; pointer-events: none; }

        /* 1. 正方形模式 (默认) */
        .cw-sv-shape.square { clip-path: inset(0 0 0 0); }
        .cw-sv-shape.square .g-base { background-color: var(--hue-color); width: 100%; height: 100%; }
        .cw-sv-shape.square .g-1 { background: linear-gradient(to right, #fff, transparent); }
        .cw-sv-shape.square .g-2 { background: linear-gradient(to top, #000, transparent); }

        /* 2. 三角形模式 */
        .cw-sv-shape.triangle { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
        .cw-sv-shape.triangle .g-base { background-color: var(--hue-color); width: 100%; height: 100%; }
        .cw-sv-shape.triangle .g-1 { 
            background: linear-gradient(to top right, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 60%); 
        }
        .cw-sv-shape.triangle .g-2 { 
            background: linear-gradient(to top left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 60%); 
            mix-blend-mode: multiply;
        }
        .cw-sv-shape.triangle .g-3 {
            background: linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.1) 100%);
        }

        /* 3. 六边形模式 */
        .cw-sv-shape.hexagon { 
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
        }
        .cw-sv-shape.hexagon .g-base { background-color: var(--hue-color); width: 100%; height: 100%; }
        .cw-sv-shape.hexagon .g-1 { background: linear-gradient(to right, #fff, transparent); }
        .cw-sv-shape.hexagon .g-2 { background: linear-gradient(to top, #000, transparent); }


        .cw-sv-handle {
            width: 10px; height: 10px;
            border: 1px solid #fff;
            border-radius: 50%;
            position: absolute;
            box-shadow: 0 0 2px rgba(0,0,0,1);
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 11;
        }

        .cw-hex-tag {
            position: absolute; bottom: 15px; right: 10px;
            background: #222; padding: 4px 8px; font-size: 12px;
            color: #ccc; border: 1px solid #444; border-radius: 3px;
            font-family: monospace;
        }

        /* --- 底部参数 --- */
        .cw-controls { width: 100%; padding: 10px 15px; background: var(--bg-panel); }
        
        .cw-slider-row {
            display: flex; align-items: center; margin-bottom: 8px; height: 20px;
        }
        .cw-slider-label { width: 15px; font-size: 10px; color: #999; }
        .cw-slider-track {
            flex: 1; height: 12px; background: #222; border: 1px solid #111;
            border-radius: 2px; position: relative; margin: 0 8px; cursor: pointer;
        }
        .cw-slider-fill { width: 100%; height: 100%; border-radius: 1px; }
        .cw-slider-cursor {
            position: absolute; top: -2px; bottom: -2px; width: 6px;
            border: 1px solid #fff; transform: translateX(-50%); pointer-events: none;
            box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
        .cw-slider-input {
            width: 32px; background: transparent; border: none;
            color: #ddd; font-size: 11px; text-align: right;
            border-left: 1px solid #444; padding-left: 4px;
        }

        .cw-footer-modes {
            margin-top: 5px; font-size: 10px; color: #666;
            display: flex; gap: 8px; cursor: pointer;
        }
        .cw-mode-item.active { color: #fff; background: #444; padding: 0 4px; border-radius: 2px; }

        /* --- 菜单样式 --- */
        .cw-top-bar { width: 100%; display: flex; justify-content: flex-end; padding: 4px 10px 0; background: var(--bg-panel); min-height: 24px; }
        .cw-menu-btn { cursor: pointer; color: #888; font-size: 16px; line-height: 1; padding: 2px; border-radius: 3px; }
        .cw-menu-btn:hover { color: #fff; background: #444; }
        .cw-dropdown { 
            position: absolute; top: 28px; right: 5px; 
            background: #2a2a2a; border: 1px solid #444; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.6); 
            z-index: 100; display: none; width: 200px; 
            max-height: 400px; overflow-y: auto;
            border-radius: 3px; padding: 4px 0;
        }
        .cw-dropdown.show { display: block; }
        .cw-dd-group { border-bottom: 1px solid #333; padding-bottom: 2px; margin-bottom: 2px; }
        .cw-dd-group:last-child { border-bottom: none; margin-bottom: 0; }
        .cw-dd-title { font-size: 10px; color: #666; padding: 4px 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
        .cw-dd-item { padding: 6px 12px; font-size: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #ccc; }
        .cw-dd-item:hover { background: #0078d7; color: #fff; }
        .cw-dd-check { opacity: 0; font-size: 10px; }
        .cw-dd-item.checked .cw-dd-check { opacity: 1; }
        .cw-dd-item.checked .cw-dd-check::before { content: '✔'; }
        
        .cw-hex-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #999; }
        .cw-hex-input { background: #222; border: 1px solid #444; color: #eee; width: 60px; font-family: monospace; padding: 2px 4px; text-transform: uppercase; }
    `;

    // HTML 模板
    const TEMPLATE = `
        <div class="cw-root">
            <div class="cw-top-bar">
                <div class="cw-menu-btn" id="cwMenuBtn">≡</div>
            </div>
            <div class="cw-dropdown" id="cwDropdown"></div>
            
            <div class="cw-toolbar">
                <div class="cw-preview-group">
                    <div class="cw-preview-circle" id="cwPrevColor" title="旧颜色"></div>
                    <div class="cw-preview-circle" id="cwCurrColor" title="新颜色"></div>
                </div>
                <div class="cw-shape-tools">
                    <div class="cw-tool-btn active" id="cwBtnSquare" title="正方形">
                        <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/></svg>
                    </div>
                    <div class="cw-tool-btn" id="cwBtnTriangle" title="三角形">
                        <svg viewBox="0 0 24 24"><path d="M12 2L22 22H2Z"/></svg>
                    </div>
                    <div class="cw-tool-btn" id="cwBtnHexagon" title="六边形">
                        <svg viewBox="0 0 24 24"><path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z"/></svg>
                    </div>
                </div>
            </div>

            <div class="cw-wheel-area" id="cwWheelArea">
                <div class="cw-hue-ring" id="cwHueRing"></div>
                <div class="cw-ring-handle" id="cwHueHandle"></div>

                <div class="cw-sv-container" id="cwSvContainer">
                    <div class="cw-sv-shape square" id="cwSvShape">
                        <div class="cw-grad-layer g-base"></div>
                        <div class="cw-grad-layer g-1"></div>
                        <div class="cw-grad-layer g-2"></div>
                        <div class="cw-grad-layer g-3"></div>
                    </div>
                    <div class="cw-sv-handle" id="cwSvHandle"></div>
                </div>
                
                <div class="cw-hex-tag" id="cwHexDisplay">#FF0000</div>
            </div>

            <div class="cw-controls">
                <div id="cwSlidersContainer"></div>
                <div class="cw-footer-modes">
                    <span class="cw-mode-item" data-mode="RGB">RGB</span>
                    <span class="cw-mode-item active" data-mode="HSV">HSV</span>
                    <span class="cw-mode-item" data-mode="LAB">LAB</span>
                    <span class="cw-mode-item" data-mode="CMYK">CMYK</span>
                </div>
            </div>
        </div>
    `;

    class ColorWheel {
        constructor(container, app) {
            this.container = container;
            this.app = app;
            
            this.config = {
                lockValue: false, // 明度锁定
                syncShape: false, // 影响形状
                showHex: false,   // 显示Hex
                compareColors: true // 比较新旧颜色
            };

            this.state = {
                h: 0, s: 100, v: 100,
                r: 255, g: 0, b: 0,
                prevColor: { r: 255, g: 0, b: 0 },
                mode: 'HSV',
                shape: 'square'
            };

            this.init();
        }

        init() {
            this.container.innerHTML = TEMPLATE;
            
            if (!document.getElementById('coolorus-style')) {
                const style = document.createElement('style');
                style.id = 'coolorus-style';
                style.textContent = STYLES;
                document.head.appendChild(style);
            }

            this.els = {
                menuBtn: this.container.querySelector('#cwMenuBtn'),
                dropdown: this.container.querySelector('#cwDropdown'),
                hueRing: this.container.querySelector('#cwHueRing'),
                hueHandle: this.container.querySelector('#cwHueHandle'),
                svContainer: this.container.querySelector('#cwSvContainer'),
                svShape: this.container.querySelector('#cwSvShape'),
                svHandle: this.container.querySelector('#cwSvHandle'),
                currColor: this.container.querySelector('#cwCurrColor'),
                prevColor: this.container.querySelector('#cwPrevColor'),
                hexDisplay: this.container.querySelector('#cwHexDisplay'),
                slidersContainer: this.container.querySelector('#cwSlidersContainer'),
                modeItems: this.container.querySelectorAll('.cw-mode-item'),
                btnSquare: this.container.querySelector('#cwBtnSquare'),
                btnTriangle: this.container.querySelector('#cwBtnTriangle'),
                btnHexagon: this.container.querySelector('#cwBtnHexagon')
            };

            this.initMenu();
            this.bindEvents();
            this.renderSliders();
            
            const appColor = this.app.tools.color || '#ff0000';
            const rgb = this.hexToRgb(appColor);
            this.setColorRGB(rgb.r, rgb.g, rgb.b);
        }

        initMenu() {
            const menuStructure = [
                {
                    title: '基础功能',
                    items: [
                        { label: '拾色器 (P)', checkable: false, action: () => this.activatePicker() },
                        { label: '许可证', checkable: false, action: () => alert('已激活 Pro 版本') },
                        { label: '关于', checkable: false, action: () => alert('Coolorus 2.5.14 (813)\nBy 风的影子') }
                    ]
                },
                {
                    title: '面板配置',
                    items: [
                        { label: '明度锁定', checkable: true, key: 'lockValue', action: (v) => this.config.lockValue = v },
                        { label: '影响形状和文本', checkable: true, key: 'syncShape', action: (v) => this.config.syncShape = v },
                        { label: '比较新旧颜色', checkable: true, key: 'compareColors', action: (v) => {
                            this.config.compareColors = v;
                            this.container.querySelector('.cw-preview-group').style.display = v ? 'block' : 'none';
                        }},
                        { label: '显示十六进制输入', checkable: true, key: 'showHex', action: (v) => {
                            this.config.showHex = v;
                            this.updateHexInputDisplay();
                        }}
                    ]
                },
                {
                    title: '系统配置',
                    items: [
                        { label: '配置...', checkable: false, action: () => alert('配置窗口') },
                        { label: '技巧和诀窍', checkable: false, action: () => window.open('https://coolorus.com') },
                        { label: '关于统计', checkable: false, action: () => alert('统计数据...') },
                        { label: '卸载', checkable: false, action: () => {
                            if(confirm('确定要卸载插件吗？')) alert('请手动从油猴管理器删除脚本');
                        }}
                    ]
                },
                {
                    title: '退出',
                    items: [
                        { label: '关闭', checkable: false, action: () => this.app.panelManager.removePanel('color-wheel') },
                        { label: '关闭选项卡组', checkable: false, action: () => this.app.panelManager.removePanel('color-wheel') }
                    ]
                }
            ];

            const html = menuStructure.map(group => `
                <div class="cw-dd-group">
                    <div class="cw-dd-title">${group.title}</div>
                    ${group.items.map(item => `
                        <div class="cw-dd-item ${item.checkable && this.config[item.key] ? 'checked' : ''}" data-label="${item.label}">
                            <span>${item.label}</span>
                            ${item.checkable ? '<span class="cw-dd-check"></span>' : ''}
                        </div>
                    `).join('')}
                </div>
            `).join('');

            this.els.dropdown.innerHTML = html;

            // 绑定菜单点击事件
            let itemIndex = 0;
            menuStructure.forEach(group => {
                group.items.forEach(item => {
                    const domItem = this.els.dropdown.querySelectorAll('.cw-dd-item')[itemIndex++];
                    domItem.addEventListener('click', (e) => {
                        if (item.checkable) {
                            const newState = !domItem.classList.contains('checked');
                            domItem.classList.toggle('checked', newState);
                            item.action(newState);
                        } else {
                            item.action();
                        }
                        this.els.dropdown.classList.remove('show');
                        e.stopPropagation();
                    });
                });
            });

            // 点击外部关闭菜单
            document.addEventListener('click', (e) => {
                if (!this.els.dropdown.contains(e.target) && e.target !== this.els.menuBtn) {
                    this.els.dropdown.classList.remove('show');
                }
            });
        }

        activatePicker() {
            this.app.Toast.show('点击画布任意位置取色', 'info');
            const handler = (e) => {
                // 需要将事件坐标转换到 Canvas 内部坐标
                // 但这里我们简单处理，直接取 displayCanvas 的数据
                // 更严谨的做法应该调用 app.tools.pickColor 或类似逻辑
                
                const rect = this.app.canvasManager.displayCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const ctx = this.app.canvasManager.displayCtx;
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const hex = '#' + this.rgbToHex(pixel[0], pixel[1], pixel[2]);
                this.app.tools.setColor(hex);
                this.app.colorPicker.value = hex;
                this.app.Toast.show('已取色: ' + hex, 'success');
            };
            this.app.canvasManager.displayCanvas.addEventListener('click', handler, {once:true});
        }

        updateHexInputDisplay() {
            let row = this.container.querySelector('.cw-hex-row');
            if (this.config.showHex) {
                if (!row) {
                    row = document.createElement('div');
                    row.className = 'cw-hex-row';
                    row.innerHTML = '<span>HEX</span><input class="cw-hex-input" type="text">';
                    this.els.slidersContainer.parentNode.insertBefore(row, this.els.slidersContainer);
                    
                    const input = row.querySelector('input');
                    input.addEventListener('change', (e) => {
                        const rgb = this.hexToRgb(e.target.value);
                        this.setColorRGB(rgb.r, rgb.g, rgb.b);
                    });
                    this.els.hexInput = input;
                }
                row.style.display = 'flex';
                this.els.hexInput.value = this.rgbToHex(this.state.r, this.state.g, this.state.b);
            } else {
                if (row) row.style.display = 'none';
            }
        }

        bindEvents() {
            // 菜单按钮
            this.els.menuBtn.addEventListener('click', (e) => {
                this.els.dropdown.classList.toggle('show');
                e.stopPropagation();
            });

            this.setupDrag(this.els.hueRing, this.handleHueDrag.bind(this));
            this.setupDrag(this.els.svContainer, this.handleSVDrag.bind(this));
            
            this.els.modeItems.forEach(item => {
                item.addEventListener('click', () => {
                    this.els.modeItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    this.state.mode = item.dataset.mode;
                    this.renderSliders();
                    this.updateUI();
                });
            });

            const setShape = (s) => {
                this.state.shape = s;
                this.els.svShape.className = `cw-sv-shape ${s}`;
                this.els.btnSquare.classList.toggle('active', s === 'square');
                this.els.btnTriangle.classList.toggle('active', s === 'triangle');
                this.els.btnHexagon.classList.toggle('active', s === 'hexagon');
                this.updateUI();
            };

            this.els.btnSquare.addEventListener('click', () => setShape('square'));
            this.els.btnTriangle.addEventListener('click', () => setShape('triangle'));
            this.els.btnHexagon.addEventListener('click', () => setShape('hexagon'));

            this.els.prevColor.addEventListener('click', () => {
                this.setColorRGB(this.state.prevColor.r, this.state.prevColor.g, this.state.prevColor.b, false);
            });
        }

        updateUI() {
            // 1. Hue Handle
            const r = 105; 
            const angleRad = (this.state.h - 90) * (Math.PI / 180);
            this.els.hueHandle.style.left = (120 + Math.cos(angleRad) * r) + 'px';
            this.els.hueHandle.style.top = (120 + Math.sin(angleRad) * r) + 'px';

            // 2. SV Background Color
            const pureHue = this.hsvToRgb(this.state.h, 100, 100);
            this.els.svShape.style.setProperty('--hue-color', `rgb(${pureHue.r}, ${pureHue.g}, ${pureHue.b})`);

            // 3. SV Handle Position
            const size = 120;
            let sx, sy;

            sx = (this.state.s / 100) * size;
            sy = (1 - this.state.v / 100) * size;

            this.els.svHandle.style.left = sx + 'px';
            this.els.svHandle.style.top = sy + 'px';

            // 4. Preview & Hex
            const hex = '#' + this.rgbToHex(this.state.r, this.state.g, this.state.b);
            this.els.currColor.style.backgroundColor = `rgb(${this.state.r}, ${this.state.g}, ${this.state.b})`;
            this.els.prevColor.style.backgroundColor = `rgb(${this.state.prevColor.r}, ${this.state.prevColor.g}, ${this.state.prevColor.b})`;
            this.els.hexDisplay.textContent = hex;
            
            if (this.els.hexInput && this.config.showHex) {
                this.els.hexInput.value = this.rgbToHex(this.state.r, this.state.g, this.state.b);
            }

            this.updateSlidersValues();

            if (this.app && this.app.tools) {
                this.app.tools.setColor(hex);
                this.app.colorPicker.value = hex;
            }
        }

        handleSVDrag(e, rect) {
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            x = Math.max(0, Math.min(x, rect.width));
            y = Math.max(0, Math.min(y, rect.height));

            if (this.state.shape === 'triangle') {
                const w = rect.width;
                const h = rect.height;
                const halfW = w / 2;
                const rangeX = (y / h) * halfW;
                const minX = halfW - rangeX;
                const maxX = halfW + rangeX;
                x = Math.max(minX, Math.min(x, maxX));
            }

            this.state.s = (x / rect.width) * 100;
            
            if (!this.config.lockValue) {
                this.state.v = 100 - ((y / rect.height) * 100);
            }
            
            this.setColorHSV(this.state.h, this.state.s, this.state.v, false);
        }

        handleHueDrag(e, rect) {
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const x = e.clientX - rect.left - cx;
            const y = e.clientY - rect.top - cy;
            let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
            if (angle < 0) angle += 360;
            this.setColorHSV(angle, this.state.s, this.state.v, false);
        }

        renderSliders() {
            this.els.slidersContainer.innerHTML = '';
            const channels = this.state.mode === 'HSV' ? ['H', 'S', 'V'] : ['R', 'G', 'B'];
            channels.forEach((ch) => {
                const row = document.createElement('div');
                row.className = 'cw-slider-row';
                row.innerHTML = `
                    <span class="cw-slider-label">${ch}</span>
                    <div class="cw-slider-track" id="cw-track-${ch}">
                        <div class="cw-slider-fill"></div>
                        <div class="cw-slider-cursor"></div>
                    </div>
                    <input type="number" class="cw-slider-input" id="cw-input-${ch}">
                `;
                this.els.slidersContainer.appendChild(row);
                
                const track = row.querySelector('.cw-slider-track');
                this.setupDrag(track, (e, rect) => {
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    this.updateColorFromSlider(ch, pct);
                });
            });
            this.updateSlidersValues();
        }

        updateSlidersValues() {
            const channels = this.state.mode === 'HSV' ? ['H', 'S', 'V'] : ['R', 'G', 'B'];
            channels.forEach(ch => {
                const track = this.container.querySelector(`#cw-track-${ch}`);
                if(!track) return;
                const fill = track.querySelector('.cw-slider-fill');
                const cursor = track.querySelector('.cw-slider-cursor');
                const input = track.parentElement.querySelector('input');
                
                let val, max, bg;
                if (this.state.mode === 'HSV') {
                    if (ch === 'H') { val = this.state.h; max = 360; bg = 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)'; }
                    else if (ch === 'S') { 
                        val = this.state.s; max = 100; 
                        const c = this.hsvToRgb(this.state.h, 100, this.state.v);
                        bg = `linear-gradient(to right, #fff, rgb(${c.r},${c.g},${c.b}))`;
                    }
                    else { 
                        val = this.state.v; max = 100; 
                        const c = this.hsvToRgb(this.state.h, this.state.s, 100);
                        bg = `linear-gradient(to right, #000, rgb(${c.r},${c.g},${c.b}))`;
                    }
                } else {
                    max = 255;
                    if (ch === 'R') { val = this.state.r; bg = `linear-gradient(to right, rgb(0,${this.state.g},${this.state.b}), rgb(255,${this.state.g},${this.state.b}))`; }
                    else if (ch === 'G') { val = this.state.g; bg = `linear-gradient(to right, rgb(${this.state.r},0,${this.state.b}), rgb(${this.state.r},255,${this.state.b}))`; }
                    else { val = this.state.b; bg = `linear-gradient(to right, rgb(${this.state.r},${this.state.g},0), rgb(${this.state.r},${this.state.g},255))`; }
                }
                
                fill.style.background = bg;
                cursor.style.left = (val / max * 100) + '%';
                if (document.activeElement !== input) input.value = Math.round(val);
            });
        }

        updateColorFromSlider(ch, pct) {
            if (this.state.mode === 'HSV') {
                let h = this.state.h, s = this.state.s, v = this.state.v;
                if (ch === 'H') h = pct * 360;
                if (ch === 'S') s = pct * 100;
                if (ch === 'V') v = pct * 100;
                this.setColorHSV(h, s, v, false);
            } else {
                let r = this.state.r, g = this.state.g, b = this.state.b;
                if (ch === 'R') r = pct * 255;
                if (ch === 'G') g = pct * 255;
                if (ch === 'B') b = pct * 255;
                this.setColorRGB(r, g, b, false);
            }
        }

        setColorHSV(h, s, v, save=true) {
            if(save) this.state.prevColor = {r:this.state.r, g:this.state.g, b:this.state.b};
            this.state.h = h; this.state.s = s; this.state.v = v;
            const rgb = this.hsvToRgb(h, s, v);
            this.state.r = rgb.r; this.state.g = rgb.g; this.state.b = rgb.b;
            this.updateUI();
        }

        setColorRGB(r, g, b, save=true) {
            if(save) this.state.prevColor = {r:this.state.r, g:this.state.g, b:this.state.b};
            this.state.r = r; this.state.g = g; this.state.b = b;
            const hsv = this.rgbToHsv(r, g, b);
            this.state.h = hsv.h; this.state.s = hsv.s; this.state.v = hsv.v;
            this.updateUI();
        }

        setupDrag(el, cb) {
            el.addEventListener('mousedown', (e) => {
                const rect = el.getBoundingClientRect();
                cb(e, rect);
                const move = (ev) => cb(ev, el.getBoundingClientRect());
                const up = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
            });
        }

        hsvToRgb(h, s, v) {
            s/=100; v/=100;
            let c = v*s, x = c*(1-Math.abs(((h/60)%2)-1)), m = v-c, r=0, g=0, b=0;
            if(h<60){r=c;g=x} else if(h<120){r=x;g=c} else if(h<180){g=c;b=x}
            else if(h<240){g=x;b=c} else if(h<300){r=x;b=c} else {r=c;b=x}
            return {r:Math.round((r+m)*255), g:Math.round((g+m)*255), b:Math.round((b+m)*255)};
        }

        rgbToHsv(r, g, b) {
            r/=255; g/=255; b/=255;
            let max=Math.max(r,g,b), min=Math.min(r,g,b), h, s, v=max, d=max-min;
            s = max===0?0:d/max;
            if(max===min) h=0;
            else {
                switch(max){ case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; case b: h=(r-g)/d+4; break; }
                h/=6;
            }
            return {h:h*360, s:s*100, v:v*100};
        }

        rgbToHex(r, g, b) {
            return ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1).toUpperCase();
        }

        hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 255, g: 0, b: 0 };
        }
    }

    function init() {
        const app = window.photoShopApp;
        if (!app) {
            setTimeout(init, 100);
            return;
        }

        const openColorWheel = () => {
            let panel = app.panelManager.getPanel('color-wheel');
            if (panel) {
                app.panelManager.removePanel('color-wheel');
            }

            const content = document.createElement('div');
            content.style.width = '100%';
            content.style.height = '100%';
            
            app.panelManager.addPanel({
                id: 'color-wheel',
                title: 'Coolorus 1.0',
                content: content,
                onClose: () => {
                    console.log('色轮面板已关闭');
                }
            });

            new ColorWheel(content, app);
        };

        app.menuManager.addMenuItem('视图', {
            label: 'Coolorus 色轮',
            action: 'toggle-coolorus',
            handler: (app) => {
                let panel = app.panelManager.getPanel('color-wheel');
                if (panel) {
                    app.panelManager.removePanel('color-wheel');
                } else {
                    openColorWheel();
                }
            }
        });

        // 默认开启
        openColorWheel();
        
        console.log('PhotoShop色轮插件已加载');
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();