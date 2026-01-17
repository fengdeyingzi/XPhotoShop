// 图层类定义
export class Layer {
    constructor(width, height, name) {
        this.name = name;
        this.visible = true;
        this.opacity = 1;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.ctx.imageSmoothingEnabled = false;
        this.isGroup = false;
        this.parent = null; // 对父组的引用
    }
}

// 图层组类定义（文件夹）
export class LayerGroup {
    constructor(name) {
        this.name = name;
        this.visible = true;
        this.opacity = 1;
        this.isGroup = true;
        this.expanded = true; // 文件夹在 UI 中是否展开
        this.children = []; // Layer 或 LayerGroup 的数组
        this.parent = null; // 对父组的引用
    }

    // 将子项添加到此组
    addChild(child) {
        child.parent = this;
        this.children.push(child);
    }

    // 从此组中移除子项
    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    // 获取所有图层（递归，扁平化）
    getAllLayers() {
        const layers = [];
        for (const child of this.children) {
            if (child.isGroup) {
                layers.push(...child.getAllLayers());
            } else {
                layers.push(child);
            }
        }
        return layers;
    }

    // 检查此组或任何父组是否不可见
    isEffectivelyVisible() {
        if (!this.visible) return false;
        if (this.parent) return this.parent.isEffectivelyVisible();
        return true;
    }
}

// 图层管理器
export class LayerManager {
    constructor() {
        this.layers = []; // 根级项目（Layer 或 LayerGroup）
        this.activeLayerIndex = 0;
        this.activeItem = null; // 可以是 Layer 或 LayerGroup
        this.selectedItems = []; // 多选的图层数组
    }

    addLayer(width, height, name = `Layer ${this.getAllLayers().length + 1}`) {
        const layer = new Layer(width, height, name);
        this.layers.push(layer);
        this.activeLayerIndex = this.layers.length - 1;
        this.activeItem = layer;
        return layer;
    }

    // 添加新组（文件夹）
    addGroup(name = `Group ${this.layers.length + 1}`) {
        const group = new LayerGroup(name);
        this.layers.push(group);
        this.activeLayerIndex = this.layers.length - 1;
        this.activeItem = group;
        return group;
    }

    // 获取所有图层（扁平化，包括组中的图层）
    getAllLayers() {
        const layers = [];
        const traverse = (items) => {
            for (const item of items) {
                if (item.isGroup && Array.isArray(item.children)) {
                    traverse(item.children);
                } else if (!item.isGroup) {
                    layers.push(item);
                }
            }
        };
        traverse(this.layers);
        return layers;
    }

    // 按显示顺序获取所有项目（包括组）（从上到下）
    getAllItems() {
        const items = [];
        const traverse = (itemList) => {
            for (let i = itemList.length - 1; i >= 0; i--) {
                const item = itemList[i];
                items.push(item);
                if (item.isGroup && item.expanded) {
                    traverse(item.children);
                }
            }
        };
        traverse(this.layers);
        return items;
    }

    // 通过引用查找项目
    findItemIndex(targetItem) {
        for (let i = 0; i < this.layers.length; i++) {
            if (this.layers[i] === targetItem) {
                return i;
            }
        }
        return -1;
    }

    deleteLayer() {
        if (!this.activeItem) return false;

        // 获取要删除的项目列表（多选或单选）
        const itemsToDelete = this.selectedItems.length > 0 ? [...this.selectedItems] : [this.activeItem];

        // 如果是唯一的图层，则不允许删除
        const allLayers = this.getAllLayers();
        const nonGroupItems = itemsToDelete.filter(item => !item.isGroup);
        if (allLayers.length <= nonGroupItems.length) {
            alert("至少需要保留一个图层");
            return false;
        }

        // 删除所有选中的项目
        for (const item of itemsToDelete) {
            // 从父级或根级移除
            if (item.parent) {
                // 确保 parent 是 LayerGroup 对象并且有 removeChild 方法
                if (item.parent.removeChild && typeof item.parent.removeChild === 'function') {
                    item.parent.removeChild(item);
                } else {
                    // 如果 parent 无效，从根级移除
                    console.warn('Invalid parent object, removing from root instead');
                    const index = this.findItemIndex(item);
                    if (index !== -1) {
                        this.layers.splice(index, 1);
                    }
                }
            } else {
                const index = this.findItemIndex(item);
                if (index !== -1) {
                    this.layers.splice(index, 1);
                }
            }
        }

        // 清空选中列表
        this.selectedItems = [];

        // 设置新的活动图层
        if (this.layers.length > 0) {
            this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            this.activeItem = this.layers[this.activeLayerIndex];
            // 如果活动项是组，则查找第一个实际图层
            if (this.activeItem && this.activeItem.isGroup) {
                const firstLayer = this.getAllLayers()[0];
                this.activeItem = firstLayer || this.activeItem;
            }
        }

        return true;
    }

    setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            this.activeItem = this.layers[index];
            return true;
        }
        return false;
    }

    setActiveItem(item, multiSelect = false) {
        if (multiSelect) {
            // Ctrl+点击多选模式
            const index = this.selectedItems.indexOf(item);
            if (index !== -1) {
                // 如果已选中，则取消选中
                this.selectedItems.splice(index, 1);
                // 如果取消选中的是当前活动项，设置最后一个选中项为活动项
                if (this.activeItem === item && this.selectedItems.length > 0) {
                    this.activeItem = this.selectedItems[this.selectedItems.length - 1];
                } else if (this.selectedItems.length === 0) {
                    this.activeItem = null;
                }
            } else {
                // 添加到选中列表
                this.selectedItems.push(item);
                this.activeItem = item;
            }
        } else {
            // 单选模式
            this.activeItem = item;
            this.selectedItems = [item];
        }

        // 如果项目在根级，则更新 activeLayerIndex
        const index = this.findItemIndex(item);
        if (index !== -1) {
            this.activeLayerIndex = index;
        }
    }

    getActiveLayer() {
        // 如果活动项是组，则返回其中的第一个图层
        if (this.activeItem && this.activeItem.isGroup) {
            const layers = this.activeItem.getAllLayers();
            return layers.length > 0 ? layers[0] : null;
        }
        return this.activeItem;
    }

    toggleVisibility(item) {
        if (item) {
            item.visible = !item.visible;
            return true;
        }
        return false;
    }

    toggleGroupExpanded(group) {
        if (group && group.isGroup) {
            group.expanded = !group.expanded;
            return true;
        }
        return false;
    }

    fillLayer(index, color) {
        if (index >= 0 && index < this.layers.length) {
            const item = this.layers[index];
            if (!item.isGroup) {
                item.ctx.fillStyle = color;
                item.ctx.fillRect(0, 0, item.canvas.width, item.canvas.height);
                return true;
            }
        }
        return false;
    }

    clearLayers() {
        this.layers = [];
        this.activeLayerIndex = 0;
        this.activeItem = null;
    }

    resizeLayers(width, height) {
        const resizeItem = (item) => {
            if (item.isGroup) {
                item.children.forEach(resizeItem);
            } else {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = item.canvas.width;
                tempCanvas.height = item.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(item.canvas, 0, 0);

                item.canvas.width = width;
                item.canvas.height = height;
                item.ctx.drawImage(tempCanvas, 0, 0);
            }
        };

        this.layers.forEach(resizeItem);
    }

    renameLayer(item, newName) {
        if (item && newName && newName.trim()) {
            item.name = newName.trim();
            return true;
        }
        return false;
    }

    // 将图层移动到组中
    moveToGroup(layer, targetGroup) {
        if (!layer || !targetGroup || !targetGroup.isGroup) return false;

        // 从当前父级或根级移除
        if (layer.parent) {
            layer.parent.removeChild(layer);
        } else {
            const index = this.findItemIndex(layer);
            if (index !== -1) {
                this.layers.splice(index, 1);
            }
        }

        // 添加到目标组
        targetGroup.addChild(layer);
        return true;
    }

    // 将图层移出组到根级
    moveToRoot(layer) {
        if (!layer) return false;

        // 从当前父级移除
        if (layer.parent) {
            layer.parent.removeChild(layer);
        }

        // 添加到根级
        this.layers.push(layer);
        return true;
    }
}
