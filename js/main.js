// 主应用程序入口
import { CanvasManager } from './core/canvas-manager.js';
import { LayerManager, Layer, LayerGroup } from './core/layer-manager.js';
import { EventManager } from './core/event-manager.js';
import { MenuManager } from './core/menu-manager.js';
import { SelectionManager } from './core/selection-manager.js';
import { PanelManager } from './core/panel-manager.js';
import { Tools } from './tools/tools.js';
import './utils/toast.js';

class PhotoShopApp {
    constructor() {
        this.config = {
            width: 64,
            height: 64,
            zoom: 8
        };

        // 初始化管理器
        this.canvasManager = null;
        this.layerManager = new LayerManager();
        this.selectionManager = null;
        this.eventManager = new EventManager();
        this.menuManager = null;
        this.panelManager = null;
        this.tools = null;

        // UI 元素
        this.layerListEl = null;
        this.colorPicker = null;
        this.coordInfo = null;
        this.zoomVal = null;

        // 光标跟踪
        this.mousePos = null;
        this.isMouseOverCanvas = false;

        // 自定义工具
        this.customTools = new Map();
    }

    init() {
        // 获取 DOM 元素
        const displayCanvas = document.getElementById('displayCanvas');
        const canvasContainer = document.getElementById('canvasContainer');
        this.layerListEl = document.getElementById('layerList');
        this.colorPicker = document.getElementById('colorPicker');
        this.coordInfo = document.getElementById('coordInfo');
        this.zoomVal = document.getElementById('zoomVal');
        this.canvasSize = document.getElementById('canvasSize');

        // 初始化管理器
        this.canvasManager = new CanvasManager(displayCanvas, canvasContainer);
        this.canvasManager.resize(this.config.width, this.config.height);
        this.selectionManager = new SelectionManager(this.config.width, this.config.height);
        this.menuManager = new MenuManager(this);
        this.panelManager = new PanelManager(this);
        this.tools = new Tools(this.layerManager, this.canvasManager, this.selectionManager);

        // 创建默认图层
        this.layerManager.addLayer(this.config.width, this.config.height, 'Background');
        this.layerManager.fillLayer(0, 'white');
        this.layerManager.addLayer(this.config.width, this.config.height, 'Layer 1');
        this.layerManager.setActiveLayer(1);

        // 设置 UI
        this.updateZoomDisplay();
        this.renderLayerList();
        this.updateToolButtons();
        this.menuManager.init();
        this.panelManager.init();
        this.setupEvents();
        this.render();

        // 保存初始状态
        this.saveHistory();
    }

    render() {
        this.canvasManager.render(this.layerManager.layers);

        const displayCtx = this.canvasManager.displayCtx;

        // 绘制选区
        const selectionPreview = this.tools.getSelectionPreview();
        if (selectionPreview) {
            // 绘制选区预览
            displayCtx.save();
            displayCtx.fillStyle = '#808080';
            const x = selectionPreview.x;
            const y = selectionPreview.y;
            const w = selectionPreview.width;
            const h = selectionPreview.height;
            displayCtx.fillRect(x, y, w, 1);
            displayCtx.fillRect(x, y + h - 1, w, 1);
            displayCtx.fillRect(x, y, 1, h);
            displayCtx.fillRect(x + w - 1, y, 1, h);
            displayCtx.restore();
        } else {
            // 绘制活动选区
            this.selectionManager.drawToCanvas(displayCtx, this.canvasManager.zoom);
        }

        // 绘制多边形套索预览
        const polyLassoPreview = this.tools.getPolyLassoPreview();
        if (polyLassoPreview && polyLassoPreview.points && polyLassoPreview.points.length > 0) {
            displayCtx.save();
            displayCtx.strokeStyle = '#000';
            displayCtx.lineWidth = 1;
            displayCtx.setLineDash([4, 4]);

            displayCtx.beginPath();
            displayCtx.moveTo(polyLassoPreview.points[0].x, polyLassoPreview.points[0].y);
            for (let i = 1; i < polyLassoPreview.points.length; i++) {
                displayCtx.lineTo(polyLassoPreview.points[i].x, polyLassoPreview.points[i].y);
            }
            // 连线到当前鼠标位置
            if (polyLassoPreview.currentX !== undefined && polyLassoPreview.currentY !== undefined) {
                displayCtx.lineTo(polyLassoPreview.currentX, polyLassoPreview.currentY);
            }
            displayCtx.stroke();

            // 绘制白色虚线（偏移效果）
            displayCtx.strokeStyle = '#fff';
            displayCtx.setLineDash([4, 4]);
            displayCtx.lineDashOffset = 4;
            displayCtx.stroke();

            // 在第一个点处绘制圆圈
            displayCtx.beginPath();
            displayCtx.arc(polyLassoPreview.points[0].x, polyLassoPreview.points[0].y, 3, 0, Math.PI * 2);
            displayCtx.stroke();

            displayCtx.restore();
        }

        // 绘制裁剪预览
        const cropPreview = this.tools.getCropPreview();
        if (cropPreview && cropPreview.w > 0 && cropPreview.h > 0) {
            displayCtx.save();

            // 半透明遮罩
            displayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            displayCtx.fillRect(0, 0, this.config.width, this.config.height);

            // 清除选中区域 (使其高亮)
            displayCtx.globalCompositeOperation = 'destination-out';
            displayCtx.fillStyle = 'black';
            displayCtx.fillRect(cropPreview.x, cropPreview.y, cropPreview.w, cropPreview.h);

            // 恢复正常绘制边框
            displayCtx.globalCompositeOperation = 'source-over';
            displayCtx.strokeStyle = '#fff';
            displayCtx.lineWidth = 1;
            displayCtx.setLineDash([5, 5]);
            displayCtx.strokeRect(cropPreview.x, cropPreview.y, cropPreview.w, cropPreview.h);

            displayCtx.restore();
        }

        // 绘制自定义光标
        this.drawCursor();
    }

    drawCursor() {
        if (!this.mousePos || !this.isMouseOverCanvas) return;

        const displayCtx = this.canvasManager.displayCtx;
        const tool = this.tools.currentTool;
        const size = this.tools.brushSize;
        const x = this.mousePos.x;
        const y = this.mousePos.y;

        // 如果颜色改变则更新颜色选择器（用于取色器工具）
        if (this.colorPicker.value !== this.tools.color) {
            this.colorPicker.value = this.tools.color;
        }

        // 只为画笔类工具绘制光标
        if (tool !== 'brush' && tool !== 'pencil' && tool !== 'eraser') return;

        displayCtx.save();
        displayCtx.imageSmoothingEnabled = false;
        displayCtx.strokeStyle = '#000';
        displayCtx.lineWidth = 1;
        displayCtx.setLineDash([]);

        const radius = Math.floor(size / 2);

        if (tool === 'brush') {
            // 为画笔绘制圆形
            displayCtx.beginPath();
            displayCtx.arc(x + 0.5, y + 0.5, radius + 0.5, 0, Math.PI * 2);
            displayCtx.stroke();
        } else if (tool === 'pencil') {
            // 设置半透明
            displayCtx.globalAlpha = 0.5;
            // 为铅笔绘制正方形
            displayCtx.strokeRect(x - radius+0.5, y - radius+0.5, size-1, size-1);
        } else if (tool === 'eraser') {
            // 根据橡皮擦形状设置绘制形状
            if (this.tools.eraserShape === 'circle') {
                // 为橡皮擦绘制圆形
                displayCtx.beginPath();
                displayCtx.arc(x + 0.5, y + 0.5, radius + 0.5, 0, Math.PI * 2);
                displayCtx.stroke();
            } else {
                // 为橡皮擦绘制正方形
                displayCtx.strokeRect(x - radius, y - radius, size, size);
            }
        }

        displayCtx.restore();
    }

    renderLayerList() {
        this.layerListEl.innerHTML = '';

        // 递归函数，用于渲染具有适当缩进的项目
        const renderItem = (itemObj, depth = 0) => {
            const item = document.createElement('div');
            const isSelected = this.layerManager.selectedItems.includes(itemObj);
            item.className = `layer-item ${isSelected ? 'active' : ''}`;
            item.style.paddingLeft = `${depth * 16}px`;
            item.draggable = true;
            item.dataset.itemId = this.getItemId(itemObj);

            // 拖拽事件
            item.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                // 如果拖拽的项目不在选中列表中，则只拖拽该项目
                if (!this.layerManager.selectedItems.includes(itemObj)) {
                    this.draggedItems = [itemObj];
                } else {
                    // 拖拽所有选中的项目
                    this.draggedItems = [...this.layerManager.selectedItems];
                }
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                this.draggedItems = null;
                // 移除所有放置指示器
                document.querySelectorAll('.layer-item').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below', 'drop-into');
                });
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this.draggedItems || this.draggedItems.includes(itemObj)) return;

                // 移除之前的指示器
                document.querySelectorAll('.layer-item').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below', 'drop-into');
                });

                const rect = item.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const height = rect.height;

                if (itemObj.isGroup) {
                    // 对于文件夹，允许放入其中
                    if (y < height * 0.25) {
                        item.classList.add('drop-above');
                        this.dropPosition = 'above';
                    } else if (y > height * 0.75) {
                        item.classList.add('drop-below');
                        this.dropPosition = 'below';
                    } else {
                        item.classList.add('drop-into');
                        this.dropPosition = 'into';
                    }
                } else {
                    // 对于图层，只允许放在上方/下方
                    if (y < height / 2) {
                        item.classList.add('drop-above');
                        this.dropPosition = 'above';
                    } else {
                        item.classList.add('drop-below');
                        this.dropPosition = 'below';
                    }
                }

                this.dropTarget = itemObj;
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this.draggedItems || !this.dropTarget) return;

                this.handleMultiDrop(this.draggedItems, this.dropTarget, this.dropPosition);

                // 清理
                document.querySelectorAll('.layer-item').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below', 'drop-into');
                });
                this.dropTarget = null;
                this.dropPosition = null;
            });

            item.onclick = (e) => {
                this.layerManager.setActiveItem(itemObj, e.ctrlKey || e.metaKey);
                this.renderLayerList();
            };

            // 右键上下文菜单
            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.layerManager.setActiveItem(itemObj);
                this.renderLayerList();
                this.showContextMenu(e.clientX, e.clientY, itemObj);
            };

            const eye = document.createElement('span');
            eye.className = 'layer-vis';
            eye.textContent = itemObj.visible ? '👁️' : '　';
            eye.onclick = (e) => {
                e.stopPropagation();
                this.layerManager.toggleVisibility(itemObj);
                this.renderLayerList();
                this.render();
            };

            if (itemObj.isGroup) {
                // 渲染文件夹
                const arrow = document.createElement('span');
                arrow.className = 'layer-arrow';
                arrow.textContent = itemObj.expanded ? '▼' : '▶';
                arrow.onclick = (e) => {
                    e.stopPropagation();
                    this.layerManager.toggleGroupExpanded(itemObj);
                    this.renderLayerList();
                };

                const folderIcon = document.createElement('span');
                folderIcon.className = 'layer-folder-icon';
                folderIcon.textContent = '📁';

                const name = document.createElement('div');
                name.className = 'layer-name';
                name.textContent = itemObj.name;
                name.ondblclick = (e) => {
                    e.stopPropagation();
                    this.showRenameDialog(itemObj, itemObj.name);
                };

                item.appendChild(eye);
                item.appendChild(arrow);
                item.appendChild(folderIcon);
                item.appendChild(name);
            } else {
                // 渲染图层
                const thumb = document.createElement('canvas');
                thumb.className = 'layer-thumb';
                thumb.width = 24;
                thumb.height = 24;

                // Ctrl+点击缩略图从图层创建选区
                thumb.onclick = (e) => {
                    e.stopPropagation();
                    if (e.ctrlKey) {
                        this.selectionManager.selectFromLayer(itemObj);
                        this.render();
                    }
                };

                // 将图层内容绘制到缩略图
                const thumbCtx = thumb.getContext('2d');
                thumbCtx.imageSmoothingEnabled = false;

                const scale = Math.min(24 / itemObj.canvas.width, 24 / itemObj.canvas.height);
                const scaledWidth = itemObj.canvas.width * scale;
                const scaledHeight = itemObj.canvas.height * scale;
                const offsetX = (24 - scaledWidth) / 2;
                const offsetY = (24 - scaledHeight) / 2;

                thumbCtx.drawImage(itemObj.canvas, offsetX, offsetY, scaledWidth, scaledHeight);

                const name = document.createElement('div');
                name.className = 'layer-name';
                name.textContent = itemObj.name;
                name.ondblclick = (e) => {
                    e.stopPropagation();
                    this.showRenameDialog(itemObj, itemObj.name);
                };

                item.appendChild(eye);
                item.appendChild(thumb);
                item.appendChild(name);
            }

            this.layerListEl.appendChild(item);

            // 如果组已展开，则渲染子项
            if (itemObj.isGroup && itemObj.expanded) {
                for (let i = itemObj.children.length - 1; i >= 0; i--) {
                    renderItem(itemObj.children[i], depth + 1);
                }
            }
        };

        // 渲染所有根级项目
        for (let i = this.layerManager.layers.length - 1; i >= 0; i--) {
            renderItem(this.layerManager.layers[i], 0);
        }
    }

    getItemId(item) {
        // 生成唯一 ID 用于在拖放过程中跟踪项目
        if (!item._uniqueId) {
            item._uniqueId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        return item._uniqueId;
    }

    handleMultiDrop(draggedItems, targetItem, position) {
        // 防止将文件夹放入自身或其后代中
        for (const draggedItem of draggedItems) {
            if (draggedItem === targetItem) return;
            if (draggedItem.isGroup && this.isDescendant(targetItem, draggedItem)) {
                alert('不能将文件夹移动到自身或其子项中');
                return;
            }
        }

        // 从当前位置移除所有拖拽的项目
        for (const draggedItem of draggedItems) {
            if (draggedItem.parent) {
                draggedItem.parent.removeChild(draggedItem);
            } else {
                const index = this.layerManager.layers.indexOf(draggedItem);
                if (index !== -1) {
                    this.layerManager.layers.splice(index, 1);
                }
            }
        }

        // 插入到新位置
        if (position === 'into' && targetItem.isGroup) {
            // 添加到文件夹
            for (const draggedItem of draggedItems) {
                targetItem.addChild(draggedItem);
            }
        } else {
            // 在目标上方或下方插入
            const targetParent = targetItem.parent;
            const targetArray = targetParent ? targetParent.children : this.layerManager.layers;
            const targetIndex = targetArray.indexOf(targetItem);

            if (targetIndex !== -1) {
                const insertIndex = position === 'above' ? targetIndex + 1 : targetIndex;
                for (let i = 0; i < draggedItems.length; i++) {
                    targetArray.splice(insertIndex + i, 0, draggedItems[i]);
                    draggedItems[i].parent = targetParent;
                }
            }
        }

        this.renderLayerList();
        this.saveHistory();
    }

    handleDrop(draggedItem, targetItem, position) {
        this.handleMultiDrop([draggedItem], targetItem, position);
    }

    isDescendant(item, potentialAncestor) {
        let current = item.parent;
        while (current) {
            if (current === potentialAncestor) return true;
            current = current.parent;
        }
        return false;
    }

    showContextMenu(x, y, item) {
        // 移除任何现有的上下文菜单
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // 创建上下文菜单
        const menu = document.createElement('div');
        menu.className = 'context-menu';

        // 根据项目类型创建菜单项
        const menuItems = [];

        if (item.isGroup) {
            // 文件夹上下文菜单
            menuItems.push(
                { label: '重命名', action: () => this.showRenameDialog(item, item.name) },
                { label: '复制文件夹', action: () => this.duplicateActiveItem() },
                { divider: true },
                { label: '删除文件夹', action: () => {
                    if (this.layerManager.deleteLayer()) {
                        this.renderLayerList();
                        this.render();
                        this.saveHistory();
                    }
                }}
            );
        } else {
            // 图层上下文菜单
            const allGroups = this.getAllGroups();

            menuItems.push(
                { label: '重命名', action: () => this.showRenameDialog(item, item.name) },
                { label: '复制图层', action: () => this.duplicateActiveItem() },
                { divider: true },
                { label: '向下合并', action: () => this.mergeDown(), disabled: !this.canMergeDown() }
            );

            if (allGroups.length > 0) {
                menuItems.push({ divider: true });
                menuItems.push({ label: '移动到文件夹 ▶', submenu: true, action: () => this.showMoveToGroupSubmenu(menu, item, allGroups) });
            }

            if (item.parent) {
                menuItems.push({ label: '移出文件夹', action: () => {
                    this.layerManager.moveToRoot(item);
                    this.renderLayerList();
                    this.saveHistory();
                }});
            }

            menuItems.push({ divider: true });
            menuItems.push({ label: '删除图层', action: () => {
                if (this.layerManager.deleteLayer()) {
                    this.renderLayerList();
                    this.render();
                    this.saveHistory();
                }
            }});
        }

        // 创建菜单项
        menuItems.forEach(itemData => {
            if (itemData.divider) {
                const divider = document.createElement('div');
                divider.className = 'context-menu-divider';
                menu.appendChild(divider);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                if (itemData.disabled) {
                    menuItem.classList.add('disabled');
                }
                menuItem.textContent = itemData.label;

                if (!itemData.disabled) {
                    menuItem.onclick = (e) => {
                        e.stopPropagation();
                        if (!itemData.submenu) {
                            menu.remove();
                            itemData.action();
                        } else {
                            itemData.action();
                        }
                    };
                }

                menu.appendChild(menuItem);
            }
        });

        // 临时添加到 body 以测量大小
        menu.style.visibility = 'hidden';
        document.body.appendChild(menu);

        // 获取菜单大小和窗口尺寸
        const menuRect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // 计算位置以保持菜单在窗口边界内
        let left = x;
        let top = y;

        // 如果菜单会溢出右边缘，则调整水平位置
        if (left + menuRect.width > windowWidth) {
            left = windowWidth - menuRect.width - 10; // 10px 边距
        }
        // 确保不会超出左边缘
        if (left < 10) {
            left = 10;
        }

        // 如果菜单会溢出底部边缘，则调整垂直位置
        if (top + menuRect.height > windowHeight) {
            top = windowHeight - menuRect.height - 10; // 10px 边距
        }
        // 确保不会超出顶部边缘
        if (top < 10) {
            top = 10;
        }

        // 应用最终位置并使其可见
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.visibility = 'visible';

        // 点击外部时关闭菜单
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    showMoveToGroupSubmenu(parentMenu, layer, groups) {
        // 移除任何现有的子菜单
        const existingSubmenu = document.querySelector('.context-menu-submenu');
        if (existingSubmenu) {
            existingSubmenu.remove();
        }

        // 创建子菜单
        const submenu = document.createElement('div');
        submenu.className = 'context-menu context-menu-submenu';

        // Add group items first to calculate size
        groups.forEach(group => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = group.name;
            menuItem.onclick = (e) => {
                e.stopPropagation();
                this.layerManager.moveToGroup(layer, group);
                this.renderLayerList();
                this.saveHistory();
                parentMenu.remove();
                submenu.remove();
            };
            submenu.appendChild(menuItem);
        });

        // 临时添加到 body 以测量大小
        submenu.style.visibility = 'hidden';
        document.body.appendChild(submenu);

        // Get parent menu position and submenu size
        const rect = parentMenu.getBoundingClientRect();
        const submenuRect = submenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Calculate horizontal position
        let left = rect.right;
        // If submenu would overflow right edge, show it on the left side
        if (left + submenuRect.width > windowWidth) {
            left = rect.left - submenuRect.width;
        }

        // Calculate vertical position
        let top = rect.top;
        // If submenu would overflow bottom edge, adjust upward
        if (top + submenuRect.height > windowHeight) {
            top = windowHeight - submenuRect.height - 10; // 10px margin
        }
        // Ensure it doesn't go above the top
        if (top < 10) {
            top = 10;
        }

        // Apply final position
        submenu.style.left = `${left}px`;
        submenu.style.top = `${top}px`;
        submenu.style.visibility = 'visible';
    }

    getAllGroups() {
        const groups = [];
        const traverse = (items) => {
            for (const item of items) {
                if (item.isGroup) {
                    groups.push(item);
                    traverse(item.children);
                }
            }
        };
        traverse(this.layerManager.layers);
        return groups;
    }

    canMergeDown() {
        const activeItem = this.layerManager.activeItem;
        if (!activeItem || activeItem.isGroup) return false;

        // Find the layer below the active layer
        const allItems = this.layerManager.getAllItems();
        const currentIndex = allItems.indexOf(activeItem);

        // Check if there's a layer below (not a group)
        for (let i = currentIndex + 1; i < allItems.length; i++) {
            if (!allItems[i].isGroup) {
                return true;
            }
        }

        return false;
    }

    mergeDown() {
        const activeItem = this.layerManager.activeItem;
        if (!activeItem || activeItem.isGroup) return;

        // Find the layer below
        const allItems = this.layerManager.getAllItems();
        const currentIndex = allItems.indexOf(activeItem);

        let targetLayer = null;
        for (let i = currentIndex + 1; i < allItems.length; i++) {
            if (!allItems[i].isGroup) {
                targetLayer = allItems[i];
                break;
            }
        }

        if (!targetLayer) return;

        // Merge active layer into target layer
        targetLayer.ctx.globalAlpha = activeItem.opacity;
        targetLayer.ctx.drawImage(activeItem.canvas, 0, 0);
        targetLayer.ctx.globalAlpha = 1;

        // Delete the active layer
        if (activeItem.parent) {
            activeItem.parent.removeChild(activeItem);
        } else {
            const index = this.layerManager.layers.indexOf(activeItem);
            if (index !== -1) {
                this.layerManager.layers.splice(index, 1);
            }
        }

        // Set target layer as active
        this.layerManager.setActiveItem(targetLayer);

        this.renderLayerList();
        this.render();
        this.saveHistory();
    }

    showRenameDialog(item, currentName) {
        // Create custom dialog
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = item.isGroup ? '重命名文件夹' : '重命名图层';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'dialog-input';
        input.value = currentName;
        input.placeholder = item.isGroup ? '输入文件夹名称' : '输入图层名称';

        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.className = 'dialog-btn dialog-btn-ok';
        okBtn.onclick = () => {
            const newName = input.value.trim();
            if (newName) {
                this.layerManager.renameLayer(item, newName);
                this.renderLayerList();
                this.saveHistory();
            }
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
        dialog.appendChild(input);
        dialog.appendChild(buttons);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Focus and select input text
        setTimeout(() => {
            input.focus();
            input.select();
        }, 10);

        // Enter key to confirm
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
    }

    updateZoomDisplay() {
        this.zoomVal.textContent = `${this.canvasManager.zoom * 100}%`;
        this.canvasSize.textContent = `${this.canvasManager.width} × ${this.canvasManager.height}`;
    }

    // 历史记录管理方法
    saveHistory() {
        // 辅助函数用于序列化图层树
        const serializeItem = (item) => {
            if (item.isGroup) {
                return {
                    name: item.name,
                    visible: item.visible,
                    opacity: item.opacity,
                    isGroup: true,
                    expanded: item.expanded,
                    children: item.children.map(child => serializeItem(child))
                };
            } else {
                return {
                    name: item.name,
                    visible: item.visible,
                    opacity: item.opacity,
                    isGroup: false,
                    imageData: item.ctx.getImageData(0, 0, item.canvas.width, item.canvas.height)
                };
            }
        };

        const state = {
            layers: this.layerManager.layers.map(item => serializeItem(item)),
            activeLayerIndex: this.layerManager.activeLayerIndex,
            width: this.config.width,
            height: this.config.height
        };
        this.eventManager.saveState(state);
    }

    undo() {
        const state = this.eventManager.undo();
        if (state) {
            this.restoreState(state);
        }
    }

    redo() {
        const state = this.eventManager.redo();
        if (state) {
            this.restoreState(state);
        }
    }

    restoreState(state) {
        // 清除现有图层
        this.layerManager.clearLayers();

        // 如果画布大小改变则恢复
        if (state.width !== this.config.width || state.height !== this.config.height) {
            this.config.width = state.width;
            this.config.height = state.height;
            this.canvasManager.resize(state.width, state.height);
            this.selectionManager.resize(state.width, state.height);
        }

        // 辅助函数用于反序列化图层树
        const deserializeItem = (itemData, parent = null) => {
            if (itemData.isGroup) {
                const group = new LayerGroup(itemData.name);
                group.visible = itemData.visible;
                group.opacity = itemData.opacity;
                group.expanded = itemData.expanded;
                group.parent = parent;

                // 递归恢复子项
                itemData.children.forEach(childData => {
                    const child = deserializeItem(childData, group);
                    group.children.push(child);
                });

                return group;
            } else {
                // 直接创建图层而不使用 addLayer 以避免自动添加到图层数组
                const layer = new Layer(state.width, state.height, itemData.name);
                layer.visible = itemData.visible;
                layer.opacity = itemData.opacity;
                layer.parent = parent;
                layer.ctx.putImageData(itemData.imageData, 0, 0);
                return layer;
            }
        };

        // 在恢复之前清除图层数组
        this.layerManager.layers = [];

        // 恢复图层
        state.layers.forEach(itemData => {
            const item = deserializeItem(itemData);
            this.layerManager.layers.push(item);
        });

        // 恢复活动图层
        this.layerManager.setActiveLayer(state.activeLayerIndex);

        // 更新 UI
        this.renderLayerList();
        this.render();
    }

    setupEvents() {
        const displayCanvas = this.canvasManager.displayCanvas;

        // 统一的事件处理函数
        const handleStart = (e, isTouch = false) => {
            if (!isTouch && e.button !== 0) return;
            if (isTouch && e.preventDefault) e.preventDefault();
            const pos = this.canvasManager.getMousePos(e);
            console.log('[DEBUG] start - currentTool:', this.tools.currentTool, 'pos:', pos);
            this.tools.startDrawing(pos.x, pos.y, !isTouch && e.shiftKey);
            this.render();
        };

        const handleMove = (e, isTouch = false) => {
            if (isTouch && e.preventDefault) e.preventDefault();
            const pos = this.canvasManager.getMousePos(e);
            if (this.tools.isDrawing) {
                console.log('[DEBUG] move - currentTool:', this.tools.currentTool, 'pos:', pos);
                this.tools.continueDrawing(pos.x, pos.y);
                this.render();
            } else if (!isTouch) {
                this.coordInfo.textContent = `X: ${pos.x}, Y: ${pos.y}`;
                this.mousePos = pos;
                this.render();
            }
        };

        const handleEnd = (e, isTouch = false) => {
            if (isTouch && e.preventDefault) e.preventDefault();
            if (this.tools.isDrawing) {
                console.log('[DEBUG] end - currentTool:', this.tools.currentTool);
                const pos = this.canvasManager.getMousePos(e);
                if (this.tools.currentTool === 'rectSelect') {
                    this.tools.finishRectSelection(pos.x, pos.y);
                } else if (this.tools.currentTool === 'move') {
                    this.tools.finishMove(pos.x, pos.y);
                } else if (this.tools.currentTool === 'picker') {
                    this.colorPicker.value = this.tools.color;
                }
                this.tools.stopDrawing();
                this.renderLayerList();
                this.render();
                if (this.tools.currentTool !== 'picker' && this.tools.currentTool !== 'rectSelect') {
                    this.saveHistory();
                }
            } else if (this.tools.currentTool === 'bucket' && e.target === displayCanvas) {
                this.renderLayerList();
                this.render();
                this.saveHistory();
            }
        };

        // 鼠标事件
        displayCanvas.addEventListener('mousedown', (e) => handleStart(e));
        window.addEventListener('mousemove', (e) => handleMove(e));
        window.addEventListener('mouseup', (e) => handleEnd(e));

        // 触摸事件
        displayCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleStart(e.touches[0], true);
        });
        displayCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMove(e.touches[0], true);
        });
        displayCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleEnd(e.changedTouches[0], true);
        });

        // 坐标显示和光标跟踪
        displayCanvas.addEventListener('mousemove', (e) => {
            const pos = this.canvasManager.getMousePos(e);
            this.coordInfo.textContent = `X: ${pos.x}, Y: ${pos.y}`;
            this.mousePos = pos;
            if (!this.tools.isDrawing) {
                this.render(); // 更新光标位置
            }
        });

        // 跟踪鼠标进入/离开以控制光标可见性
        displayCanvas.addEventListener('mouseenter', () => {
            this.isMouseOverCanvas = true;
            this.render();
        });

        displayCanvas.addEventListener('mouseleave', () => {
            this.isMouseOverCanvas = false;
            this.render();
        });

        // 缩放
        displayCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.canvasManager.adjustZoom(e.deltaY);
            this.updateZoomDisplay();
        });

        // 缩放按钮
        document.getElementById('zoomIn').onclick = () => {
            this.canvasManager.adjustZoom(-100);
            this.updateZoomDisplay();
        };
        document.getElementById('zoomOut').onclick = () => {
            this.canvasManager.adjustZoom(100);
            this.updateZoomDisplay();
        };

        // 工具按钮
        document.getElementById('toolPencil').onclick = () => {
            this.tools.setTool('pencil');
            this.updateToolButtons();
            this.render();
        };
        document.getElementById('toolEraser').onclick = () => {
            this.tools.setTool('eraser');
            this.updateToolButtons();
            this.render();
        };
        document.getElementById('toolPicker').onclick = () => {
            this.tools.setTool('picker');
            this.updateToolButtons();
            this.render();
        };
        document.getElementById('toolRectSelect').onclick = () => {
            this.tools.setTool('rectSelect');
            this.updateToolButtons();
            this.render();
        };

        // 颜色选择器
        this.colorPicker.addEventListener('input', (e) => {
            this.tools.setColor(e.target.value);
        });

        // 工具选项栏控件
        // 选区模式
        document.getElementById('selectionMode').addEventListener('change', (e) => {
            this.tools.setSelectionMode(e.target.value);
        });

        // 移动工具的自动选择
        document.getElementById('autoSelect').addEventListener('change', (e) => {
            this.tools.setAutoSelect(e.target.checked);
        });

        // 橡皮擦形状
        document.getElementById('eraserShape').addEventListener('change', (e) => {
            this.tools.setEraserShape(e.target.value);
        });

        // 工具选项栏中的画笔大小
        const toolBrushSizeInput = document.getElementById('toolBrushSize');
        const toolBrushSizeLabel = document.getElementById('toolBrushSizeLabel');
        toolBrushSizeInput.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.tools.setBrushSize(size);
            toolBrushSizeLabel.textContent = size;
        });

        // 图层控件
        document.getElementById('addLayerBtn').onclick = () => {
            this.layerManager.addLayer(this.config.width, this.config.height);
            this.renderLayerList();
            this.render();
            this.saveHistory();
        };
        document.getElementById('addGroupBtn').onclick = () => {
            this.layerManager.addGroup();
            this.renderLayerList();
            this.saveHistory();
        };
        document.getElementById('delLayerBtn').onclick = () => {
            if (this.layerManager.deleteLayer()) {
                this.renderLayerList();
                this.render();
                this.saveHistory();
            }
        };

        // PSD 输入输出
        document.getElementById('fileInput').addEventListener('change', (e) => this.handlePsdLoad(e));

        // 键盘快捷键
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(e) {
        // 如果在输入框中，不处理快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // 工具快捷键
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                this.tools.setTool('pencil');
                this.updateToolButtons();
                this.render();
            } else if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                this.tools.setTool('eraser');
                this.updateToolButtons();
                this.render();
            } else if (e.key === 'i' || e.key === 'I') {
                e.preventDefault();
                this.tools.setTool('picker');
                this.updateToolButtons();
                this.render();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                this.tools.setTool('rectSelect');
                this.updateToolButtons();
                this.render();
            }
        }

        // Delete: 删除当前图层/文件夹
        if (e.key === 'Delete') {
            e.preventDefault();
            if (this.layerManager.deleteLayer()) {
                this.renderLayerList();
                this.render();
                this.saveHistory();
            }
        }

        // Ctrl+D: 取消选择（在选区工具模式下）
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();

                this.selectionManager.clear();
                this.render();

        }

        // Ctrl+A: 全选（在选区工具模式下）
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();

                this.selectionManager.selectAll();
                this.render();

        }

        // Ctrl+J: 复制当前图层/文件夹或在存在选区时分离图层
        if (e.ctrlKey && e.key === 'j') {
            e.preventDefault();
            this.duplicateOrSplitActiveItem();
        }
    }

    duplicateOrSplitActiveItem() {
        const activeItem = this.layerManager.activeItem;
        if (!activeItem) return;

        // 如果有选区且活动项是图层，则分离图层
        if (this.selectionManager.hasSelection && !activeItem.isGroup) {
            this.splitLayerBySelection(activeItem);
        } else {
            // 否则，复制图层/文件夹
            this.duplicateActiveItem();
        }
    }

    duplicateActiveItem() {
        const activeItem = this.layerManager.activeItem;
        if (!activeItem) return;

        if (activeItem.isGroup) {
            // 复制文件夹及其所有内容
            const newGroup = this.duplicateGroup(activeItem);
            if (activeItem.parent) {
                const index = activeItem.parent.children.indexOf(activeItem);
                activeItem.parent.children.splice(index + 1, 0, newGroup);
                newGroup.parent = activeItem.parent;
            } else {
                const index = this.layerManager.layers.indexOf(activeItem);
                this.layerManager.layers.splice(index + 1, 0, newGroup);
            }
            this.layerManager.setActiveItem(newGroup);
        } else {
            // 复制图层
            const newLayer = this.duplicateLayer(activeItem);
            if (activeItem.parent) {
                const index = activeItem.parent.children.indexOf(activeItem);
                activeItem.parent.children.splice(index + 1, 0, newLayer);
                newLayer.parent = activeItem.parent;
            } else {
                const index = this.layerManager.layers.indexOf(activeItem);
                this.layerManager.layers.splice(index + 1, 0, newLayer);
            }
            this.layerManager.setActiveItem(newLayer);
        }

        this.renderLayerList();
        this.render();
        this.saveHistory();
    }

    splitLayerBySelection(layer) {
        // 创建一个包含选中内容的新图层
        const newLayer = this.layerManager.addLayer(
            layer.canvas.width,
            layer.canvas.height,
            layer.name + ' (选区)'
        );

        // 从图层数组中移除（我们将在正确的位置重新添加它）
        const index = this.layerManager.layers.indexOf(newLayer);
        if (index !== -1) {
            this.layerManager.layers.splice(index, 1);
        }

        // 复制属性
        newLayer.visible = layer.visible;
        newLayer.opacity = layer.opacity;
        newLayer.parent = layer.parent;

        // 获取选区边界
        const bounds = this.selectionManager.getBounds();
        if (!bounds) return;

        // 将选中的像素复制到新图层并从旧图层中移除
        const layerData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

        for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
            for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
                if (this.selectionManager.isSelected(x, y)) {
                    const i = (y * layer.canvas.width + x) * 4;
                    const r = layerData.data[i];
                    const g = layerData.data[i + 1];
                    const b = layerData.data[i + 2];
                    const a = layerData.data[i + 3];

                    // 复制到新图层
                    if (a > 0) {
                        newLayer.ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
                        newLayer.ctx.fillRect(x, y, 1, 1);
                    }

                    // 从旧图层清除
                    layer.ctx.clearRect(x, y, 1, 1);
                }
            }
        }

        // 在原图层的上方添加新图层
        if (layer.parent) {
            const index = layer.parent.children.indexOf(layer);
            layer.parent.children.splice(index + 1, 0, newLayer);
            newLayer.parent = layer.parent;
        } else {
            const index = this.layerManager.layers.indexOf(layer);
            this.layerManager.layers.splice(index + 1, 0, newLayer);
        }

        // 将新图层设置为活动图层
        this.layerManager.setActiveItem(newLayer);

        // 清除选区
        this.selectionManager.clear();

        this.renderLayerList();
        this.render();
        this.saveHistory();
    }

    duplicateLayer(layer) {
        const newLayer = this.layerManager.addLayer(
            layer.canvas.width,
            layer.canvas.height,
            layer.name + ' 副本'
        );

        // 从图层数组中移除（我们将在正确的位置重新添加它）
        const index = this.layerManager.layers.indexOf(newLayer);
        if (index !== -1) {
            this.layerManager.layers.splice(index, 1);
        }

        // 复制属性
        newLayer.visible = layer.visible;
        newLayer.opacity = layer.opacity;
        newLayer.parent = layer.parent;

        // 复制画布内容
        newLayer.ctx.drawImage(layer.canvas, 0, 0);

        return newLayer;
    }

    duplicateGroup(group) {
        const newGroup = new LayerGroup(group.name + ' 副本');
        newGroup.visible = group.visible;
        newGroup.opacity = group.opacity;
        newGroup.expanded = group.expanded;
        newGroup.parent = group.parent;

        // 递归复制子项
        for (const child of group.children) {
            if (child.isGroup) {
                // 对于嵌套组，保持原始名称（不添加"副本"）
                const newChild = this.duplicateGroupKeepName(child);
                newGroup.addChild(newChild);
            } else {
                // 对于图层，保持原始名称（不添加"副本"）
                const newChild = this.duplicateLayerKeepName(child);
                newGroup.addChild(newChild);
            }
        }

        return newGroup;
    }

    duplicateGroupKeepName(group) {
        const newGroup = new LayerGroup(group.name); // 保持原始名称
        newGroup.visible = group.visible;
        newGroup.opacity = group.opacity;
        newGroup.expanded = group.expanded;

        // 递归复制子项
        for (const child of group.children) {
            if (child.isGroup) {
                const newChild = this.duplicateGroupKeepName(child);
                newGroup.addChild(newChild);
            } else {
                const newChild = this.duplicateLayerKeepName(child);
                newGroup.addChild(newChild);
            }
        }

        return newGroup;
    }

    duplicateLayerKeepName(layer) {
        // 直接创建图层而不使用 addLayer
        const newLayer = new Layer(layer.canvas.width, layer.canvas.height, layer.name); // 保持原始名称

        // 复制属性
        newLayer.visible = layer.visible;
        newLayer.opacity = layer.opacity;

        // 复制画布内容
        newLayer.ctx.drawImage(layer.canvas, 0, 0);

        return newLayer;
    }

    updateToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const toolMap = {
            'pencil': 'toolPencil',
            'eraser': 'toolEraser',
            'picker': 'toolPicker',
            'rectSelect': 'toolRectSelect'
        };

        let btnId = toolMap[this.tools.currentTool];

        // 检查自定义工具
        if (!btnId && this.customTools.has(this.tools.currentTool)) {
            btnId = `tool${this.tools.currentTool.charAt(0).toUpperCase() + this.tools.currentTool.slice(1)}`;
        }

        if (btnId) {
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.add('active');
        }

        this.colorPicker.value = this.tools.color;
        this.updateCanvasCursor();
        this.updateToolOptionsBar();
    }

    updateCanvasCursor() {
        const displayCanvas = this.canvasManager.displayCanvas;
        const tool = this.tools.currentTool;

        displayCanvas.classList.remove('cursor-none', 'cursor-crosshair', 'cursor-move', 'cursor-picker');

        // 检查自定义工具
        if (this.customTools.has(tool)) {
            const customTool = this.customTools.get(tool);
            if (customTool.cursor) {
                displayCanvas.classList.add(`cursor-${customTool.cursor}`);
            }
            return;
        }

        // 内置工具光标
        if (tool === 'brush' || tool === 'pencil' || tool === 'eraser') {
            displayCanvas.classList.add('cursor-none');
        } else if (tool === 'rectSelect') {
            displayCanvas.classList.add('cursor-crosshair');
        } else if (tool === 'move') {
            displayCanvas.classList.add('cursor-move');
        } else if (tool === 'picker' || tool === 'bucket') {
            displayCanvas.classList.add('cursor-crosshair');
        }
    }

    updateToolOptionsBar() {
        // 隐藏所有工具选项
        const customToolOptions = document.getElementById('customToolOptions');
        customToolOptions.querySelectorAll('.tool-options').forEach(el => el.style.display = 'none');

        const tool = this.tools.currentTool;

        // 检查自定义工具
        if (this.customTools.has(tool)) {
            const optionsDiv = document.getElementById(`${tool}Options`);
            if (optionsDiv) {
                optionsDiv.style.display = 'flex';
            }
            return;
        }

        // 内置工具选项
        if (tool === 'rectSelect') {
            document.getElementById('rectSelectOptions').style.display = 'flex';
        } else if (tool === 'move') {
            document.getElementById('moveOptions').style.display = 'flex';
        } else if (tool === 'brush' || tool === 'pencil' || tool === 'eraser') {
            document.getElementById('brushOptions').style.display = 'flex';
            const sizeInput = document.getElementById('toolBrushSize');
            const sizeLabel = document.getElementById('toolBrushSizeLabel');
            sizeInput.value = this.tools.brushSize;
            sizeLabel.textContent = this.tools.brushSize;

            const eraserShapeContainer = document.getElementById('eraserShapeContainer');
            if (tool === 'eraser') {
                eraserShapeContainer.style.display = 'inline';
                document.getElementById('eraserShape').value = this.tools.eraserShape;
            } else {
                eraserShapeContainer.style.display = 'none';
            }
        }
    }

    async handlePsdLoad(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const psd = agPsd.readPsd(buffer);

            this.canvasManager.resize(psd.width, psd.height);
            this.selectionManager.resize(psd.width, psd.height);
            this.layerManager.clearLayers();
            this.config.width = this.canvasManager.width;
            this.config.height = this.canvasManager.height;
            this.eventManager.clear();

            // 辅助函数用于递归处理 PSD 图层和组
            const processLayer = (psdLayer, parent = null) => {
                // 检查这是否是组/文件夹
                if (psdLayer.children && psdLayer.children.length > 0) {
                    // 创建一个组
                    const group = new LayerGroup(psdLayer.name || 'Group');
                    group.visible = !psdLayer.hidden;
                    group.opacity = psdLayer.opacity != null ? psdLayer.opacity : 1;
                    group.parent = parent;

                    // 递归处理子项
                    for (const child of psdLayer.children) {
                        const childItem = processLayer(child, group);
                        if (childItem) {
                            group.children.push(childItem);
                        }
                    }

                    return group;
                } else if (psdLayer.canvas) {
                    // 直接创建常规图层（不使用 addLayer 以避免自动添加到根）
                    const layer = new Layer(psd.width, psd.height, psdLayer.name || 'Layer');
                    layer.visible = !psdLayer.hidden;
                    layer.opacity = psdLayer.opacity != null ? psdLayer.opacity : 1;
                    layer.parent = parent;

                    const left = psdLayer.left || 0;
                    const top = psdLayer.top || 0;
                    layer.ctx.drawImage(psdLayer.canvas, left, top);

                    return layer;
                }

                return null;
            };

            const layersToProcess = psd.children ? psd.children : [];

            if (layersToProcess.length === 0 && psd.canvas) {
                // 单个背景图层
                const layer = this.layerManager.addLayer(psd.width, psd.height, 'Background');
                layer.ctx.drawImage(psd.canvas, 0, 0);
            } else {
                // 在添加新项之前清除图层数组
                this.layerManager.layers = [];

                // 处理所有图层和组
                for (const child of layersToProcess) {
                    const item = processLayer(child);
                    if (item) {
                        this.layerManager.layers.push(item);
                    }
                }
            }

            if (this.layerManager.layers.length === 0) {
                this.layerManager.addLayer(psd.width, psd.height, 'Background');
            }

            this.layerManager.setActiveLayer(this.layerManager.layers.length - 1);
            this.renderLayerList();
            this.render();

            // 添加到历史记录
            this.saveHistory();
            e.target.value = '';
            Toast.show('PSD 文件加载成功', 'success');

        } catch (err) {
            console.error(err);
            Toast.show('读取 PSD 失败: ' + err.message, 'error');
        }
    }

    // 注册自定义工具
    registerTool(config) {
        const { id, name, icon, shortcut, cursor, weight = 100, onStart, onMove, onEnd, optionsHTML, onOptionsInit } = config;

        if (!id || !name || !icon) {
            console.error('registerTool: id, name, icon are required');
            return;
        }

        // 存储工具配置
        this.customTools.set(id, { name, icon, shortcut, cursor, weight, onStart, onMove, onEnd, optionsHTML, onOptionsInit });

        // 创建工具按钮
        const toolsPanel = document.querySelector('.tools-panel');
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.id = `tool${id.charAt(0).toUpperCase() + id.slice(1)}`;
        btn.title = `${name}${shortcut ? ` (${shortcut})` : ''}`;
        btn.innerHTML = icon;
        btn.dataset.weight = weight;
        btn.onclick = () => {
            this.tools.setTool(id);
            this.updateToolButtons();
            this.render();
        };

        // 根据权重插入到合适位置
        const colorPicker = document.getElementById('colorPicker');
        const buttons = Array.from(toolsPanel.querySelectorAll('.tool-btn'));
        let inserted = false;
        for (const existingBtn of buttons) {
            const existingWeight = parseInt(existingBtn.dataset.weight || '100');
            if (weight < existingWeight) {
                toolsPanel.insertBefore(btn, existingBtn);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            toolsPanel.insertBefore(btn, colorPicker);
        }

        // 创建工具选项栏
        if (optionsHTML) {
            const customOptionsContainer = document.getElementById('customToolOptions');

            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'tool-options';
            optionsDiv.id = `${id}Options`;
            optionsDiv.style.display = 'none';
            optionsDiv.innerHTML = optionsHTML;
            customOptionsContainer.appendChild(optionsDiv);

            if (onOptionsInit) {
                onOptionsInit(optionsDiv, { app: this, tools: this.tools });
            }
        }

        // 注册快捷键
        if (shortcut) {
            const oldHandler = this.handleKeyDown.bind(this);
            this.handleKeyDown = (e) => {
                if (!e.ctrlKey && !e.altKey && !e.metaKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    if (e.key.toLowerCase() === shortcut.toLowerCase()) {
                        e.preventDefault();
                        this.tools.setTool(id);
                        this.updateToolButtons();
                        this.render();
                        return;
                    }
                }
                oldHandler(e);
            };
        }
    }

    handlePsdSave() {
        try {
            // 辅助函数用于递归转换图层树为 PSD 格式
            const convertToPsdFormat = (item) => {
                if (item.isGroup) {
                    // 转换组/文件夹
                    return {
                        name: item.name,
                        hidden: !item.visible,
                        opacity: item.opacity,
                        children: item.children.map(child => convertToPsdFormat(child))
                    };
                } else {
                    // 转换常规图层
                    return {
                        name: item.name,
                        hidden: !item.visible,
                        opacity: item.opacity,
                        canvas: item.canvas
                    };
                }
            };

            const psdChildren = this.layerManager.layers.map(item => convertToPsdFormat(item));

            const psdData = {
                width: this.canvasManager.width,
                height: this.canvasManager.height,
                children: psdChildren
            };

            const buffer = agPsd.writePsd(psdData);
            const blob = new Blob([buffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pixel-art-pro.psd';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Toast.show('PSD 文件保存成功', 'success');

        } catch (err) {
            console.error(err);
            Toast.show('保存 PSD 失败: ' + err.message, 'error');
        }
    }
}

// 当 DOM 准备就绪时初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new PhotoShopApp();
    app.init();

    // 暴露到全局作用域以便油猴脚本集成
    window.photoShopApp = app;
});
