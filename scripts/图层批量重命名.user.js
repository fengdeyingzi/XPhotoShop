// ==UserScript==
// @name         PhotoShop - 图层批量重命名
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  批量重命名根目录下的所有图层（不包含文件夹），支持设置前缀和起始编号
// @author       风的影子
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("脚本开始执行。。。");

    // 初始化函数
    function initPlugin() {
        const app = window.photoShopApp;
        if (!app) {
            console.log('PhotoShop应用未加载，等待中...');
            return false;
        }

        console.log('图层批量重命名插件已加载');

        // 添加批量重命名图层菜单项
        app.menuManager.addMenuItem('图层', {
            label: '批量重命名图层...',
            action: 'batch-rename-layers',
            handler: (app) => {
                showBatchRenameDialog(app, 'layer');
            },
            position: 'bottom',
            divider: true
        });

        // 添加批量重命名文件夹菜单项
        app.menuManager.addMenuItem('图层', {
            label: '批量重命名文件夹...',
            action: 'batch-rename-groups',
            handler: (app) => {
                showBatchRenameDialog(app, 'group');
            },
            position: 'bottom',
            divider: false
        });

        return true;
    }

    // 尝试初始化，如果失败则轮询等待
    function tryInit() {
        if (!initPlugin()) {
            // 每100ms检查一次，最多等待10秒
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
     * 显示批量重命名对话框
     * @param {Object} app - PhotoShop应用实例
     * @param {string} type - 重命名类型：'layer' 或 'group'
     */
    function showBatchRenameDialog(app, type = 'layer') {
        const isLayer = type === 'layer';
        const typeName = isLayer ? '图层' : '文件夹';

        // 获取根目录下的所有图层或文件夹
        const rootItems = app.layerManager.layers.filter(item =>
            isLayer ? !item.isGroup : item.isGroup
        );

        if (rootItems.length === 0) {
            alert(`根目录下没有可重命名的${typeName}`);
            return;
        }

        // 创建对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.style.width = '400px';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = `批量重命名${typeName}`;

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
        info.textContent = `将重命名根目录下的 ${rootItems.length} 个${typeName}`;

        // 前缀输入
        const prefixGroup = document.createElement('div');
        prefixGroup.style.display = 'flex';
        prefixGroup.style.flexDirection = 'column';
        prefixGroup.style.gap = '5px';

        const prefixLabel = document.createElement('label');
        prefixLabel.textContent = '名称前缀:';
        prefixLabel.style.color = '#ddd';

        const prefixInput = document.createElement('input');
        prefixInput.type = 'text';
        prefixInput.className = 'dialog-input';
        prefixInput.value = isLayer ? 'Layer_' : 'Group_';
        prefixInput.placeholder = isLayer ? '例如: Layer_' : '例如: Group_';
        prefixInput.style.marginBottom = '0';

        prefixGroup.appendChild(prefixLabel);
        prefixGroup.appendChild(prefixInput);

        // 起始编号输入
        const startGroup = document.createElement('div');
        startGroup.style.display = 'flex';
        startGroup.style.flexDirection = 'column';
        startGroup.style.gap = '5px';

        const startLabel = document.createElement('label');
        startLabel.textContent = '起始编号:';
        startLabel.style.color = '#ddd';

        const startInput = document.createElement('input');
        startInput.type = 'number';
        startInput.className = 'dialog-input';
        startInput.value = '1';
        startInput.min = '0';
        startInput.style.marginBottom = '0';

        startGroup.appendChild(startLabel);
        startGroup.appendChild(startInput);

        // 补零选项
        const paddingGroup = document.createElement('div');
        paddingGroup.style.display = 'flex';
        paddingGroup.style.flexDirection = 'column';
        paddingGroup.style.gap = '5px';

        const paddingLabel = document.createElement('label');
        paddingLabel.textContent = '编号位数（补零）:';
        paddingLabel.style.color = '#ddd';

        const paddingInput = document.createElement('input');
        paddingInput.type = 'number';
        paddingInput.className = 'dialog-input';
        paddingInput.value = '2';
        paddingInput.min = '1';
        paddingInput.max = '10';
        paddingInput.style.marginBottom = '0';

        const paddingHint = document.createElement('div');
        paddingHint.style.color = '#888';
        paddingHint.style.fontSize = '11px';
        paddingHint.textContent = '例如: 2位数 → 01, 02, 03...';

        paddingGroup.appendChild(paddingLabel);
        paddingGroup.appendChild(paddingInput);
        paddingGroup.appendChild(paddingHint);

        // 预览
        const previewGroup = document.createElement('div');
        previewGroup.style.display = 'flex';
        previewGroup.style.flexDirection = 'column';
        previewGroup.style.gap = '5px';
        previewGroup.style.marginTop = '10px';
        previewGroup.style.padding = '10px';
        previewGroup.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        previewGroup.style.borderRadius = '4px';

        const previewLabel = document.createElement('div');
        previewLabel.textContent = '预览:';
        previewLabel.style.color = '#ddd';
        previewLabel.style.fontWeight = 'bold';
        previewLabel.style.marginBottom = '5px';

        const previewList = document.createElement('div');
        previewList.style.maxHeight = '150px';
        previewList.style.overflowY = 'auto';
        previewList.style.fontSize = '12px';
        previewList.style.color = '#aaa';

        previewGroup.appendChild(previewLabel);
        previewGroup.appendChild(previewList);

        // 更新预览函数
        const updatePreview = () => {
            const prefix = prefixInput.value;
            const start = parseInt(startInput.value) || 0;
            const padding = parseInt(paddingInput.value) || 1;

            previewList.innerHTML = '';
            rootItems.slice(0, 5).forEach((item, index) => {
                const num = start + index;
                const paddedNum = String(num).padStart(padding, '0');
                const newName = `${prefix}${paddedNum}`;

                const previewItem = document.createElement('div');
                previewItem.style.padding = '3px 0';
                previewItem.innerHTML = `<span style="color: #666">${item.name}</span> → <span style="color: #4CAF50">${newName}</span>`;
                previewList.appendChild(previewItem);
            });

            if (rootItems.length > 5) {
                const more = document.createElement('div');
                more.style.padding = '3px 0';
                more.style.color = '#666';
                more.textContent = `... 还有 ${rootItems.length - 5} 个${typeName}`;
                previewList.appendChild(more);
            }
        };

        // 监听输入变化
        prefixInput.addEventListener('input', updatePreview);
        startInput.addEventListener('input', updatePreview);
        paddingInput.addEventListener('input', updatePreview);

        form.appendChild(info);
        form.appendChild(prefixGroup);
        form.appendChild(startGroup);
        form.appendChild(paddingGroup);
        form.appendChild(previewGroup);

        // 初始化预览
        updatePreview();

        // 按钮
        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = () => {
            const prefix = prefixInput.value;
            const start = parseInt(startInput.value) || 0;
            const padding = parseInt(paddingInput.value) || 1;

            // 执行批量重命名
            batchRenameItems(app, rootItems, prefix, start, padding, typeName);

            document.body.removeChild(overlay);
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

        // 聚焦前缀输入框
        setTimeout(() => {
            prefixInput.focus();
            prefixInput.select();
        }, 10);

        // ESC键取消
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            } else if (e.key === 'Enter' && e.ctrlKey) {
                okBtn.click();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    /**
     * 执行批量重命名
     * @param {Object} app - PhotoShop应用实例
     * @param {Array} items - 要重命名的项目数组
     * @param {string} prefix - 名称前缀
     * @param {number} startNum - 起始编号
     * @param {number} padding - 编号位数
     * @param {string} typeName - 类型名称（用于提示）
     */
    function batchRenameItems(app, items, prefix, startNum, padding, typeName) {
        let renamed = 0;

        items.forEach((item, index) => {
            const num = startNum + index;
            const paddedNum = String(num).padStart(padding, '0');
            const newName = `${prefix}${paddedNum}`;

            item.name = newName;
            renamed++;
        });

        // 更新UI
        app.renderLayerList();

        // 保存历史记录
        app.saveHistory();

        console.log(`批量重命名完成: ${renamed} 个${typeName}`);
        alert(`成功重命名 ${renamed} 个${typeName}`);
    }

})();
