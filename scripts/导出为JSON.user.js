// ==UserScript==
// @name         PhotoShop - JSON/Sprite导入导出
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  导出/导入JSON格式项目和Sprite动画文件，支持裁切透明区域
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("JSON导入导出脚本开始执行...");

    // 初始化函数
    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.log('PhotoShop应用未加载，等待中...');
            return false;
        }

        console.log('JSON/Sprite导入导出插件已加载');

        // 添加导出JSON菜单项
        app.menuManager.addMenuItem('文件', {
            label: '导出为JSON...',
            action: 'export-json',
            handler: (app) => {
                showExportJsonDialog(app);
            },
            position: 'bottom',
            divider: true
        });

        // 添加导入JSON菜单项
        app.menuManager.addMenuItem('文件', {
            label: '从JSON导入...',
            action: 'import-json',
            handler: (app) => {
                showImportJsonDialog(app);
            },
            position: 'bottom',
            divider: false
        });

        // 添加导出Sprite菜单项
        app.menuManager.addMenuItem('文件', {
            label: '导出为Sprite...',
            action: 'export-sprite',
            handler: (app) => {
                showExportSpriteDialog(app);
            },
            position: 'bottom',
            divider: true
        });

        // 添加导入Sprite菜单项
        app.menuManager.addMenuItem('文件', {
            label: '从Sprite导入...',
            action: 'import-sprite',
            handler: (app) => {
                showImportSpriteDialog(app);
            },
            position: 'bottom',
            divider: false
        });

        return true;
    }

    // 尝试初始化，如果失败则轮询等待
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

    // 如果DOM已经加载完成，直接初始化；否则等待DOMContentLoaded
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    /**
     * 显示导出JSON对话框
     */
    function showExportJsonDialog(app) {
        // 创建对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '400px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '导出为JSON';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';

        // 提示信息
        const info = document.createElement('div');
        info.style.color = '#aaa';
        info.style.fontSize = '12px';
        info.style.marginBottom = '10px';
        info.textContent = '将整个项目导出为JSON格式，图层数据使用base64编码';

        // 裁切选项
        const cropGroup = document.createElement('div');
        cropGroup.style.display = 'flex';
        cropGroup.style.alignItems = 'center';
        cropGroup.style.gap = '10px';

        const cropCheckbox = document.createElement('input');
        cropCheckbox.type = 'checkbox';
        cropCheckbox.id = 'crop-json-checkbox';
        cropCheckbox.checked = true;

        const cropLabel = document.createElement('label');
        cropLabel.htmlFor = 'crop-json-checkbox';
        cropLabel.textContent = '裁切透明区域（推荐）';
        cropLabel.style.color = '#ddd';
        cropLabel.style.cursor = 'pointer';

        cropGroup.appendChild(cropCheckbox);
        cropGroup.appendChild(cropLabel);

        // 仅可见图层选项
        const visibleGroup = document.createElement('div');
        visibleGroup.style.display = 'flex';
        visibleGroup.style.alignItems = 'center';
        visibleGroup.style.gap = '10px';

        const visibleCheckbox = document.createElement('input');
        visibleCheckbox.type = 'checkbox';
        visibleCheckbox.id = 'visible-json-checkbox';
        visibleCheckbox.checked = false;

        const visibleLabel = document.createElement('label');
        visibleLabel.htmlFor = 'visible-json-checkbox';
        visibleLabel.textContent = '仅导出可见图层';
        visibleLabel.style.color = '#ddd';
        visibleLabel.style.cursor = 'pointer';

        visibleGroup.appendChild(visibleCheckbox);
        visibleGroup.appendChild(visibleLabel);

        // 格式化选项
        const formatGroup = document.createElement('div');
        formatGroup.style.display = 'flex';
        formatGroup.style.alignItems = 'center';
        formatGroup.style.gap = '10px';

        const formatCheckbox = document.createElement('input');
        formatCheckbox.type = 'checkbox';
        formatCheckbox.id = 'format-json-checkbox';
        formatCheckbox.checked = false;

        const formatLabel = document.createElement('label');
        formatLabel.htmlFor = 'format-json-checkbox';
        formatLabel.textContent = '格式化JSON（便于阅读）';
        formatLabel.style.color = '#ddd';
        formatLabel.style.cursor = 'pointer';

        formatGroup.appendChild(formatCheckbox);
        formatGroup.appendChild(formatLabel);

        form.appendChild(info);
        form.appendChild(cropGroup);
        form.appendChild(visibleGroup);
        form.appendChild(formatGroup);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '导出';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = async () => {
            const crop = cropCheckbox.checked;
            const visibleOnly = visibleCheckbox.checked;
            const formatted = formatCheckbox.checked;

            // 禁用按钮防止重复点击
            okBtn.disabled = true;
            okBtn.textContent = '导出中...';

            try {
                await exportToJson(app, crop, visibleOnly, formatted);
                document.body.removeChild(overlay);
            } catch (error) {
                console.error('导出失败:', error);
                alert('导出失败: ' + error.message);
                okBtn.disabled = false;
                okBtn.textContent = '导出';
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(form);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // ESC键取消
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * 导出为JSON
     */
    async function exportToJson(app, crop, visibleOnly, formatted) {
        console.log('开始导出JSON...');

        const jsonData = {
            version: '1.0.0',
            width: app.config.width,
            height: app.config.height,
            layers: []
        };

        // 递归处理图层树
        async function processItem(item, depth = 0) {
            // 如果仅导出可见图层，跳过不可见的
            if (visibleOnly && !item.visible) {
                return null;
            }

            if (item.isGroup) {
                // 处理文件夹
                const groupData = {
                    type: 'group',
                    name: item.name,
                    visible: item.visible,
                    opacity: item.opacity,
                    expanded: item.expanded,
                    children: []
                };

                // 递归处理子项
                for (const child of item.children) {
                    const childData = await processItem(child, depth + 1);
                    if (childData) {
                        groupData.children.push(childData);
                    }
                }

                return groupData;
            } else {
                // 处理图层
                const layerData = {
                    type: 'layer',
                    name: item.name,
                    visible: item.visible,
                    opacity: item.opacity
                };

                // 裁切并获取图层数据
                const croppedData = crop ? cropLayerData(item) : getFullLayerData(item);

                // 如果图层全透明，不包含图层数据
                if (croppedData.isEmpty) {
                    console.log(`图层 "${item.name}" 全透明，跳过图层数据`);
                    layerData.isEmpty = true;
                } else {
                    layerData.x = croppedData.x;
                    layerData.y = croppedData.y;
                    layerData.width = croppedData.width;
                    layerData.height = croppedData.height;
                    layerData.data = croppedData.base64;
                }

                return layerData;
            }
        }

        // 处理所有根级图层
        for (const item of app.layerManager.layers) {
            const itemData = await processItem(item);
            if (itemData) {
                jsonData.layers.push(itemData);
            }
        }

        // 生成JSON字符串
        const jsonString = formatted
            ? JSON.stringify(jsonData, null, 2)
            : JSON.stringify(jsonData);

        // 下载JSON文件
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('JSON导出完成');
        alert('JSON导出成功！');
    }

    /**
     * 裁切图层数据
     */
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
            canvas: croppedCanvas  // 添加canvas对象供Sprite导出使用
        };
    }

    /**
     * 获取完整图层数据（不裁切）
     */
    function getFullLayerData(layer) {
        const canvas = layer.canvas;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 检查是否全透明
        let hasContent = false;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
                hasContent = true;
                break;
            }
        }

        if (!hasContent) {
            return { isEmpty: true };
        }

        // 转换为base64
        const base64 = canvas.toDataURL('image/png');

        return {
            isEmpty: false,
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            base64: base64
        };
    }

    /**
     * 显示导入JSON对话框
     */
    function showImportJsonDialog(app) {
        // 创建文件选择器
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const jsonData = JSON.parse(text);

                // 显示导入选项对话框
                showImportOptionsDialog(app, jsonData);
            } catch (error) {
                console.error('读取JSON失败:', error);
                alert('读取JSON失败: ' + error.message);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    /**
     * 显示导入选项对话框
     */
    function showImportOptionsDialog(app, jsonData) {
        // 创建对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '400px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '从JSON导入';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';

        // 项目信息
        const info = document.createElement('div');
        info.style.color = '#aaa';
        info.style.fontSize = '12px';
        info.style.marginBottom = '10px';

        const layerCount = countLayers(jsonData.layers);
        info.innerHTML = `
            <div>项目尺寸: ${jsonData.width} x ${jsonData.height}</div>
            <div>图层数量: ${layerCount}</div>
            <div>版本: ${jsonData.version || '未知'}</div>
        `;

        // 清空现有图层选项
        const clearGroup = document.createElement('div');
        clearGroup.style.display = 'flex';
        clearGroup.style.alignItems = 'center';
        clearGroup.style.gap = '10px';

        const clearCheckbox = document.createElement('input');
        clearCheckbox.type = 'checkbox';
        clearCheckbox.id = 'clear-import-checkbox';
        clearCheckbox.checked = true;

        const clearLabel = document.createElement('label');
        clearLabel.htmlFor = 'clear-import-checkbox';
        clearLabel.textContent = '清空现有图层';
        clearLabel.style.color = '#ddd';
        clearLabel.style.cursor = 'pointer';

        clearGroup.appendChild(clearCheckbox);
        clearGroup.appendChild(clearLabel);

        // 调整画布大小选项
        const resizeGroup = document.createElement('div');
        resizeGroup.style.display = 'flex';
        resizeGroup.style.alignItems = 'center';
        resizeGroup.style.gap = '10px';

        const resizeCheckbox = document.createElement('input');
        resizeCheckbox.type = 'checkbox';
        resizeCheckbox.id = 'resize-import-checkbox';
        resizeCheckbox.checked = true;

        const resizeLabel = document.createElement('label');
        resizeLabel.htmlFor = 'resize-import-checkbox';
        resizeLabel.textContent = '调整画布大小';
        resizeLabel.style.color = '#ddd';
        resizeLabel.style.cursor = 'pointer';

        resizeGroup.appendChild(resizeCheckbox);
        resizeGroup.appendChild(resizeLabel);

        form.appendChild(info);
        form.appendChild(clearGroup);
        form.appendChild(resizeGroup);

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '导入';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = async () => {
            const clearExisting = clearCheckbox.checked;
            const resizeCanvas = resizeCheckbox.checked;

            // 禁用按钮防止重复点击
            okBtn.disabled = true;
            okBtn.textContent = '导入中...';

            try {
                await importFromJson(app, jsonData, clearExisting, resizeCanvas);
                document.body.removeChild(overlay);
            } catch (error) {
                console.error('导入失败:', error);
                alert('导入失败: ' + error.message);
                okBtn.disabled = false;
                okBtn.textContent = '导入';
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(form);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // ESC键取消
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * 统计图层数量
     */
    function countLayers(items) {
        let count = 0;
        for (const item of items) {
            if (item.type === 'layer') {
                count++;
            } else if (item.type === 'group' && item.children) {
                count += countLayers(item.children);
            }
        }
        return count;
    }

    /**
     * 从JSON导入
     */
    async function importFromJson(app, jsonData, clearExisting, resizeCanvas) {
        console.log('开始从JSON导入...');

        // 清空现有图层
        if (clearExisting) {
            app.layerManager.clearLayers();
        }

        // 调整画布大小
        if (resizeCanvas && (jsonData.width !== app.config.width || jsonData.height !== app.config.height)) {
            app.canvasManager.resize(jsonData.width, jsonData.height);
            app.selectionManager.resize(jsonData.width, jsonData.height);
            app.config.width = jsonData.width;
            app.config.height = jsonData.height;
        }

        // 递归导入图层
        async function importItem(itemData, parent = null) {
            if (itemData.type === 'group') {
                // 创建文件夹 - 直接使用构造函数
                const group = {
                    name: itemData.name,
                    visible: itemData.visible,
                    opacity: itemData.opacity,
                    isGroup: true,
                    expanded: itemData.expanded !== undefined ? itemData.expanded : true,
                    children: [],
                    parent: parent
                };

                // 递归导入子项
                if (itemData.children) {
                    for (const childData of itemData.children) {
                        const child = await importItem(childData, group);
                        if (child) {
                            group.children.push(child);
                        }
                    }
                }

                return group;
            } else if (itemData.type === 'layer') {
                // 创建图层 - 直接创建canvas
                const canvas = document.createElement('canvas');
                canvas.width = app.config.width;
                canvas.height = app.config.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.imageSmoothingEnabled = false;

                const layer = {
                    name: itemData.name,
                    visible: itemData.visible,
                    opacity: itemData.opacity,
                    canvas: canvas,
                    ctx: ctx,
                    isGroup: false,
                    parent: parent
                };

                // 如果图层不是空的，加载图像数据
                if (!itemData.isEmpty && itemData.data) {
                    await loadImageToLayer(layer, itemData);
                }

                return layer;
            }

            return null;
        }

        // 导入所有图层
        app.layerManager.layers = [];
        for (const itemData of jsonData.layers) {
            const item = await importItem(itemData);
            if (item) {
                app.layerManager.layers.push(item);
            }
        }

        // 如果没有图层，创建一个默认图层
        if (app.layerManager.layers.length === 0) {
            app.layerManager.addLayer(app.config.width, app.config.height, 'Background');
        }

        // 设置活动图层
        app.layerManager.setActiveLayer(app.layerManager.layers.length - 1);

        // 更新UI
        app.renderLayerList();
        app.render();

        // 保存历史记录
        app.saveHistory();

        console.log('JSON导入完成');
        alert('JSON导入成功！');
    }

    /**
     * 加载图像到图层
     */
    function loadImageToLayer(layer, itemData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // 清空图层
                layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

                // 绘制图像到指定位置
                layer.ctx.drawImage(img, itemData.x, itemData.y, itemData.width, itemData.height);

                resolve();
            };
            img.onerror = () => {
                reject(new Error(`加载图层 "${itemData.name}" 的图像失败`));
            };
            img.src = itemData.data;
        });
    }

    // ==================== Sprite 导入导出功能 ====================

    /**
     * 显示导出Sprite对话框
     */
    function showExportSpriteDialog(app) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '1100px';
        dialog.style.maxHeight = '90vh';
        dialog.style.overflow = 'auto';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '导出为Sprite';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';
        form.style.padding = '15px';

        // 提示信息
        const info = document.createElement('div');
        info.style.color = '#aaa';
        info.style.fontSize = '12px';
        info.style.marginBottom = '10px';
        info.textContent = '将图层结构导出为Sprite动画文件（.sprite + .png）';

        // 说明文本
        const helpText = document.createElement('div');
        helpText.style.color = '#888';
        helpText.style.fontSize = '11px';
        helpText.style.lineHeight = '1.5';
        helpText.style.padding = '10px';
        helpText.style.background = 'rgba(0,0,0,0.2)';
        helpText.style.borderRadius = '4px';
        helpText.innerHTML = `
            <strong>图层结构要求：</strong><br>
            • 每个文件夹代表一个动作(Action)<br>
            • 文件夹内的子文件夹代表帧(Frame)<br>
            • 文件夹内的图层代表单图块帧<br>
            • 子文件夹内的图层代表图块(Tile)
        `;

        // 主内容区域 - 三列布局
        const mainContent = document.createElement('div');
        mainContent.style.display = 'grid';
        mainContent.style.gridTemplateColumns = '1fr 1fr 1fr';
        mainContent.style.gap = '15px';
        mainContent.style.marginTop = '15px';

        // 左侧：原点设置
        const leftPanel = document.createElement('div');

        const originSection = document.createElement('div');
        originSection.style.padding = '15px';
        originSection.style.background = 'rgba(0,0,0,0.1)';
        originSection.style.borderRadius = '4px';

        const originTitle = document.createElement('div');
        originTitle.textContent = '原点设置';
        originTitle.style.fontWeight = 'bold';
        originTitle.style.marginBottom = '10px';
        originTitle.style.color = '#ddd';

        // 预设原点按钮
        const presetButtons = document.createElement('div');
        presetButtons.style.display = 'grid';
        presetButtons.style.gridTemplateColumns = 'repeat(3, 1fr)';
        presetButtons.style.gap = '5px';
        presetButtons.style.marginBottom = '15px';

        const presets = [
            { label: '左上', x: 0, y: 0 },
            { label: '中上', x: 0.5, y: 0 },
            { label: '右上', x: 1, y: 0 },
            { label: '左中', x: 0, y: 0.5 },
            { label: '居中', x: 0.5, y: 0.5 },
            { label: '右中', x: 1, y: 0.5 },
            { label: '左下', x: 0, y: 1 },
            { label: '底部居中', x: 0.5, y: 1 },
            { label: '右下', x: 1, y: 1 }
        ];

        let selectedOrigin = { x: 0.5, y: 1 }; // 默认底部居中

        // 精确输入区域
        const preciseInputSection = document.createElement('div');
        preciseInputSection.style.marginTop = '15px';
        preciseInputSection.style.padding = '10px';
        preciseInputSection.style.background = 'rgba(0,0,0,0.05)';
        preciseInputSection.style.borderRadius = '4px';

        const preciseTitle = document.createElement('div');
        preciseTitle.textContent = '精确输入';
        preciseTitle.style.fontSize = '12px';
        preciseTitle.style.fontWeight = 'bold';
        preciseTitle.style.marginBottom = '10px';
        preciseTitle.style.color = '#ddd';

        const inputRow = document.createElement('div');
        inputRow.style.display = 'grid';
        inputRow.style.gridTemplateColumns = '1fr 1fr';
        inputRow.style.gap = '10px';

        // X输入
        const xInputGroup = document.createElement('div');
        const xLabel = document.createElement('label');
        xLabel.textContent = 'X (0-100%):';
        xLabel.style.fontSize = '11px';
        xLabel.style.color = '#aaa';
        xLabel.style.display = 'block';
        xLabel.style.marginBottom = '5px';

        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.min = '0';
        xInput.max = '100';
        xInput.value = '50';
        xInput.style.width = '100%';
        xInput.style.padding = '8px';
        xInput.style.border = '1px solid #555';
        xInput.style.borderRadius = '4px';
        xInput.style.background = '#2a2a2a';
        xInput.style.color = '#ddd';
        xInput.style.fontSize = '12px';

        xInputGroup.appendChild(xLabel);
        xInputGroup.appendChild(xInput);

        // Y输入
        const yInputGroup = document.createElement('div');
        const yLabel = document.createElement('label');
        yLabel.textContent = 'Y (0-100%):';
        yLabel.style.fontSize = '11px';
        yLabel.style.color = '#aaa';
        yLabel.style.display = 'block';
        yLabel.style.marginBottom = '5px';

        const yInput = document.createElement('input');
        yInput.type = 'number';
        yInput.min = '0';
        yInput.max = '100';
        yInput.value = '100';
        yInput.style.width = '100%';
        yInput.style.padding = '8px';
        yInput.style.border = '1px solid #555';
        yInput.style.borderRadius = '4px';
        yInput.style.background = '#2a2a2a';
        yInput.style.color = '#ddd';
        yInput.style.fontSize = '12px';

        yInputGroup.appendChild(yLabel);
        yInputGroup.appendChild(yInput);

        inputRow.appendChild(xInputGroup);
        inputRow.appendChild(yInputGroup);

        preciseInputSection.appendChild(preciseTitle);
        preciseInputSection.appendChild(inputRow);

        // 原点坐标显示
        const originDisplay = document.createElement('div');
        originDisplay.style.fontSize = '12px';
        originDisplay.style.color = '#aaa';
        originDisplay.style.marginTop = '10px';
        originDisplay.style.textAlign = 'center';

        function updateOriginDisplay() {
            const percentX = Math.round(selectedOrigin.x * 100);
            const percentY = Math.round(selectedOrigin.y * 100);
            originDisplay.textContent = `当前原点: ${percentX}% 横向, ${percentY}% 纵向`;
            xInput.value = percentX;
            yInput.value = percentY;
        }

        function updateOriginFromInputs() {
            const x = Math.max(0, Math.min(100, parseFloat(xInput.value) || 0)) / 100;
            const y = Math.max(0, Math.min(100, parseFloat(yInput.value) || 0)) / 100;
            selectedOrigin = { x, y };
            updateOriginDisplay();
            updatePreview();
            // 清除预设按钮选中状态
            presetButtons.querySelectorAll('button').forEach(b => {
                b.style.background = '#333';
                b.style.borderColor = '#555';
            });
        }

        xInput.addEventListener('input', updateOriginFromInputs);
        yInput.addEventListener('input', updateOriginFromInputs);

        presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.textContent = preset.label;
            btn.style.padding = '8px';
            btn.style.fontSize = '11px';
            btn.style.border = '1px solid #555';
            btn.style.background = '#333';
            btn.style.color = '#ddd';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.onclick = () => {
                selectedOrigin = { x: preset.x, y: preset.y };
                updateOriginDisplay();
                updatePreview();
                // 更新按钮样式
                presetButtons.querySelectorAll('button').forEach(b => {
                    b.style.background = '#333';
                    b.style.borderColor = '#555';
                });
                btn.style.background = '#667eea';
                btn.style.borderColor = '#667eea';
            };
            if (preset.x === 0.5 && preset.y === 1) {
                btn.style.background = '#667eea';
                btn.style.borderColor = '#667eea';
            }
            presetButtons.appendChild(btn);
        });

        updateOriginDisplay();

        originSection.appendChild(originTitle);
        originSection.appendChild(presetButtons);
        originSection.appendChild(preciseInputSection);
        originSection.appendChild(originDisplay);

        leftPanel.appendChild(originSection);

        // 中间：精灵图设置
        const middlePanel = document.createElement('div');

        const spriteSheetSection = document.createElement('div');
        spriteSheetSection.style.padding = '15px';
        spriteSheetSection.style.background = 'rgba(0,0,0,0.1)';
        spriteSheetSection.style.borderRadius = '4px';

        const spriteSheetTitle = document.createElement('div');
        spriteSheetTitle.textContent = '精灵图设置';
        spriteSheetTitle.style.fontWeight = 'bold';
        spriteSheetTitle.style.marginBottom = '10px';
        spriteSheetTitle.style.color = '#ddd';

        // 精灵图尺寸输入
        const dimensionInputs = document.createElement('div');
        dimensionInputs.style.display = 'flex';
        dimensionInputs.style.flexDirection = 'column';
        dimensionInputs.style.gap = '10px';

        // 宽度输入
        const widthGroup = document.createElement('div');
        const widthLabel = document.createElement('label');
        widthLabel.textContent = '宽度 (px):';
        widthLabel.style.fontSize = '11px';
        widthLabel.style.color = '#aaa';
        widthLabel.style.display = 'block';
        widthLabel.style.marginBottom = '5px';

        const widthInput = document.createElement('input');
        widthInput.type = 'number';
        widthInput.min = '64';
        widthInput.max = '8192';
        widthInput.value = '1024';
        widthInput.style.width = '100%';
        widthInput.style.padding = '8px';
        widthInput.style.border = '1px solid #555';
        widthInput.style.borderRadius = '4px';
        widthInput.style.background = '#2a2a2a';
        widthInput.style.color = '#ddd';
        widthInput.style.fontSize = '12px';

        widthGroup.appendChild(widthLabel);
        widthGroup.appendChild(widthInput);

        // 高度输入
        const heightGroup = document.createElement('div');
        const heightLabel = document.createElement('label');
        heightLabel.textContent = '高度 (px):';
        heightLabel.style.fontSize = '11px';
        heightLabel.style.color = '#aaa';
        heightLabel.style.display = 'block';
        heightLabel.style.marginBottom = '5px';

        const heightInput = document.createElement('input');
        heightInput.type = 'number';
        heightInput.min = '64';
        heightInput.max = '8192';
        heightInput.value = '1024';
        heightInput.style.width = '100%';
        heightInput.style.padding = '8px';
        heightInput.style.border = '1px solid #555';
        heightInput.style.borderRadius = '4px';
        heightInput.style.background = '#2a2a2a';
        heightInput.style.color = '#ddd';
        heightInput.style.fontSize = '12px';

        heightGroup.appendChild(heightLabel);
        heightGroup.appendChild(heightInput);

        dimensionInputs.appendChild(widthGroup);
        dimensionInputs.appendChild(heightGroup);

        // 容差设置
        const toleranceGroup = document.createElement('div');
        const toleranceLabel = document.createElement('label');
        toleranceLabel.textContent = '匹配容差 (0-255):';
        toleranceLabel.style.fontSize = '11px';
        toleranceLabel.style.color = '#aaa';
        toleranceLabel.style.display = 'block';
        toleranceLabel.style.marginBottom = '5px';

        const toleranceInput = document.createElement('input');
        toleranceInput.type = 'range';
        toleranceInput.min = '0';
        toleranceInput.max = '255';
        toleranceInput.value = '0';
        toleranceInput.style.width = '100%';
        
        const toleranceValue = document.createElement('span');
        toleranceValue.textContent = '0';
        toleranceValue.style.float = 'right';
        toleranceValue.style.color = '#ddd';
        toleranceValue.style.fontSize = '11px';
        
        toleranceLabel.appendChild(toleranceValue);
        
        toleranceInput.addEventListener('input', (e) => {
            toleranceValue.textContent = e.target.value;
        });
        
        toleranceInput.addEventListener('change', () => {
            initializeSpriteSheet();
        });

        toleranceGroup.appendChild(toleranceLabel);
        toleranceGroup.appendChild(toleranceInput);
        
        dimensionInputs.appendChild(toleranceGroup);

        // 统计信息显示
        const statsDisplay = document.createElement('div');
        statsDisplay.style.marginTop = '15px';
        statsDisplay.style.padding = '10px';
        statsDisplay.style.background = 'rgba(0,0,0,0.05)';
        statsDisplay.style.borderRadius = '4px';
        statsDisplay.style.fontSize = '11px';
        statsDisplay.style.color = '#aaa';
        statsDisplay.innerHTML = `
            <div>图块数量: <span id="tile-count">0</span></div>
            <div>空间利用率: <span id="space-usage">0%</span></div>
        `;

        // 重新生成按钮
        const regenerateBtn = document.createElement('button');
        regenerateBtn.textContent = '重新生成精灵图';
        regenerateBtn.style.marginTop = '10px';
        regenerateBtn.style.padding = '8px 15px';
        regenerateBtn.style.width = '100%';
        regenerateBtn.style.border = 'none';
        regenerateBtn.style.borderRadius = '4px';
        regenerateBtn.style.background = '#667eea';
        regenerateBtn.style.color = 'white';
        regenerateBtn.style.cursor = 'pointer';
        regenerateBtn.style.fontSize = '12px';

        spriteSheetSection.appendChild(spriteSheetTitle);
        spriteSheetSection.appendChild(dimensionInputs);
        spriteSheetSection.appendChild(statsDisplay);
        spriteSheetSection.appendChild(regenerateBtn);

        middlePanel.appendChild(spriteSheetSection);

        // 右侧：预览区域
        const rightPanel = document.createElement('div');

        const previewSection = document.createElement('div');
        previewSection.style.padding = '15px';
        previewSection.style.background = 'rgba(0,0,0,0.1)';
        previewSection.style.borderRadius = '4px';
        previewSection.style.height = '100%';

        const previewTitle = document.createElement('div');
        previewTitle.textContent = '预览';
        previewTitle.style.fontWeight = 'bold';
        previewTitle.style.marginBottom = '10px';
        previewTitle.style.color = '#ddd';

        const previewHint = document.createElement('div');
        previewHint.textContent = '绿色十字标记显示原点位置';
        previewHint.style.fontSize = '11px';
        previewHint.style.color = '#888';
        previewHint.style.marginBottom = '10px';

        const previewCanvasWrapper = document.createElement('div');
        previewCanvasWrapper.style.background = '#222';
        previewCanvasWrapper.style.border = '2px solid #555';
        previewCanvasWrapper.style.borderRadius = '4px';
        previewCanvasWrapper.style.padding = '10px';
        previewCanvasWrapper.style.display = 'flex';
        previewCanvasWrapper.style.justifyContent = 'center';
        previewCanvasWrapper.style.alignItems = 'center';
        previewCanvasWrapper.style.minHeight = '300px';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.style.imageRendering = 'pixelated';
        previewCanvas.style.border = '1px solid #444';

        previewCanvasWrapper.appendChild(previewCanvas);

        previewSection.appendChild(previewTitle);
        previewSection.appendChild(previewHint);
        

        // 添加动作选择和播放控制
        const previewControls = document.createElement('div');
        previewControls.style.display = 'flex';
        previewControls.style.gap = '10px';
        previewControls.style.marginTop = '10px';
        previewControls.style.alignItems = 'center';

        const playBtn = document.createElement('button');
        playBtn.textContent = '▶ 播放';
        playBtn.style.padding = '8px 15px';
        playBtn.style.border = 'none';
        playBtn.style.borderRadius = '4px';
        playBtn.style.background = '#28a745';
        playBtn.style.color = 'white';
        playBtn.style.cursor = 'pointer';
        playBtn.style.fontSize = '12px';

        const pauseBtn = document.createElement('button');
        pauseBtn.textContent = '⏸ 暂停';
        pauseBtn.style.padding = '8px 15px';
        pauseBtn.style.border = 'none';
        pauseBtn.style.borderRadius = '4px';
        pauseBtn.style.background = '#ffc107';
        pauseBtn.style.color = 'white';
        pauseBtn.style.cursor = 'pointer';
        pauseBtn.style.fontSize = '12px';

        const actionSelect = document.createElement('select');
        actionSelect.style.padding = '8px';
        actionSelect.style.border = '1px solid #555';
        actionSelect.style.borderRadius = '4px';
        actionSelect.style.background = '#333';
        actionSelect.style.color = '#ddd';
        actionSelect.style.fontSize = '12px';
        actionSelect.style.flex = '1';

        const frameInfo = document.createElement('div');
        frameInfo.style.fontSize = '12px';
        frameInfo.style.color = '#aaa';
        frameInfo.style.minWidth = '80px';
        frameInfo.textContent = '帧: 0/0';

        previewControls.appendChild(playBtn);
        previewControls.appendChild(pauseBtn);
        previewControls.appendChild(actionSelect);
        previewControls.appendChild(frameInfo);

        previewSection.appendChild(previewControls);
        previewSection.appendChild(previewCanvasWrapper);

        // 精灵图预览区域
        const spriteSheetPreviewSection = document.createElement('div');
        spriteSheetPreviewSection.style.marginTop = '15px';
        spriteSheetPreviewSection.style.padding = '15px';
        spriteSheetPreviewSection.style.background = 'rgba(0,0,0,0.05)';
        spriteSheetPreviewSection.style.borderRadius = '4px';

        const spriteSheetPreviewTitle = document.createElement('div');
        spriteSheetPreviewTitle.textContent = '精灵图预览';
        spriteSheetPreviewTitle.style.fontWeight = 'bold';
        spriteSheetPreviewTitle.style.marginBottom = '10px';
        spriteSheetPreviewTitle.style.color = '#ddd';
        spriteSheetPreviewTitle.style.fontSize = '12px';

        const spriteSheetCanvasWrapper = document.createElement('div');
        spriteSheetCanvasWrapper.style.background = '#222';
        spriteSheetCanvasWrapper.style.border = '2px solid #555';
        spriteSheetCanvasWrapper.style.borderRadius = '4px';
        spriteSheetCanvasWrapper.style.padding = '10px';
        spriteSheetCanvasWrapper.style.display = 'flex';
        spriteSheetCanvasWrapper.style.justifyContent = 'center';
        spriteSheetCanvasWrapper.style.alignItems = 'center';
        spriteSheetCanvasWrapper.style.minHeight = '200px';
        spriteSheetCanvasWrapper.style.maxHeight = '300px';
        spriteSheetCanvasWrapper.style.overflow = 'auto';

        const spriteSheetCanvas = document.createElement('canvas');
        spriteSheetCanvas.style.imageRendering = 'pixelated';
        spriteSheetCanvas.style.border = '1px solid #444';
        spriteSheetCanvas.style.maxWidth = '100%';

        spriteSheetCanvasWrapper.appendChild(spriteSheetCanvas);
        spriteSheetPreviewSection.appendChild(spriteSheetPreviewTitle);
        spriteSheetPreviewSection.appendChild(spriteSheetCanvasWrapper);
        previewSection.appendChild(spriteSheetPreviewSection);

        rightPanel.appendChild(previewSection);

        mainContent.appendChild(leftPanel);
        mainContent.appendChild(middlePanel);
        mainContent.appendChild(rightPanel);

        form.appendChild(info);
        form.appendChild(helpText);
        form.appendChild(mainContent);

        // 收集所有可见的动作
        const visibleActions = app.layerManager.layers.filter(item => item.isGroup && item.visible);

        // 填充动作选择器
        if (visibleActions.length > 0) {
            visibleActions.forEach((action, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${action.name} (${action.children.length} 帧)`;
                actionSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '-1';
            option.textContent = '无可用动作';
            actionSelect.appendChild(option);
        }

        // 收集图块数据
        let collectedTiles = [];
        let spriteSheetData = null;

        // 初始化精灵图
        function initializeSpriteSheet() {
            const tiles = [];
            const tileLookup = new Map();
            const processedTiles = [];
            const tolerance = parseInt(toleranceInput.value) || 0;
            
            const actions = app.layerManager.layers.filter(item => item.isGroup && item.visible);

            // 内部函数：处理单个图层（包含对称检测逻辑，保持与导出一致）
            function processLayer(layer) {
                const tileData = cropLayerData(layer);
                if (tileData.isEmpty) return;
                
                // 检查水平对称
                if (isSymmetric(tileData.canvas, tolerance)) {
                    const halfTile = getHalfTile(tileData.canvas);
                    findOrAddTile(tiles, tileLookup, processedTiles, halfTile, layer.name + '_half', tolerance);
                } else {
                    findOrAddTile(tiles, tileLookup, processedTiles, tileData, layer.name, tolerance);
                }
            }

            for (const actionGroup of actions) {
                for (const child of actionGroup.children) {
                    if (!child.visible) continue;
                    if (child.isGroup) {
                        for (const tileLayer of child.children) {
                            if (!tileLayer.visible || tileLayer.isGroup) continue;
                            processLayer(tileLayer);
                        }
                    } else {
                        processLayer(child);
                    }
                }
            }
            collectedTiles = tiles;
            updateSpriteSheet();
        }

        function updateSpriteSheet() {
            const maxWidth = parseInt(widthInput.value) || 1024;
            const maxHeight = parseInt(heightInput.value) || 1024;
            spriteSheetData = packTiles(collectedTiles, maxWidth, maxHeight);
            renderSpriteSheet();
            updateStats();
        }

        function renderSpriteSheet() {
            if (!spriteSheetData) return;
            spriteSheetCanvas.width = spriteSheetData.width;
            spriteSheetCanvas.height = spriteSheetData.height;
            const ctx = spriteSheetCanvas.getContext('2d');
            ctx.clearRect(0, 0, spriteSheetData.width, spriteSheetData.height);

            collectedTiles.forEach(tile => {
                if (tile.canvas) {
                    ctx.drawImage(tile.canvas, tile.x, tile.y);
                }
            });
        }

        function updateStats() {
            const tileCountEl = statsDisplay.querySelector('#tile-count');
            const spaceUsageEl = statsDisplay.querySelector('#space-usage');
            if (tileCountEl) tileCountEl.textContent = collectedTiles.length;
            if (spaceUsageEl && spriteSheetData) {
                const totalArea = spriteSheetData.width * spriteSheetData.height;
                const usedArea = collectedTiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);
                const usage = totalArea > 0 ? Math.round((usedArea / totalArea) * 100) : 0;
                spaceUsageEl.textContent = usage + '%';
            }
        }

        regenerateBtn.onclick = updateSpriteSheet;

        // 预览播放器
        const previewPlayer = {
            currentActionIndex: 0,
            currentFrameIndex: 0,
            isPlaying: false,
            animationTimer: null,
            scale: 2,

            init() {
                initializeSpriteSheet();
                this.renderFrame();
            },

            getFrameData(actionIndex, frameIndex) {
                if (visibleActions.length === 0) return null;
                const action = visibleActions[actionIndex];
                if (!action || !action.children || action.children.length === 0) return null;

                const frame = action.children[frameIndex];
                if (!frame) return null;

                // 收集帧的所有图层
                const layers = [];
                if (frame.isGroup) {
                    // 多图块帧
                    frame.children.forEach(layer => {
                        if (!layer.visible || layer.isGroup) return;
                        const tileData = cropLayerData(layer);
                        if (!tileData.isEmpty) {
                            layers.push({ ...tileData, name: layer.name });
                        }
                    });
                } else {
                    // 单图块帧
                    if (frame.visible) {
                        const tileData = cropLayerData(frame);
                        if (!tileData.isEmpty) {
                            layers.push({ ...tileData, name: frame.name });
                        }
                    }
                }

                if (layers.length === 0) return null;

                // 计算帧边界
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;

                layers.forEach(layer => {
                    minX = Math.min(minX, layer.x);
                    minY = Math.min(minY, layer.y);
                    maxX = Math.max(maxX, layer.x + layer.width);
                    maxY = Math.max(maxY, layer.y + layer.height);
                });

                return {
                    layers,
                    minX,
                    minY,
                    maxX,
                    maxY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            },

            renderFrame() {
                const ctx = previewCanvas.getContext('2d');

                if (visibleActions.length === 0) {
                    previewCanvas.width = 100;
                    previewCanvas.height = 100;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(0, 0, 100, 100);
                    ctx.fillStyle = '#666';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('无可预览内容', 50, 50);
                    frameInfo.textContent = '帧: 0/0';
                    return;
                }

                const action = visibleActions[this.currentActionIndex];
                if (!action) return;

                const frameData = this.getFrameData(this.currentActionIndex, this.currentFrameIndex);
                if (!frameData) {
                    previewCanvas.width = 100;
                    previewCanvas.height = 100;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(0, 0, 100, 100);
                    ctx.fillStyle = '#666';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('帧无内容', 50, 50);
                    frameInfo.textContent = `帧: ${this.currentFrameIndex + 1}/${action.children.length}`;
                    return;
                }

                // 设置画布大小
                previewCanvas.width = frameData.width;
                previewCanvas.height = frameData.height;
                previewCanvas.style.width = (frameData.width * this.scale) + 'px';
                previewCanvas.style.height = (frameData.height * this.scale) + 'px';

                ctx.clearRect(0, 0, frameData.width, frameData.height);

                // 绘制图层
                frameData.layers.forEach(layer => {
                    ctx.drawImage(
                        layer.canvas,
                        layer.x - frameData.minX,
                        layer.y - frameData.minY,
                        layer.width,
                        layer.height
                    );
                });

                // 计算并绘制原点标记
                const originX = Math.round(frameData.width * selectedOrigin.x);
                const originY = Math.round(frameData.height * selectedOrigin.y);

                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;

                // 绘制十字
                ctx.beginPath();
                ctx.moveTo(originX - 10, originY);
                ctx.lineTo(originX + 10, originY);
                ctx.moveTo(originX, originY - 10);
                ctx.lineTo(originX, originY + 10);
                ctx.stroke();

                // 绘制圆圈
                ctx.beginPath();
                ctx.arc(originX, originY, 5, 0, Math.PI * 2);
                ctx.stroke();

                // 更新帧信息
                frameInfo.textContent = `帧: ${this.currentFrameIndex + 1}/${action.children.length}`;
            },

            play() {
                if (this.isPlaying) return;
                if (visibleActions.length === 0) return;

                this.isPlaying = true;
                this.animate();
            },

            pause() {
                this.isPlaying = false;
                if (this.animationTimer) {
                    clearTimeout(this.animationTimer);
                    this.animationTimer = null;
                }
            },

            animate() {
                if (!this.isPlaying) return;
                if (visibleActions.length === 0) return;

                const action = visibleActions[this.currentActionIndex];
                if (!action || action.children.length === 0) return;

                this.renderFrame();

                this.currentFrameIndex++;
                if (this.currentFrameIndex >= action.children.length) {
                    this.currentFrameIndex = 0;
                }

                this.animationTimer = setTimeout(() => this.animate(), 100);
            },

            changeAction(actionIndex) {
                this.pause();
                this.currentActionIndex = actionIndex;
                this.currentFrameIndex = 0;
                this.renderFrame();
            }
        };

        // 预览控制事件
        playBtn.onclick = () => previewPlayer.play();
        pauseBtn.onclick = () => previewPlayer.pause();
        actionSelect.onchange = (e) => {
            const index = parseInt(e.target.value);
            if (index >= 0) {
                previewPlayer.changeAction(index);
            }
        };

        // 初始化预览
        previewPlayer.init();

        // 更新预览函数（用于原点改变时）
        function updatePreview() {
            previewPlayer.renderFrame();
        }

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '导出';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = async () => {
            okBtn.disabled = true;
            okBtn.textContent = '导出中...';

            try {
                const maxWidth = parseInt(widthInput.value) || 1024;
                const maxHeight = parseInt(heightInput.value) || 1024;
                const tolerance = parseInt(toleranceInput.value) || 0;
                await exportToSprite(app, selectedOrigin, collectedTiles, maxWidth, maxHeight, tolerance);
                document.body.removeChild(overlay);
            } catch (error) {
                console.error('导出失败:', error);
                alert('导出失败: ' + error.message);
                okBtn.disabled = false;
                okBtn.textContent = '导出';
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(form);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    // ==================== Sprite 导出优化辅助函数 ====================

    // 变换常量
    const TRANS_NONE = 0;
    const TRANS_MIRROR_ROT180 = 1; // Flip Y
    const TRANS_MIRROR = 2;        // Flip X
    const TRANS_ROT180 = 3;
    const TRANS_MIRROR_ROT270 = 4;
    const TRANS_ROT90 = 5;
    const TRANS_ROT270 = 6;
    const TRANS_MIRROR_ROT90 = 7;

    // 镜像复合映射表 (FlipX 复合 T)
    // 索引 i 的值表示: 先应用变换 i，再应用水平镜像(Mirror)后的等效变换代码
    const MIRROR_COMPOSE_MAP = [2, 3, 0, 1, 5, 4, 7, 6];

    /**
     * 生成变换后的 Canvas
     */
    function createTransformedCanvas(sourceCanvas, transform) {
        if (transform === TRANS_NONE) return sourceCanvas;

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        // 4,5,6,7 涉及90/270度旋转，宽高互换
        const isRotated = (transform >= 4); 
        
        const newWidth = isRotated ? height : width;
        const newHeight = isRotated ? width : height;
        
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        
        ctx.save();
        // 移动原点到中心
        ctx.translate(newWidth / 2, newHeight / 2);
        
        switch (transform) {
            case TRANS_MIRROR_ROT180: // Flip Y
                ctx.scale(1, -1);
                break;
            case TRANS_MIRROR: // Flip X
                ctx.scale(-1, 1);
                break;
            case TRANS_ROT180:
                ctx.rotate(Math.PI);
                break;
            case TRANS_MIRROR_ROT270:
                ctx.scale(-1, 1);
                ctx.rotate(Math.PI * 1.5);
                break;
            case TRANS_ROT90:
                ctx.rotate(Math.PI * 0.5);
                break;
            case TRANS_ROT270:
                ctx.rotate(Math.PI * 1.5);
                break;
            case TRANS_MIRROR_ROT90:
                ctx.scale(-1, 1);
                ctx.rotate(Math.PI * 0.5);
                break;
        }
        
        // 绘制图片（居中）
        ctx.drawImage(sourceCanvas, -width / 2, -height / 2);
        ctx.restore();
        
        return canvas;
    }

    /**
     * 比较两个 Canvas 是否相同（支持容差）
     */
    function compareCanvas(canvas1, canvas2, tolerance = 0) {
        if (canvas1.width !== canvas2.width || canvas1.height !== canvas2.height) {
            return false;
        }

        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');
        
        const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;
        const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;
        
        for (let i = 0; i < data1.length; i += 4) {
            // 快速检查透明度
            if (Math.abs(data1[i+3] - data2[i+3]) > tolerance) return false;
            
            // 如果完全透明，忽略 RGB 差异
            if (data1[i+3] === 0 && data2[i+3] === 0) continue;
            
            if (Math.abs(data1[i] - data2[i]) > tolerance ||
                Math.abs(data1[i+1] - data2[i+1]) > tolerance ||
                Math.abs(data1[i+2] - data2[i+2]) > tolerance) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 检查图片是否水平对称（支持容差）
     */
    function isSymmetric(canvas, tolerance = 0) {
        const width = canvas.width;
        const height = canvas.height;
        
        // 如果太小，没必要拆分
        if (width < 4) return false;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // 检查每一行
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < Math.floor(width / 2); x++) {
                const leftIdx = (y * width + x) * 4;
                const rightIdx = (y * width + (width - 1 - x)) * 4;
                
                // 比较 Alpha
                if (Math.abs(data[leftIdx+3] - data[rightIdx+3]) > tolerance) return false;
                
                // 如果完全透明，忽略 RGB
                if (data[leftIdx+3] === 0 && data[rightIdx+3] === 0) continue;

                // 比较 RGB
                if (Math.abs(data[leftIdx] - data[rightIdx]) > tolerance ||
                    Math.abs(data[leftIdx+1] - data[rightIdx+1]) > tolerance ||
                    Math.abs(data[leftIdx+2] - data[rightIdx+2]) > tolerance) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * 获取左半部分图块
     */
    function getHalfTile(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        const halfWidth = Math.ceil(width / 2);
        
        const newCanvas = document.createElement('canvas');
        newCanvas.width = halfWidth;
        newCanvas.height = height;
        const ctx = newCanvas.getContext('2d');
        
        ctx.drawImage(canvas, 0, 0);
        
        return {
            canvas: newCanvas,
            width: halfWidth,
            height: height,
            base64: newCanvas.toDataURL('image/png')
        };
    }

    /**
     * 导出为Sprite
     */
    async function exportToSprite(app, origin, tiles, maxWidth, maxHeight, tolerance = 0) {
        console.log('开始导出Sprite...', '原点:', origin, '容差:', tolerance);

        // 清空传入的 tiles 数组，重新构建
        tiles.length = 0;

        // 收集所有动作文件夹
        const actions = [];
        for (const item of app.layerManager.layers) {
            if (item.isGroup && item.visible) {
                actions.push(item);
            }
        }

        if (actions.length === 0) {
            throw new Error('没有找到可导出的动作文件夹（需要可见的文件夹）');
        }

        // 处理每个动作
        const spriteActions = [];
        // tileLookup 存储 base64 -> { index, transform }
        // 注意：当使用容差时，base64 查找可能失效，需要遍历比较
        const tileLookup = new Map();
        // 存储所有已处理的 tile 数据用于容差比较
        const processedTiles = []; 

        // 内部函数：处理单个图层，返回 FrameTile 数组
        function processLayer(layer) {
            const tileData = cropLayerData(layer);
            if (tileData.isEmpty) return [];
            
            const result = [];
            
            // 优化1：检查水平对称
            if (isSymmetric(tileData.canvas, tolerance)) {
                console.log(`[优化] 检测到图层 '${layer.name}' 水平对称，拆分为半宽图块`);
                const halfTile = getHalfTile(tileData.canvas);
                
                // 查找或添加左半边图块
                const match = findOrAddTile(tiles, tileLookup, processedTiles, halfTile, layer.name + '_half', tolerance);
                
                // 添加左半边 FrameTile
                result.push({
                    tileIndex: match.index,
                    x: tileData.x,
                    y: tileData.y,
                    transform: match.transform
                });
                
                // 添加右半边 FrameTile (镜像)
                const rightX = tileData.x + (tileData.width - halfTile.width);
                // 计算右半边的变换: Mirror 复合 match.transform
                const rightTransform = MIRROR_COMPOSE_MAP[match.transform];
                
                result.push({
                    tileIndex: match.index,
                    x: rightX,
                    y: tileData.y,
                    transform: rightTransform
                });
                
            } else {
                // 优化2：查找变换匹配
                const match = findOrAddTile(tiles, tileLookup, processedTiles, tileData, layer.name, tolerance);
                result.push({
                    tileIndex: match.index,
                    x: tileData.x,
                    y: tileData.y,
                    transform: match.transform
                });
            }
            
            return result;
        }

        for (const actionGroup of actions) {
            const frames = [];

            for (const child of actionGroup.children) {
                if (!child.visible) continue;

                if (child.isGroup) {
                    // 多图块帧
                    const frameTiles = [];
                    for (const tileLayer of child.children) {
                        if (!tileLayer.visible || tileLayer.isGroup) continue;
                        const layerTiles = processLayer(tileLayer);
                        frameTiles.push(...layerTiles);
                    }

                    if (frameTiles.length > 0) {
                        frames.push({ tiles: frameTiles });
                    }
                } else {
                    // 单图块帧
                    const layerTiles = processLayer(child);
                    if (layerTiles.length > 0) {
                        frames.push({ tiles: layerTiles });
                    }
                }
            }

            if (frames.length > 0) {
                spriteActions.push({
                    name: actionGroup.name,
                    frames: frames
                });
            }
        }

        if (tiles.length === 0) {
            throw new Error('没有找到可导出的图块');
        }

        // 生成精灵图
        const spriteSheet = await generateSpriteSheet(tiles, maxWidth, maxHeight);

        // 直接下载文件
        await downloadSpriteFiles(spriteSheet, tiles, spriteActions, origin);
        alert('Sprite文件导出成功！');
    }

    /**
     * 查找或添加图块（支持变换检测和容差）
     */
    function findOrAddTile(tiles, tileLookup, processedTiles, tileData, layerName, tolerance) {
        // 1. 如果容差为0，尝试快速 base64 查找
        if (tolerance === 0 && tileLookup.has(tileData.base64)) {
            const match = tileLookup.get(tileData.base64);
            if (match.transform !== TRANS_NONE) {
                console.log(`[优化] 图层 '${layerName}' 匹配到现有图块 (变换: ${match.transform})`);
            }
            return match;
        }
        
        // 2. 遍历已处理的图块进行比较（支持容差）
        // processedTiles 存储结构: { index, canvas, variants: [{transform, canvas}] }
        for (const existing of processedTiles) {
            // 首先比较原始尺寸
            if (existing.canvas.width === tileData.width && existing.canvas.height === tileData.height) {
                if (compareCanvas(existing.canvas, tileData.canvas, tolerance)) {
                    // 匹配到原始图块
                    return { index: existing.index, transform: TRANS_NONE };
                }
            }
            
            // 比较变换变体
            for (const variant of existing.variants) {
                if (variant.canvas.width === tileData.width && variant.canvas.height === tileData.height) {
                    if (compareCanvas(variant.canvas, tileData.canvas, tolerance)) {
                        console.log(`[优化] 图层 '${layerName}' 匹配到现有图块 (变换: ${variant.transform}, 容差: ${tolerance})`);
                        return { index: existing.index, transform: variant.transform };
                    }
                }
            }
        }
        
        // 3. 如果没找到，这是一个全新的 tile
        const index = tiles.length;
        
        // 添加到 tiles 列表
        tiles.push({
            width: tileData.width,
            height: tileData.height,
            canvas: tileData.canvas,
            name: layerName
        });
        
        // 生成所有变换变体，用于后续比较
        const variants = [];
        for (let t = 1; t <= 7; t++) {
            const transformedCanvas = createTransformedCanvas(tileData.canvas, t);
            variants.push({ transform: t, canvas: transformedCanvas });
            
            // 同时也更新快速查找表（仅当容差为0时有效）
            if (tolerance === 0) {
                const base64 = transformedCanvas.toDataURL('image/png');
                if (!tileLookup.has(base64)) {
                    tileLookup.set(base64, { index: index, transform: t });
                }
            }
        }
        
        // 记录到已处理列表
        processedTiles.push({
            index: index,
            canvas: tileData.canvas,
            variants: variants
        });
        
        // 更新快速查找表
        if (tolerance === 0) {
            tileLookup.set(tileData.base64, { index: index, transform: TRANS_NONE });
        }
        
        return { index: index, transform: TRANS_NONE };
    }

    /**
     * 紧凑打包算法 - 使用货架算法(Shelf Algorithm)
     */
    function packTiles(tiles, maxWidth, maxHeight) {
        if (tiles.length === 0) return { width: 0, height: 0 };

        // 按高度降序排序以获得更好的打包效果
        const sortedTiles = [...tiles].sort((a, b) => b.height - a.height);

        let currentX = 0;
        let currentY = 0;
        let shelfHeight = 0;
        let actualWidth = 0;
        let actualHeight = 0;

        for (const tile of sortedTiles) {
            // 如果当前行放不下，换到下一行
            if (currentX + tile.width > maxWidth) {
                currentX = 0;
                currentY += shelfHeight;
                shelfHeight = 0;
            }

            // 检查是否超出高度限制
            if (currentY + tile.height > maxHeight) {
                console.warn('精灵图空间不足，部分图块可能被截断');
                break;
            }

            // 放置图块
            tile.x = currentX;
            tile.y = currentY;

            currentX += tile.width;
            shelfHeight = Math.max(shelfHeight, tile.height);
            actualWidth = Math.max(actualWidth, currentX);
            actualHeight = Math.max(actualHeight, currentY + tile.height);
        }

        return { width: actualWidth, height: actualHeight };
    }

    /**
     * 生成精灵图
     */
    async function generateSpriteSheet(tiles, maxWidth = 4096, maxHeight = 4096) {
        const packResult = packTiles(tiles, maxWidth, maxHeight);

        const canvas = document.createElement('canvas');
        canvas.width = packResult.width;
        canvas.height = packResult.height;
        const ctx = canvas.getContext('2d');

        for (const tile of tiles) {
            if (tile.canvas && tile.x !== undefined && tile.y !== undefined) {
                ctx.drawImage(tile.canvas, tile.x, tile.y);
            }
        }

        return canvas;
    }

    /**
     * 下载Sprite文件
     */
    async function downloadSpriteFiles(spriteSheet, tiles, actions, origin) {
        const timestamp = Date.now();

        // 下载PNG图片
        const pngBlob = await new Promise(resolve => spriteSheet.toBlob(resolve, 'image/png'));
        const pngUrl = URL.createObjectURL(pngBlob);
        const pngLink = document.createElement('a');
        pngLink.href = pngUrl;
        pngLink.download = `sprite_${timestamp}.png`;
        document.body.appendChild(pngLink);
        pngLink.click();
        document.body.removeChild(pngLink);
        URL.revokeObjectURL(pngUrl);

        // 生成Sprite文件
        const spriteData = generateSpriteFile(tiles, actions, origin);
        const spriteBlob = new Blob([spriteData], { type: 'application/octet-stream' });
        const spriteUrl = URL.createObjectURL(spriteBlob);
        const spriteLink = document.createElement('a');
        spriteLink.href = spriteUrl;
        spriteLink.download = `sprite_${timestamp}.sprite`;
        document.body.appendChild(spriteLink);
        spriteLink.click();
        document.body.removeChild(spriteLink);
        URL.revokeObjectURL(spriteUrl);
    }

    /**
     * 生成Sprite文件数据
     */
    function generateSpriteFile(tiles, actions, origin) {
        const buffer = [];

        // 写入头部
        writeInt32(buffer, 0x53505258); // "SPRX"
        writeUint8(buffer, 34); // version 3.3
        writeUint8(buffer, 1); // byte sequence (SPX_BYTE_SEQUENCE_JAVA)
        writeInt32(buffer, tiles.length); // tile count

        // 写入图块数据
        for (const tile of tiles) {
            writeInt16(buffer, tile.x);
            writeInt16(buffer, tile.y);
            writeInt16(buffer, tile.width);
            writeInt16(buffer, tile.height);
        }

        // 计算所有帧并应用原点偏移
        const allFrames = [];
        for (const action of actions) {
            for (const frame of action.frames) {
                // 计算帧边界
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;

                for (const frameTile of frame.tiles) {
                    const tile = tiles[frameTile.tileIndex];
                    const x1 = frameTile.x;
                    const y1 = frameTile.y;
                    const x2 = x1 + tile.width;
                    const y2 = y1 + tile.height;

                    minX = Math.min(minX, x1);
                    minY = Math.min(minY, y1);
                    maxX = Math.max(maxX, x2);
                    maxY = Math.max(maxY, y2);
                }

                // 计算原点偏移 xldebug
                // const frameWidth = maxX - minX;
                // const frameHeight = maxY - minY;
                const app = window.photoShopApp;
                const originX = Math.round(app.canvasManager.width * origin.x);
                const originY = Math.round(app.canvasManager.height * origin.y);

                // 应用原点偏移到所有图块
                const adjustedTiles = frame.tiles.map(frameTile => ({
                    tileIndex: frameTile.tileIndex,
                    x: frameTile.x  - originX,
                    y: frameTile.y  - originY,
                    transform: frameTile.transform
                }));

                // 重新计算边界
                let newMinX = Infinity, newMinY = Infinity;
                let newMaxX = -Infinity, newMaxY = -Infinity;

                for (const frameTile of adjustedTiles) {
                    const tile = tiles[frameTile.tileIndex];
                    const x1 = frameTile.x;
                    const y1 = frameTile.y;
                    const x2 = x1 + tile.width;
                    const y2 = y1 + tile.height;

                    newMinX = Math.min(newMinX, x1);
                    newMinY = Math.min(newMinY, y1);
                    newMaxX = Math.max(newMaxX, x2);
                    newMaxY = Math.max(newMaxY, y2);
                }

                allFrames.push({
                    tiles: adjustedTiles,
                    top: newMinY,
                    bottom: newMaxY,
                    left: newMinX,
                    right: newMaxX
                });
            }
        }

        // 写入帧数量
        writeInt32(buffer, allFrames.length);

        // 写入帧数据
        for (const frame of allFrames) {
            writeInt32(buffer, frame.tiles.length); // tile count
            writeInt32(buffer, 0); // collision count
            writeInt32(buffer, 0); // reference point count

            // 帧位置
            writeInt16(buffer, frame.top);
            writeInt16(buffer, frame.bottom);
            writeInt16(buffer, frame.left);
            writeInt16(buffer, frame.right);

            // 帧图块
            for (const frameTile of frame.tiles) {
                writeInt16(buffer, frameTile.tileIndex);
                writeInt16(buffer, frameTile.x);
                writeInt16(buffer, frameTile.y);
                writeInt16(buffer, frameTile.transform || 0); // transform
            }
        }

        // 写入动作数据
        writeInt32(buffer, actions.length);

        let frameOffset = 0;
        for (const action of actions) {
            writeInt32(buffer, action.frames.length); // sequence length
            writeUint8(buffer, 0); // no delay
            writeInt32(buffer, 0); // transform

            // 写入帧索引
            for (let i = 0; i < action.frames.length; i++) {
                writeInt16(buffer, frameOffset + i);
            }

            frameOffset += action.frames.length;
        }

        return new Uint8Array(buffer);
    }

    /**
     * 写入Int32 (大端序)
     */
    function writeInt32(buffer, value) {
        buffer.push((value >> 24) & 0xFF);
        buffer.push((value >> 16) & 0xFF);
        buffer.push((value >> 8) & 0xFF);
        buffer.push(value & 0xFF);
    }

    /**
     * 写入Int16 (大端序)
     */
    function writeInt16(buffer, value) {
        buffer.push((value >> 8) & 0xFF);
        buffer.push(value & 0xFF);
    }

    /**
     * 写入Uint8
     */
    function writeUint8(buffer, value) {
        buffer.push(value & 0xFF);
    }

    /**
     * 显示导入Sprite对话框
     */
    function showImportSpriteDialog(app) {
        // 创建文件选择器
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.sprite,.png,.jpg,.jpeg';  // 允许选择sprite和图片文件
        fileInput.multiple = true;  // 允许多选
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            // 查找sprite和png文件
            const spriteFile = files.find(f => f.name.endsWith('.sprite'));
            const pngFile = files.find(f => f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'));

            if (!spriteFile) {
                alert('请选择.sprite文件');
                return;
            }

            if (!pngFile) {
                alert('请同时选择对应的图片文件');
                return;
            }

            try {
                const spriteData = await spriteFile.arrayBuffer();
                const image = await loadImage(pngFile);
                const parsedData = parseSpriteFile(new Uint8Array(spriteData));

                // 显示导入配置对话框
                showImportConfigDialog(app, parsedData, image);
            } catch (error) {
                console.error('导入失败:', error);
                alert('导入失败: ' + error.message);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    /**
     * 显示导入配置对话框
     */
    function showImportConfigDialog(app, spriteData, image) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '800px';
        dialog.style.maxHeight = '90vh';
        dialog.style.overflow = 'auto';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '导入Sprite配置';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';
        form.style.padding = '15px';

        // 计算画布大小（从所有帧的边界取最大值）
        let maxLeft = 0, maxTop = 0, maxRight = 0, maxBottom = 0;
        spriteData.actions.forEach(action => {
            action.frames.forEach(frameData => {
                const frame = spriteData.frames[frameData.frameIndex];
                maxLeft = Math.min(maxLeft, frame.left);
                maxTop = Math.min(maxTop, frame.top);
                maxRight = Math.max(maxRight, frame.right);
                maxBottom = Math.max(maxBottom, frame.bottom);
            });
        });
        const canvasWidth = maxRight - maxLeft;
        const canvasHeight = maxBottom - maxTop;

        // 文件信息
        const info = document.createElement('div');
        info.style.color = '#aaa';
        info.style.fontSize = '12px';
        info.style.marginBottom = '10px';
        info.innerHTML = `
            <div>图块数量: ${spriteData.tiles.length}</div>
            <div>帧数量: ${spriteData.frames.length}</div>
            <div>动作数量: ${spriteData.actions.length}</div>
            <div>画布大小: ${canvasWidth} x ${canvasHeight}</div>
        `;

        // 精灵预览区域
        const previewSection = document.createElement('div');
        previewSection.style.padding = '15px';
        previewSection.style.background = 'rgba(0,0,0,0.1)';
        previewSection.style.borderRadius = '4px';

        const previewTitle = document.createElement('div');
        previewTitle.textContent = '精灵预览';
        previewTitle.style.fontWeight = 'bold';
        previewTitle.style.marginBottom = '10px';
        previewTitle.style.color = '#ddd';

        const previewHint = document.createElement('div');
        previewHint.textContent = '红色框显示帧边界，绿色十字标记显示原点位置(0,0)';
        previewHint.style.fontSize = '11px';
        previewHint.style.color = '#888';
        previewHint.style.marginBottom = '10px';

        const previewCanvasWrapper = document.createElement('div');
        previewCanvasWrapper.style.position = 'relative';
        previewCanvasWrapper.style.display = 'inline-block';
        previewCanvasWrapper.style.background = '#222';
        previewCanvasWrapper.style.border = '2px solid #555';
        previewCanvasWrapper.style.borderRadius = '4px';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.style.display = 'block';
        previewCanvas.style.imageRendering = 'pixelated';

        previewCanvasWrapper.appendChild(previewCanvas);

        const previewControls = document.createElement('div');
        previewControls.style.display = 'flex';
        previewControls.style.gap = '10px';
        previewControls.style.marginTop = '10px';
        previewControls.style.alignItems = 'center';

        const playBtn = document.createElement('button');
        playBtn.textContent = '▶ 播放';
        playBtn.style.padding = '8px 15px';
        playBtn.style.border = 'none';
        playBtn.style.borderRadius = '4px';
        playBtn.style.background = '#28a745';
        playBtn.style.color = 'white';
        playBtn.style.cursor = 'pointer';
        playBtn.style.fontSize = '12px';

        const pauseBtn = document.createElement('button');
        pauseBtn.textContent = '⏸ 暂停';
        pauseBtn.style.padding = '8px 15px';
        pauseBtn.style.border = 'none';
        pauseBtn.style.borderRadius = '4px';
        pauseBtn.style.background = '#ffc107';
        pauseBtn.style.color = 'white';
        pauseBtn.style.cursor = 'pointer';
        pauseBtn.style.fontSize = '12px';

        const actionSelect = document.createElement('select');
        actionSelect.style.padding = '8px';
        actionSelect.style.border = '1px solid #555';
        actionSelect.style.borderRadius = '4px';
        actionSelect.style.background = '#333';
        actionSelect.style.color = '#ddd';
        actionSelect.style.fontSize = '12px';
        actionSelect.style.flex = '1';

        spriteData.actions.forEach((action, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `动作 ${index + 1} (${action.frames.length} 帧)`;
            actionSelect.appendChild(option);
        });

        const frameInfo = document.createElement('div');
        frameInfo.style.fontSize = '12px';
        frameInfo.style.color = '#aaa';
        frameInfo.style.minWidth = '80px';
        frameInfo.textContent = '帧: 1/1';

        previewControls.appendChild(playBtn);
        previewControls.appendChild(pauseBtn);
        previewControls.appendChild(actionSelect);
        previewControls.appendChild(frameInfo);


        previewSection.appendChild(previewTitle);
        previewSection.appendChild(previewHint);
        previewSection.appendChild(previewCanvasWrapper);
        previewSection.appendChild(previewControls);

        form.appendChild(info);
        form.appendChild(previewSection);

        // 初始化预览播放器
        const previewPlayer = {
            currentAction: 0,
            currentFrameIndex: 0,
            isPlaying: false,
            animationTimer: null,
            scale: 2,

            init() {
                this.updateCanvas();
                this.renderFrame();
            },

            updateCanvas() {
                // 使用计算出的画布大小
                previewCanvas.width = canvasWidth;
                previewCanvas.height = canvasHeight;
                previewCanvas.style.width = (canvasWidth * this.scale) + 'px';
                previewCanvas.style.height = (canvasHeight * this.scale) + 'px';
            },

            renderFrame() {
                const ctx = previewCanvas.getContext('2d');
                const action = spriteData.actions[this.currentAction];
                if (!action || action.frames.length === 0) return;

                const frameData = action.frames[this.currentFrameIndex];
                const frame = spriteData.frames[frameData.frameIndex];

                ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

                // 绘制图块（基于原点坐标系，原点在0,0）
                frame.tiles.forEach(tile => {
                    const tileData = spriteData.tiles[tile.tileIndex];
                    if (!tileData) return;

                    // tile.x 和 tile.y 是基于原点的坐标
                    // 需要转换到画布坐标系（原点在左上角）
                    const x = tile.x - maxLeft;
                    const y = tile.y - maxTop;

                    // 检查是否有变换
                    const transform = tile.transform || 0;
                    
                    if (transform === 0) {
                        ctx.drawImage(
                            image,
                            tileData.x, tileData.y, tileData.width, tileData.height,
                            x, y, tileData.width, tileData.height
                        );
                    } else {
                        // 创建临时 Canvas 截取图块
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = tileData.width;
                        tempCanvas.height = tileData.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.drawImage(
                            image,
                            tileData.x, tileData.y, tileData.width, tileData.height,
                            0, 0, tileData.width, tileData.height
                        );
                        
                        // 应用变换
                        const transformedCanvas = createTransformedCanvas(tempCanvas, transform);
                        
                        // 绘制变换后的图块
                        ctx.drawImage(transformedCanvas, x, y);
                    }
                });

                // 绘制帧边界（红色框）
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    frame.left - maxLeft,
                    frame.top - maxTop,
                    frame.right - frame.left,
                    frame.bottom - frame.top
                );

                // 绘制原点标记（原点在0,0，转换到画布坐标系）
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                const originX = -maxLeft;
                const originY = -maxTop;

                // 绘制十字标记
                ctx.beginPath();
                ctx.moveTo(originX - 10, originY);
                ctx.lineTo(originX + 10, originY);
                ctx.moveTo(originX, originY - 10);
                ctx.lineTo(originX, originY + 10);
                ctx.stroke();

                // 绘制原点圆圈
                ctx.beginPath();
                ctx.arc(originX, originY, 5, 0, Math.PI * 2);
                ctx.stroke();

                // 更新帧信息
                frameInfo.textContent = `帧: ${this.currentFrameIndex + 1}/${action.frames.length}`;
            },

            play() {
                if (this.isPlaying) return;
                this.isPlaying = true;
                this.animate();
            },

            pause() {
                this.isPlaying = false;
                if (this.animationTimer) {
                    clearTimeout(this.animationTimer);
                    this.animationTimer = null;
                }
            },

            animate() {
                if (!this.isPlaying) return;

                const action = spriteData.actions[this.currentAction];
                if (!action) return;

                this.renderFrame();

                const frameData = action.frames[this.currentFrameIndex];
                const delay = frameData.delay || 100;

                this.currentFrameIndex++;
                if (this.currentFrameIndex >= action.frames.length) {
                    this.currentFrameIndex = 0;
                }

                this.animationTimer = setTimeout(() => this.animate(), delay);
            },

            changeAction(actionIndex) {
                this.pause();
                this.currentAction = actionIndex;
                this.currentFrameIndex = 0;
                this.renderFrame();
            }
        };

        // 预览控制事件
        playBtn.onclick = () => previewPlayer.play();
        pauseBtn.onclick = () => previewPlayer.pause();
        actionSelect.onchange = (e) => previewPlayer.changeAction(parseInt(e.target.value));

        // 初始化预览
        previewPlayer.init();

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '导入';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = async () => {
            okBtn.disabled = true;
            okBtn.textContent = '导入中...';

            try {
                await importFromSprite(app, spriteData, image, {
                    canvasWidth,
                    canvasHeight,
                    maxLeft,
                    maxTop
                });
                document.body.removeChild(overlay);
            } catch (error) {
                console.error('导入失败:', error);
                alert('导入失败: ' + error.message);
                okBtn.disabled = false;
                okBtn.textContent = '导入';
            }
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };

        buttons.appendChild(okBtn);
        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(form);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * 加载图片
     */
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * 从Sprite导入
     */
    async function importFromSprite(app, spriteData, image, config) {
        console.log('开始从Sprite导入...', '配置:', config);

        // 清空现有图层
        app.layerManager.clearLayers();

        // 调整画布大小
        if (config.canvasWidth !== app.config.width || config.canvasHeight !== app.config.height) {
            app.canvasManager.resize(config.canvasWidth, config.canvasHeight);
            app.selectionManager.resize(config.canvasWidth, config.canvasHeight);
            app.config.width = config.canvasWidth;
            app.config.height = config.canvasHeight;
        }

        // 创建动作文件夹
        for (let actionIndex = 0; actionIndex < spriteData.actions.length; actionIndex++) {
            const action = spriteData.actions[actionIndex];

            // 创建动作文件夹
            const actionGroup = app.layerManager.addGroup(`Action ${actionIndex + 1}`);

            // 处理每一帧
            for (let frameIndex = 0; frameIndex < action.frames.length; frameIndex++) {
                const frameData = spriteData.frames[action.frames[frameIndex].frameIndex];

                if (frameData.tiles.length === 1) {
                    // 单图块帧 - 创建图层
                    const tile = frameData.tiles[0];
                    const tileInfo = spriteData.tiles[tile.tileIndex];

                    const layer = createLayerFromTile(app, image, tileInfo, tile, config, actionGroup);
                    layer.name = `Frame ${frameIndex + 1}`;
                    actionGroup.children.push(layer);
                } else {
                    // 多图块帧 - 创建子文件夹
                    const frameGroup = app.layerManager.addGroup(`Frame ${frameIndex + 1}`);

                    // 从layers移除并添加到actionGroup
                    const idx = app.layerManager.layers.indexOf(frameGroup);
                    if (idx !== -1) app.layerManager.layers.splice(idx, 1);

                    // 创建图块图层
                    for (let tileIndex = 0; tileIndex < frameData.tiles.length; tileIndex++) {
                        const tile = frameData.tiles[tileIndex];
                        const tileInfo = spriteData.tiles[tile.tileIndex];

                        const layer = createLayerFromTile(app, image, tileInfo, tile, config);
                        layer.name = `Tile ${tileIndex + 1}`;
                        frameGroup.addChild(layer);
                    }

                    actionGroup.addChild(frameGroup);
                }
            }
        }

        // 如果没有图层，创建一个默认图层
        if (app.layerManager.layers.length === 0) {
            app.layerManager.addLayer(app.config.width, app.config.height, 'Background');
        }

        // 设置活动图层
        app.layerManager.setActiveLayer(app.layerManager.layers.length - 1);

        // 更新UI
        app.renderLayerList();
        app.render();
        app.saveHistory();

        console.log('Sprite导入完成');
        alert('Sprite导入成功！');
    }

    /**
     * 从图块创建图层（支持变换）
     */
    function createLayerFromTile(app, image, tileInfo, tile, config, parent = null) {
        const canvas = document.createElement('canvas');
        canvas.width = config.canvasWidth;
        canvas.height = config.canvasHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;

        // tile.x 和 tile.y 是基于原点的坐标
        // 需要转换到画布坐标系（原点在左上角）
        const drawX = tile.x - config.maxLeft;
        const drawY = tile.y - config.maxTop;

        // 处理变换
        // 1. 创建临时 Canvas 绘制原始图块
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = tileInfo.width;
        tempCanvas.height = tileInfo.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(
            image,
            tileInfo.x, tileInfo.y, tileInfo.width, tileInfo.height,
            0, 0, tileInfo.width, tileInfo.height
        );

        // 2. 应用变换
        const transform = tile.transform || 0;
        let transformedCanvas = tempCanvas;
        
        if (transform !== 0) {
            // 使用之前定义的 createTransformedCanvas 函数
            transformedCanvas = createTransformedCanvas(tempCanvas, transform);
        }

        // 3. 绘制到图层 Canvas
        ctx.drawImage(transformedCanvas, drawX, drawY);

        return {
            name: 'Tile',
            visible: true,
            opacity: 1,
            canvas: canvas,
            ctx: ctx,
            isGroup: false,
            parent: parent
        };
    }

    /**
     * 解析Sprite文件
     */
    function parseSpriteFile(bytes) {
        let ptr = 0;

        // 读取头部
        const header = readInt32(bytes, ptr);
        ptr += 4;
        if (header !== 0x53505258) {
            throw new Error('Invalid Sprite format');
        }

        const version = bytes[ptr++];
        if (version !== 34) {
            throw new Error('Unsupported version: ' + version);
        }

        const byteSequence = bytes[ptr++];
        if ((byteSequence & 1) !== 1) {
            throw new Error('Byte sequence error');
        }

        // 读取图块
        const tileCount = readInt32(bytes, ptr);
        ptr += 4;

        const tiles = [];
        for (let i = 0; i < tileCount; i++) {
            tiles.push({
                x: readInt16(bytes, ptr),
                y: readInt16(bytes, ptr + 2),
                width: readInt16(bytes, ptr + 4),
                height: readInt16(bytes, ptr + 6)
            });
            ptr += 8;
        }

        // 读取帧
        const frameCount = readInt32(bytes, ptr);
        ptr += 4;

        const frames = [];
        for (let i = 0; i < frameCount; i++) {
            const frameTileCount = readInt32(bytes, ptr);
            ptr += 4;
            const collisionCount = readInt32(bytes, ptr);
            ptr += 4;
            const referencePointCount = readInt32(bytes, ptr);
            ptr += 4;

            const frame = {
                tiles: [],
                top: readInt16(bytes, ptr),
                bottom: readInt16(bytes, ptr + 2),
                left: readInt16(bytes, ptr + 4),
                right: readInt16(bytes, ptr + 6)
            };
            ptr += 8;

            // 读取帧图块
            for (let j = 0; j < frameTileCount; j++) {
                frame.tiles.push({
                    tileIndex: readInt16(bytes, ptr),
                    x: readInt16(bytes, ptr + 2),
                    y: readInt16(bytes, ptr + 4),
                    transform: readInt16(bytes, ptr + 6)
                });
                ptr += 8;
            }

            // 跳过碰撞和参考点
            ptr += collisionCount * 8 + referencePointCount * 4;

            frames.push(frame);
        }

        // 读取动作
        const actionCount = readInt32(bytes, ptr);
        ptr += 4;

        const actions = [];
        for (let i = 0; i < actionCount; i++) {
            const sequenceLength = readInt32(bytes, ptr);
            ptr += 4;
            const delay = bytes[ptr++];
            const transform = readInt32(bytes, ptr);
            ptr += 4;

            const action = { frames: [] };

            if (delay === 1) {
                for (let j = 0; j < sequenceLength; j++) {
                    action.frames.push({
                        frameIndex: readInt16(bytes, ptr),
                        delay: readInt16(bytes, ptr + 2)
                    });
                    ptr += 4;
                }
            } else {
                for (let j = 0; j < sequenceLength; j++) {
                    action.frames.push({
                        frameIndex: readInt16(bytes, ptr),
                        delay: 100
                    });
                    ptr += 2;
                }
            }

            actions.push(action);
        }

        return { tiles, frames, actions };
    }

    /**
     * 读取Int32 (大端序)
     */
    function readInt32(bytes, offset) {
        return (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
               (bytes[offset + 2] << 8) | bytes[offset + 3];
    }

    /**
     * 读取Int16 (大端序)
     */
    function readInt16(bytes, offset) {
        const value = (bytes[offset] << 8) | bytes[offset + 1];
        return value > 32767 ? value - 65536 : value;
    }

})();
