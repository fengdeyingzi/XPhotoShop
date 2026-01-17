// 菜单管理器 - 处理菜单交互和操作
export class MenuManager {
    constructor(app) {
        this.app = app;
        this.activeMenu = null;
        this.customActions = {}; // 存储自定义操作处理器
    }

    init() {
        this.setupMenuEvents();
    }

    /**
     * 动态添加自定义菜单项
     * @param {string} menuName - 菜单名称 (例如: '文件', '编辑', '图层')
     * @param {Object} options - 菜单项选项
     * @param {string} options.label - 菜单项显示文本
     * @param {string} options.action - 唯一操作标识符
     * @param {Function} options.handler - 点击时执行的函数
     * @param {string} [options.position] - 位置: 'top', 'bottom', 或索引数字 (默认: 'bottom')
     * @param {boolean} [options.divider] - 在此项前添加分隔线 (默认: false)
     * @returns {boolean} - 成功状态
     */
    addMenuItem(menuName, options) {
        const { label, action, handler, position = 'bottom', divider = false } = options;
        console.log("添加菜单："+menuName, options);
        if (!label || !action || !handler) {
            console.error('addMenuItem: label, action, and handler are required');
            return false;
        }

        // 查找菜单
        const menuItems = document.querySelectorAll('.menu-item');
        let targetMenu = null;

        menuItems.forEach(item => {
            const title = item.querySelector('.menu-title');
            if (title && title.textContent === menuName) {
                targetMenu = item;
            }
        });

        if (!targetMenu) {
            console.error(`addMenuItem: Menu "${menuName}" not found`);
            return false;
        }

        const dropdown = targetMenu.querySelector('.menu-dropdown');
        if (!dropdown) {
            console.error(`addMenuItem: Dropdown not found for menu "${menuName}"`);
            return false;
        }

        // 如果需要，添加分隔线
        if (divider) {
            const dividerEl = document.createElement('div');
            dividerEl.className = 'menu-divider';
            this.insertAtPosition(dropdown, dividerEl, position);
        }

        // 创建菜单选项
        const option = document.createElement('div');
        option.className = 'menu-option';
        option.textContent = label;
        option.dataset.action = action;

        // 添加点击处理器
        option.addEventListener('click', (e) => {
            handler(this.app);
            this.closeAllMenus();
        });

        // 在指定位置插入
        this.insertAtPosition(dropdown, option, position);

        // 存储自定义操作
        this.customActions[action] = handler;

        return true;
    }

    /**
     * 移除自定义菜单项
     * @param {string} action - 要移除的项的操作标识符
     * @returns {boolean} - 成功状态
     */
    removeMenuItem(action) {
        const option = document.querySelector(`.menu-option[data-action="${action}"]`);
        if (option) {
            option.remove();
            delete this.customActions[action];
            return true;
        }
        return false;
    }

    /**
     * 向菜单栏添加新菜单
     * @param {Object} options - 菜单选项
     * @param {string} options.name - 菜单显示名称
     * @param {Array} options.items - 菜单项数组
     * @param {string} [options.position] - 位置: 'left', 'right', 或索引 (默认: 'right')
     * @returns {boolean} - 成功状态
     */
    addMenu(options) {
        const { name, items = [], position = 'right' } = options;

        if (!name) {
            console.error('addMenu: name is required');
            return false;
        }

        const menuBar = document.querySelector('.menu-bar');
        if (!menuBar) {
            console.error('addMenu: Menu bar not found');
            return false;
        }

        // 创建菜单项
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';

        const title = document.createElement('span');
        title.className = 'menu-title';
        title.textContent = name;

        const dropdown = document.createElement('div');
        dropdown.className = 'menu-dropdown';

        // 添加项目
        items.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'menu-divider';
                dropdown.appendChild(divider);
            } else {
                const option = document.createElement('div');
                option.className = 'menu-option';
                option.textContent = item.label;
                option.dataset.action = item.action;

                option.addEventListener('click', (e) => {
                    if (item.handler) {
                        item.handler(this.app);
                    }
                    this.closeAllMenus();
                });

                dropdown.appendChild(option);

                if (item.handler) {
                    this.customActions[item.action] = item.handler;
                }
            }
        });

        menuItem.appendChild(title);
        menuItem.appendChild(dropdown);

        // 为标题添加点击处理器
        title.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu(menuItem);
        });

        // 在指定位置插入
        if (position === 'left') {
            menuBar.insertBefore(menuItem, menuBar.firstChild);
        } else if (position === 'right') {
            menuBar.appendChild(menuItem);
        } else if (typeof position === 'number') {
            const children = Array.from(menuBar.children);
            if (position < children.length) {
                menuBar.insertBefore(menuItem, children[position]);
            } else {
                menuBar.appendChild(menuItem);
            }
        }

        return true;
    }

    /**
     * 在指定位置插入元素的辅助函数
     * @private
     */
    insertAtPosition(parent, element, position) {
        
        if (position === 'top') {
            
            parent.insertBefore(element, parent.firstChild);
        } else if (position === 'bottom' || position === undefined) {
            parent.appendChild(element);
        } else if (typeof position === 'number') {
            const children = Array.from(parent.children);
            if (position < children.length) {
                parent.insertBefore(element, children[position]);
            } else {
                parent.appendChild(element);
            }
        }
    }

    setupMenuEvents() {
        const menuItems = document.querySelectorAll('.menu-item');
        let isMenuOpen = false;

        menuItems.forEach(item => {
            const title = item.querySelector('.menu-title');

            // 点击事件
            title.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (item.classList.contains('active')) {
                    this.closeAllMenus();
                    isMenuOpen = false;
                } else {
                    this.closeAllMenus();
                    item.classList.add('active');
                    this.activeMenu = item;
                    isMenuOpen = true;
                }
            });

            // 鼠标悬停事件（Windows风格的滑过切换）
            title.addEventListener('mouseenter', () => {
                if (isMenuOpen) {
                    this.closeAllMenus();
                    item.classList.add('active');
                    this.activeMenu = item;
                }
            });
        });

        // 处理菜单选项点击
        document.querySelectorAll('.menu-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!option.classList.contains('disabled')) {
                    const action = e.target.dataset.action;
                    this.handleAction(action);
                    this.closeAllMenus();
                    isMenuOpen = false;
                }
            });
        });

        // 点击外部时关闭菜单
        document.addEventListener('click', () => {
            this.closeAllMenus();
            isMenuOpen = false;
        });
    }

    closeAllMenus() {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        this.activeMenu = null;
    }

    handleAction(action) {
        switch(action) {
            case 'open-psd':
                document.getElementById('fileInput').click();
                break;
            case 'save-psd':
                this.app.handlePsdSave();
                break;
            case 'export-png':
                this.exportPng();
                break;
            case 'undo':
                this.app.undo();
                break;
            case 'redo':
                this.app.redo();
                break;
            case 'resize':
                this.resizeCanvas();
                break;
            case 'new-layer':
                this.app.layerManager.addLayer(this.app.config.width, this.app.config.height);
                this.app.renderLayerList();
                this.app.render();
                this.app.saveHistory();
                break;
            case 'new-group':
                this.app.layerManager.addGroup();
                this.app.renderLayerList();
                this.app.saveHistory();
                break;
            case 'delete-layer':
                if (this.app.layerManager.deleteLayer()) {
                    this.app.renderLayerList();
                    this.app.render();
                    this.app.saveHistory();
                }
                break;
            case 'move-to-group':
                this.moveToGroup();
                break;
            case 'move-to-root':
                this.moveToRoot();
                break;
            case 'merge-down':
                this.mergeDown();
                break;
            case 'select-all':
                this.app.selectionManager.selectAll();
                this.app.render();
                // this.app.renderLayerList();
                break;
            case 'deselect':
                this.app.selectionManager.clear();
                this.app.render();
                // this.app.renderLayerList();
                break;
            case 'about':
                this.showAboutDialog();
                break;
        }
    }

    exportPng() {
        const canvas = this.app.canvasManager.displayCanvas;
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pixel-art.png';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    showAboutDialog() {
        const dialog = document.getElementById('aboutDialog');
        if (dialog) {
            dialog.style.display = 'flex';
            
            // 添加点击关闭事件
            const closeHandler = (e) => {
                // 检查点击的是确定按钮或对话框外部
                if (e.target.id === 'aboutDialogClose' || e.target.id === 'aboutDialog') {
                    dialog.style.display = 'none';
                    document.removeEventListener('keydown', keyHandler);
                }
            };
            
            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    dialog.style.display = 'none';
                    document.removeEventListener('keydown', keyHandler);
                }
            };
            
            dialog.addEventListener('click', closeHandler);
            document.addEventListener('keydown', keyHandler);
            
            // 聚焦确定按钮
            const closeBtn = document.getElementById('aboutDialogClose');
            if (closeBtn) {
                closeBtn.focus();
            }
        } else {
            // 如果对话框不存在，回退到 alert
            alert('XPhotoShop v1.0\n风的影子 制作\n开源地址：https://github.com/fengdeyingzi/XPhotoShop');
        }
    }

    resizeCanvas() {
        // 创建自定义对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '调整画布大小';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginBottom = '15px';

        // 宽度输入
        const widthGroup = document.createElement('div');
        widthGroup.style.display = 'flex';
        widthGroup.style.alignItems = 'center';
        widthGroup.style.gap = '10px';

        const widthLabel = document.createElement('label');
        widthLabel.textContent = '宽度:';
        widthLabel.style.width = '60px';

        const widthInput = document.createElement('input');
        widthInput.type = 'number';
        widthInput.className = 'dialog-input';
        widthInput.value = this.app.config.width;
        widthInput.min = '1';
        widthInput.max = '2048';
        widthInput.style.marginBottom = '0';

        const widthUnit = document.createElement('span');
        widthUnit.textContent = 'px';

        widthGroup.appendChild(widthLabel);
        widthGroup.appendChild(widthInput);
        widthGroup.appendChild(widthUnit);

        // 高度输入
        const heightGroup = document.createElement('div');
        heightGroup.style.display = 'flex';
        heightGroup.style.alignItems = 'center';
        heightGroup.style.gap = '10px';

        const heightLabel = document.createElement('label');
        heightLabel.textContent = '高度:';
        heightLabel.style.width = '60px';

        const heightInput = document.createElement('input');
        heightInput.type = 'number';
        heightInput.className = 'dialog-input';
        heightInput.value = this.app.config.height;
        heightInput.min = '1';
        heightInput.max = '2048';
        heightInput.style.marginBottom = '0';

        const heightUnit = document.createElement('span');
        heightUnit.textContent = 'px';

        heightGroup.appendChild(heightLabel);
        heightGroup.appendChild(heightInput);
        heightGroup.appendChild(heightUnit);

        form.appendChild(widthGroup);
        form.appendChild(heightGroup);

        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = () => {
            const w = parseInt(widthInput.value);
            const h = parseInt(heightInput.value);
            if (w > 0 && h > 0 && w <= 2048 && h <= 2048) {
                this.app.canvasManager.resize(w, h);
                this.app.layerManager.resizeLayers(w, h);
                this.app.selectionManager.resize(w, h);
                this.app.config.width = w;
                this.app.config.height = h;
                this.app.render();
                this.app.saveHistory();
                document.body.removeChild(overlay);
            } else {
                alert('请输入有效的尺寸 (1-2048)');
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

        // 聚焦宽度输入
        setTimeout(() => {
            widthInput.focus();
            widthInput.select();
        }, 10);

        // 回车键确认
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        };
        widthInput.addEventListener('keydown', handleEnter);
        heightInput.addEventListener('keydown', handleEnter);
    }

    mergeDown() {
        const idx = this.app.layerManager.activeLayerIndex;
        if (idx === 0) {
            alert('底层无法向下合并');
            return;
        }

        const currentLayer = this.app.layerManager.layers[idx];
        const belowLayer = this.app.layerManager.layers[idx - 1];

        belowLayer.ctx.globalAlpha = currentLayer.opacity;
        belowLayer.ctx.drawImage(currentLayer.canvas, 0, 0);
        belowLayer.ctx.globalAlpha = 1;

        this.app.layerManager.layers.splice(idx, 1);
        this.app.layerManager.activeLayerIndex = idx - 1;
        this.app.renderLayerList();
        this.app.render();
        this.app.saveHistory();
    }

    moveToGroup() {
        const activeItem = this.app.layerManager.activeItem;
        if (!activeItem) {
            alert('请先选择一个图层');
            return;
        }

        if (activeItem.isGroup) {
            alert('文件夹不能移动到其他文件夹中');
            return;
        }

        // 获取所有组
        const groups = [];
        const collectGroups = (items) => {
            for (const item of items) {
                if (item.isGroup) {
                    groups.push(item);
                    collectGroups(item.children);
                }
            }
        };
        collectGroups(this.app.layerManager.layers);

        if (groups.length === 0) {
            alert('没有可用的文件夹，请先创建一个文件夹');
            return;
        }

        // 显示选择对话框
        this.showGroupSelectionDialog(groups, (selectedGroup) => {
            if (selectedGroup) {
                this.app.layerManager.moveToGroup(activeItem, selectedGroup);
                this.app.renderLayerList();
                this.app.saveHistory();
            }
        });
    }

    moveToRoot() {
        const activeItem = this.app.layerManager.activeItem;
        if (!activeItem) {
            alert('请先选择一个图层或文件夹');
            return;
        }

        if (!activeItem.parent) {
            alert('该项已经在根级别');
            return;
        }

        this.app.layerManager.moveToRoot(activeItem);
        this.app.renderLayerList();
        this.app.saveHistory();
    }

    showGroupSelectionDialog(groups, callback) {
        // 创建自定义对话框
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = '选择目标文件夹';

        const listContainer = document.createElement('div');
        listContainer.style.maxHeight = '300px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.margin = '10px 0';

        groups.forEach(group => {
            const item = document.createElement('div');
            item.style.padding = '8px';
            item.style.cursor = 'pointer';
            item.style.borderBottom = '1px solid #444';
            item.textContent = `📁 ${group.name}`;
            item.onmouseover = () => item.style.backgroundColor = '#444';
            item.onmouseout = () => item.style.backgroundColor = 'transparent';
            item.onclick = () => {
                callback(group);
                document.body.removeChild(overlay);
            };
            listContainer.appendChild(item);
        });

        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.onclick = () => {
            callback(null);
            document.body.removeChild(overlay);
        };

        buttons.appendChild(cancelBtn);

        dialog.appendChild(title);
        dialog.appendChild(listContainer);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    // 判断当前系统是否是手机
    isMobile() {
        return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    }
}
