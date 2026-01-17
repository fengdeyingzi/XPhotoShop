// ==UserScript==
// @name         PhotoShop调色板
// @namespace    http://tampermonkey.net/
// @version      1.1
// @author       风的影子
// @description  为XPhotoShop添加调色板面板
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 默认调色板颜色
    const defaultColors = [
        '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#800000', '#808080', '#C0C0C0', '#008000', '#000080', '#808000', '#800080', '#008080',
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
        '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E',
        '#C0392B', '#2980B9', '#27AE60', '#D68910', '#8E44AD', '#16A085', '#D35400', '#2C3E50',
        '#922B21', '#1F618D', '#1E8449', '#B9770E', '#6C3483', '#117A65', '#BA4A00', '#1C2833'
    ];

    let panel = null;
    let colors = [];
    let selectedBlock = null;
    let content = null;

    // 加载颜色
    function loadColors() {
        const saved = localStorage.getItem('photoshop-palette-colors');
        colors = saved ? JSON.parse(saved) : [...defaultColors];
    }

    // 保存颜色
    function saveColors() {
        localStorage.setItem('photoshop-palette-colors', JSON.stringify(colors));
    }

    // 创建色块
    function createColorBlock(color, index, app) {
        const colorBlock = document.createElement('div');
        colorBlock.style.cssText = `
            width: 20px;
            height: 20px;
            background-color: ${color};
            border: 2px solid #333;
            cursor: pointer;
            border-radius: 2px;
            box-sizing: border-box;
        `;
        colorBlock.title = color;
        colorBlock.dataset.index = index;

        colorBlock.addEventListener('click', () => {
            app.colorPicker.value = color;
            app.tools.setColor(color);

            // 更新选中状态
            if (selectedBlock) {
                selectedBlock.style.border = '2px solid #333';
            }
            selectedBlock = colorBlock;
            colorBlock.style.border = '2px solid #4a90e2';

            Toast.show(`已选择颜色: ${color}`, 'success', 1500);
        });

        colorBlock.addEventListener('mouseenter', () => {
            if (colorBlock !== selectedBlock) {
                colorBlock.style.transform = 'scale(1.2)';
                colorBlock.style.boxShadow = '0 0 8px rgba(255,255,255,0.5)';
            }
        });

        colorBlock.addEventListener('mouseleave', () => {
            colorBlock.style.transform = 'scale(1)';
            colorBlock.style.boxShadow = 'none';
        });

        // 右键菜单
        colorBlock.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, index, app);
        });

        return colorBlock;
    }

    // 显示颜色选择器对话框
    function showColorPicker(currentColor, index, app) {
        const isAddMode = index === -1;

        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #3c3f41;
            border: 1px solid #111;
            border-radius: 8px;
            padding: 20px;
            min-width: 300px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        `;

        let selectedColor = currentColor;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #dcdcdc; font-size: 16px;">${isAddMode ? '添加颜色' : '颜色选择器'}</h3>

            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <div style="flex: 1;">
                    <div style="width: 100%; height: 60px; background: ${currentColor}; border: 2px solid #666; border-radius: 4px;" id="colorPreview"></div>
                </div>
                <div style="flex: 1;">
                    <input type="color" id="colorInput" value="${currentColor}" style="width: 100%; height: 60px; cursor: pointer; border: 2px solid #666; border-radius: 4px;">
                </div>
            </div>

            <button id="pickColorBtn" style="width: 100%; padding: 8px; margin-bottom: 15px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">从画布取色</button>

            <div style="margin-bottom: 15px;">
                <label style="color: #dcdcdc; font-size: 13px; display: block; margin-bottom: 5px;">色相 (H): <span id="hueValue">0</span>°</label>
                <input type="range" id="hueSlider" min="0" max="360" value="0" style="width: 100%;">

                <label style="color: #dcdcdc; font-size: 13px; display: block; margin-bottom: 5px; margin-top: 8px;">饱和度 (S): <span id="satValue">0</span>%</label>
                <input type="range" id="satSlider" min="0" max="100" value="0" style="width: 100%;">

                <label style="color: #dcdcdc; font-size: 13px; display: block; margin-bottom: 5px; margin-top: 8px;">亮度 (V): <span id="valValue">0</span>%</label>
                <input type="range" id="valSlider" min="0" max="100" value="0" style="width: 100%;">
            </div>

            <div style="margin-bottom: 10px;">
                <label style="color: #dcdcdc; font-size: 13px; display: block; margin-bottom: 5px;">十六进制:</label>
                <input type="text" id="hexInput" value="${currentColor}" style="width: 100%; padding: 6px; background: #2b2b2b; color: #dcdcdc; border: 1px solid #666; border-radius: 4px; font-family: monospace;">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="color: #dcdcdc; font-size: 13px; display: block; margin-bottom: 5px;">RGB (0-255):</label>
                <div style="display: flex; gap: 8px;">
                    <input type="number" id="rInput" min="0" max="255" style="flex: 1; padding: 6px; background: #2b2b2b; color: #dcdcdc; border: 1px solid #666; border-radius: 4px;">
                    <input type="number" id="gInput" min="0" max="255" style="flex: 1; padding: 6px; background: #2b2b2b; color: #dcdcdc; border: 1px solid #666; border-radius: 4px;">
                    <input type="number" id="bInput" min="0" max="255" style="flex: 1; padding: 6px; background: #2b2b2b; color: #dcdcdc; border: 1px solid #666; border-radius: 4px;">
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button id="cancelBtn" style="flex: 1; padding: 8px; background: #555; color: #dcdcdc; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                <button id="confirmBtn" style="flex: 1; padding: 8px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 获取元素
        const colorPreview = dialog.querySelector('#colorPreview');
        const colorInput = dialog.querySelector('#colorInput');
        const hexInput = dialog.querySelector('#hexInput');
        const rInput = dialog.querySelector('#rInput');
        const gInput = dialog.querySelector('#gInput');
        const bInput = dialog.querySelector('#bInput');
        const hueSlider = dialog.querySelector('#hueSlider');
        const satSlider = dialog.querySelector('#satSlider');
        const valSlider = dialog.querySelector('#valSlider');
        const hueValue = dialog.querySelector('#hueValue');
        const satValue = dialog.querySelector('#satValue');
        const valValue = dialog.querySelector('#valValue');
        const pickColorBtn = dialog.querySelector('#pickColorBtn');
        const cancelBtn = dialog.querySelector('#cancelBtn');
        const confirmBtn = dialog.querySelector('#confirmBtn');

        // 初始化RGB值
        const rgb = hexToRgb(currentColor);
        rInput.value = rgb.r;
        gInput.value = rgb.g;
        bInput.value = rgb.b;

        // 初始化HSV值
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        hueSlider.value = hsv.h;
        satSlider.value = hsv.s;
        valSlider.value = hsv.v;
        hueValue.textContent = Math.round(hsv.h);
        satValue.textContent = Math.round(hsv.s);
        valValue.textContent = Math.round(hsv.v);

        // 更新颜色
        function updateColor(color) {
            selectedColor = color.toUpperCase();
            colorPreview.style.background = selectedColor;
            colorInput.value = selectedColor;
            hexInput.value = selectedColor;
            const rgb = hexToRgb(selectedColor);
            rInput.value = rgb.r;
            gInput.value = rgb.g;
            bInput.value = rgb.b;
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            hueSlider.value = hsv.h;
            satSlider.value = hsv.s;
            valSlider.value = hsv.v;
            hueValue.textContent = Math.round(hsv.h);
            satValue.textContent = Math.round(hsv.s);
            valValue.textContent = Math.round(hsv.v);
        }

        // 颜色选择器变化
        colorInput.addEventListener('input', (e) => {
            updateColor(e.target.value);
        });

        // 十六进制输入
        hexInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                updateColor(value);
            }
        });

        // RGB输入
        [rInput, gInput, bInput].forEach(input => {
            input.addEventListener('input', () => {
                const r = parseInt(rInput.value) || 0;
                const g = parseInt(gInput.value) || 0;
                const b = parseInt(bInput.value) || 0;
                if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
                    const hex = rgbToHex(r, g, b);
                    updateColor(hex);
                }
            });
        });

        // HSV滑块
        [hueSlider, satSlider, valSlider].forEach(slider => {
            slider.addEventListener('input', () => {
                const h = parseFloat(hueSlider.value);
                const s = parseFloat(satSlider.value);
                const v = parseFloat(valSlider.value);
                hueValue.textContent = Math.round(h);
                satValue.textContent = Math.round(s);
                valValue.textContent = Math.round(v);
                const rgb = hsvToRgb(h, s, v);
                const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
                selectedColor = hex;
                colorPreview.style.background = hex;
                colorInput.value = hex;
                hexInput.value = hex;
                rInput.value = rgb.r;
                gInput.value = rgb.g;
                bInput.value = rgb.b;
            });
        });

        // 从画布取色
        pickColorBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
            Toast.show('点击画布选择颜色', 'info', 2000);

            const canvas = app.canvasManager.displayCanvas;
            const pickColor = (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / app.canvasManager.zoom);
                const y = Math.floor((e.clientY - rect.top) / app.canvasManager.zoom);

                const layer = app.layerManager.getActiveLayer();
                if (layer && x >= 0 && x < layer.canvas.width && y >= 0 && y < layer.canvas.height) {
                    const pixel = layer.ctx.getImageData(x, y, 1, 1).data;
                    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
                    updateColor(hex);
                }

                canvas.removeEventListener('click', pickColor);
                canvas.style.cursor = '';
                overlay.style.display = 'flex';
            };

            canvas.style.cursor = 'crosshair';
            canvas.addEventListener('click', pickColor);
        });

        // 取消
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
        });

        // 确定
        confirmBtn.addEventListener('click', () => {
            if (isAddMode) {
                colors.push(selectedColor);
            } else {
                colors[index] = selectedColor;
            }
            saveColors();
            renderColors(app);
            overlay.remove();
        });

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // 十六进制转RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    // RGB转十六进制
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, x)).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();
    }

    // RGB转HSV
    function rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        const s = max === 0 ? 0 : (d / max) * 100;
        const v = max * 100;

        if (d !== 0) {
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }

        return { h: h * 360, s: s, v: v };
    }

    // HSV转RGB
    function hsvToRgb(h, s, v) {
        h /= 360;
        s /= 100;
        v /= 100;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        let r, g, b;

        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // 显示右键菜单
    function showContextMenu(x, y, index, app) {
        // 移除旧菜单
        const oldMenu = document.querySelector('.color-palette-context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'color-palette-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: #3c3f41;
            border: 1px solid #111;
            border-radius: 4px;
            padding: 4px 0;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;

        const setColorOption = document.createElement('div');
        setColorOption.textContent = '设置颜色';
        setColorOption.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            color: #dcdcdc;
            font-size: 13px;
        `;
        setColorOption.addEventListener('mouseenter', () => {
            setColorOption.style.backgroundColor = '#4a4d4f';
        });
        setColorOption.addEventListener('mouseleave', () => {
            setColorOption.style.backgroundColor = 'transparent';
        });
        setColorOption.addEventListener('click', () => {
            menu.remove();
            showColorPicker(colors[index], index, app);
        });

        const deleteOption = document.createElement('div');
        deleteOption.textContent = '删除颜色';
        deleteOption.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            color: #dcdcdc;
            font-size: 13px;
        `;
        deleteOption.addEventListener('mouseenter', () => {
            deleteOption.style.backgroundColor = '#4a4d4f';
        });
        deleteOption.addEventListener('mouseleave', () => {
            deleteOption.style.backgroundColor = 'transparent';
        });
        deleteOption.addEventListener('click', () => {
            if (colors.length > 1) {
                colors.splice(index, 1);
                saveColors();
                renderColors(app);
            } else {
                Toast.show('至少保留一个颜色', 'warning');
            }
            menu.remove();
        });

        menu.appendChild(setColorOption);
        menu.appendChild(deleteOption);
        document.body.appendChild(menu);

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 0);
    }

    // 渲染颜色
    function renderColors(app) {
        content.innerHTML = '';
        selectedBlock = null;

        colors.forEach((color, index) => {
            const colorBlock = createColorBlock(color, index, app);
            content.appendChild(colorBlock);
        });

        // 添加"+"按钮
        const addBtn = document.createElement('div');
        addBtn.textContent = '+';
        addBtn.style.cssText = `
            width: 20px;
            height: 20px;
            border: 2px dashed #666;
            cursor: pointer;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-size: 18px;
            box-sizing: border-box;
        `;
        addBtn.title = '添加颜色';
        addBtn.addEventListener('click', () => {
            showColorPicker('#000000', -1, app);
        });
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.borderColor = '#999';
            addBtn.style.color = '#dcdcdc';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.borderColor = '#666';
            addBtn.style.color = '#999';
        });
        content.appendChild(addBtn);
    }

    function createPanel(app) {
        loadColors();

        // 创建面板内容
        content = document.createElement('div');
        content.style.cssText = 'padding: 8px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px;';

        renderColors(app);

        // 添加面板
        panel = app.panelManager.addPanel({
            id: 'color-palette',
            title: '调色板',
            content: content,
            onClose: () => {
                panel = null;
                selectedBlock = null;
            }
        });
    }

    function togglePanel(app) {
        if (panel) {
            app.panelManager.removePanel('color-palette');
            panel = null;
        } else {
            createPanel(app);
        }
    }

    function init() {
        const app = window.photoShopApp;
        if (!app) {
            setTimeout(init, 100);
            return;
        }

        // 添加到视图菜单
        app.menuManager.addMenuItem('视图', {
            label: '调色板',
            action: 'toggle-color-palette',
            handler: (app) => {
                togglePanel(app);
            }
        });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
