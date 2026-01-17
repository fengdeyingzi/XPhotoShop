# XPhotoShop API 文档

版本：v1.0.2
作者：风的影子
更新日期：2026-01-14

本文档提供了XPhotoShop的完整API参考，方便开发者编写浏览器插件（油猴脚本）来扩展功能。

**主要功能**：
- 图层管理和图层组（文件夹）支持
- 完整的绘图工具集（铅笔、画笔、橡皮擦、油漆桶等）
- 选区管理（矩形选区、选区模式、选区操作）
- 撤销/重做历史记录
- PSD文件导入导出
- 动态菜单系统
- Toast通知系统

---

## 目录

1. [核心类](#核心类)
   - [PhotoShopApp](#photoshopapp)
   - [LayerManager](#layermanager)
   - [CanvasManager](#canvasmanager)
   - [SelectionManager](#selectionmanager)
   - [EventManager](#eventmanager)
   - [MenuManager](#menumanager)
   - [PanelManager](#panelmanager)
   - [Tools](#tools)
   - [Toast](#toast)
2. [图层组管理](#图层组管理)
   - [LayerGroup](#layergroup)
3. [工具类](#工具类)
   - [Layer](#layer)
   - [Panel](#panel)
4. [工具选项栏](#工具选项栏)
5. [油猴脚本集成](#油猴脚本集成)
6. [使用示例](#使用示例)

---

## 核心类

### PhotoShopApp

主应用类，负责协调所有管理器和UI交互。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `config` | Object | 画布配置 `{width, height, zoom}` |
| `canvasManager` | CanvasManager | 画布管理器实例 |
| `layerManager` | LayerManager | 图层管理器实例 |
| `selectionManager` | SelectionManager | 选区管理器实例 |
| `eventManager` | EventManager | 事件/历史管理器实例 |
| `menuManager` | MenuManager | 菜单管理器实例 |
| `tools` | Tools | 工具管理器实例 |
| `colorPicker` | HTMLElement | 颜色选择器DOM元素 |

#### 方法

##### `init()`
初始化应用，设置所有管理器和事件监听器。

```javascript
app.init();
```

##### `render()`
渲染画布，包括所有图层、选区预览和选区边框。

```javascript
app.render();
```

##### `renderLayerList()`
更新图层面板UI，显示所有图层缩略图。

```javascript
app.renderLayerList();
```

##### `updateToolOptionsBar()`
更新工具选项栏，根据当前工具显示相应选项。

```javascript
app.updateToolOptionsBar();
```

##### `saveHistory()`
保存当前状态到历史记录，用于撤销/重做功能。

```javascript
app.saveHistory();
```

##### `undo()`
撤销上一步操作。

```javascript
app.undo();
```

##### `redo()`
重做已撤销的操作。

```javascript
app.redo();
```

##### `handlePsdLoad(event)`
处理PSD文件导入。

**参数：**
- `event` - 文件选择事件对象

```javascript
fileInput.addEventListener('change', (e) => app.handlePsdLoad(e));
```

##### `handlePsdSave()`
将当前画布导出为PSD文件。

```javascript
app.handlePsdSave();
```

##### `registerTool(config)`
注册自定义工具到工具栏。

**参数：**
- `config` (Object) - 工具配置对象：
  - `id` (String, 必需) - 工具唯一标识符
  - `name` (String, 必需) - 工具显示名称
  - `icon` (String, 必需) - 工具图标（emoji或HTML）
  - `shortcut` (String, 可选) - 键盘快捷键（单个字母）
  - `cursor` (String, 可选) - 光标样式：'none', 'crosshair', 'move', 'picker'
  - `weight` (Number, 可选) - 排序权重，默认100（越小越靠前）
  - `onStart` (Function, 可选) - 开始绘制回调 `(x, y, context) => {}`
  - `onMove` (Function, 可选) - 移动时回调 `(x, y, context) => {}`
  - `onEnd` (Function, 可选) - 结束时回调 `(x, y, context) => {}`
  - `optionsHTML` (String, 可选) - 工具选项栏HTML内容
  - `onOptionsInit` (Function, 可选) - 选项栏初始化回调 `(container, context) => {}`

**回调函数的 context 参数包含：**
- `layer` - 当前激活的图层对象
- `shiftKey` - 是否按住Shift键（仅 onStart）
- `app` - PhotoShopApp 实例
- `tools` - Tools 实例

**工具权重参考：**
- 铅笔：10
- 画笔：20（插件）
- 橡皮：30
- 取色器：40
- 油漆桶：50（插件）
- 矩形选区：60
- 移动工具：80（插件）

```javascript
// 注册自定义画笔工具
app.registerTool({
    id: 'customBrush',
    name: '自定义画笔',
    icon: '🖌️',
    shortcut: 'C',
    cursor: 'none',
    weight: 25,

    // 工具选项栏
    optionsHTML: `
        <label>大小：</label>
        <input type="range" id="customBrushSize" min="1" max="50" value="5">
        <span id="customBrushSizeLabel">5</span>
    `,

    // 初始化选项栏
    onOptionsInit: (container, { tools }) => {
        const sizeInput = container.querySelector('#customBrushSize');
        const sizeLabel = container.querySelector('#customBrushSizeLabel');
        sizeInput.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            tools.brushSize = size;
            sizeLabel.textContent = size;
        });
    },

    // 开始绘制
    onStart: (x, y, { layer, shiftKey, tools }) => {
        if (!layer || !layer.visible) return;
        tools.lastPos = { x, y };
        // 绘制逻辑
    },

    // 移动时
    onMove: (x, y, { layer, tools }) => {
        if (!layer || !tools.lastPos) return;
        // 绘制直线
        tools.lastPos = { x, y };
    },

    // 结束时
    onEnd: (x, y, { tools }) => {
        tools.lastPos = null;
    }
});
```

---

### LayerManager

图层管理器，负责图层的创建、删除、排序等操作。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `layers` | Array<Layer|LayerGroup> | 所有根级项目数组（图层或图层组） |
| `activeLayerIndex` | Number | 当前激活图层索引 |
| `activeItem` | Layer|LayerGroup | 当前激活的项目（图层或图层组） |
| `selectedItems` | Array<Layer|LayerGroup> | 当前选中的所有项目数组（支持多选） |

#### 方法

##### `addLayer(width, height, name)`
添加新图层。

**参数：**
- `width` (Number) - 图层宽度
- `height` (Number) - 图层高度
- `name` (String, 可选) - 图层名称，默认为 "Layer N"

**返回值：** Layer对象

```javascript
const layer = layerManager.addLayer(64, 64, 'My Layer');
```

##### `addGroup(name)`
添加新图层组（文件夹）。

**参数：**
- `name` (String, 可选) - 组名称，默认为 "Group N"

**返回值：** LayerGroup对象

```javascript
const group = layerManager.addGroup('My Group');
```

##### `deleteLayer()`
删除当前激活图层（至少保留一个图层）。

**返回值：** Boolean - 成功返回true，失败返回false

```javascript
if (layerManager.deleteLayer()) {
    console.log('图层已删除');
}
```

##### `setActiveLayer(index)`
设置激活图层。

**参数：**
- `index` (Number) - 图层索引

**返回值：** Boolean

```javascript
layerManager.setActiveLayer(0);
```

##### `setActiveItem(item, multiSelect)`
设置激活项目（可以是图层或图层组），支持多选。

**参数：**
- `item` (Layer|LayerGroup) - 要激活的项目
- `multiSelect` (Boolean, 可选) - 是否为多选模式（默认false）
  - `false` - 单选模式，清除其他选择
  - `true` - 多选模式，切换该项目的选中状态

```javascript
// 单选
layerManager.setActiveItem(layerManager.layers[0]);

// Ctrl+点击多选
layerManager.setActiveItem(layerManager.layers[1], true);

// 再次点击取消选中
layerManager.setActiveItem(layerManager.layers[1], true);
```

##### `getActiveLayer()`
获取当前激活的图层对象。

**返回值：** Layer对象

```javascript
const layer = layerManager.getActiveLayer();
layer.ctx.fillStyle = '#ff0000';
layer.ctx.fillRect(0, 0, 10, 10);
```

##### `toggleVisibility(index)`
切换图层可见性。

**参数：**
- `index` (Number) - 图层索引

**返回值：** Boolean

```javascript
layerManager.toggleVisibility(0);
```

##### `fillLayer(index, color)`
用纯色填充图层。

**参数：**
- `index` (Number) - 图层索引
- `color` (String) - CSS颜色值

**返回值：** Boolean

```javascript
layerManager.fillLayer(0, '#ffffff');
```

##### `clearLayers()`
清空所有图层。

```javascript
layerManager.clearLayers();
```

##### `resizeLayers(width, height)`
调整所有图层尺寸。

**参数：**
- `width` (Number) - 新宽度
- `height` (Number) - 新高度

```javascript
layerManager.resizeLayers(128, 128);
```

##### `getAllItems()`
获取所有项目（图层和图层组）的扁平化数组。

**返回值：** Array<Layer|LayerGroup>

```javascript
const allItems = layerManager.getAllItems();
console.log(`总共有 ${allItems.length} 个项目`);
```

##### `moveToGroup(item, group)`
将图层移动到图层组中。

**参数：**
- `item` (Layer) - 要移动的图层
- `group` (LayerGroup) - 目标图层组

```javascript
const layer = layerManager.getActiveLayer();
const group = layerManager.layers[0]; // 假设第一个是图层组
layerManager.moveToGroup(layer, group);
```

##### `moveToRoot(item)`
将图层移出图层组到根级别。

**参数：**
- `item` (Layer) - 要移动的图层

```javascript
layerManager.moveToRoot(activeLayer);
```

##### `toggleGroupExpanded(group)`
切换图层组的展开/折叠状态。

**参数：**
- `group` (LayerGroup) - 要切换的图层组

```javascript
const group = layerManager.layers[0];
layerManager.toggleGroupExpanded(group);
```

##### `renameLayer(item, newName)`
重命名图层或图层组。

**参数：**
- `item` (Layer|LayerGroup) - 要重命名的项目
- `newName` (String) - 新名称

```javascript
layerManager.renameLayer(activeLayer, 'New Name');
```

---

### CanvasManager

画布管理器，负责画布渲染、缩放和鼠标位置计算。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `displayCanvas` | HTMLCanvasElement | 显示画布元素 |
| `displayCtx` | CanvasRenderingContext2D | 显示画布2D上下文 |
| `width` | Number | 画布宽度（像素） |
| `height` | Number | 画布高度（像素） |
| `zoom` | Number | 缩放级别（1-30） |

#### 方法

##### `resize(width, height)`
调整画布尺寸。

**参数：**
- `width` (Number) - 新宽度
- `height` (Number) - 新高度

```javascript
canvasManager.resize(128, 128);
```

##### `setZoom(zoom)`
设置缩放级别。

**参数：**
- `zoom` (Number) - 缩放级别（1-30）

```javascript
canvasManager.setZoom(16);
```

##### `adjustZoom(delta)`
调整缩放级别。

**参数：**
- `delta` (Number) - 滚轮增量（负数放大，正数缩小）

```javascript
canvasManager.adjustZoom(-1); // 放大
```

##### `render(layers)`
渲染所有图层到显示画布。

**参数：**
- `layers` (Array<Layer>) - 图层数组

```javascript
canvasManager.render(layerManager.layers);
```

##### `getMousePos(event)`
将鼠标事件坐标转换为画布坐标。

**参数：**
- `event` (MouseEvent) - 鼠标事件

**返回值：** `{x: Number, y: Number}`

```javascript
canvas.addEventListener('click', (e) => {
    const pos = canvasManager.getMousePos(e);
    console.log(`点击位置: (${pos.x}, ${pos.y})`);
});
```

---

### SelectionManager

选区管理器，使用灰度蒙版支持任意形状选区。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `width` | Number | 选区画布宽度 |
| `height` | Number | 选区画布高度 |
| `hasSelection` | Boolean | 是否存在选区 |
| `canvas` | HTMLCanvasElement | 选区蒙版画布（白色=选中） |
| `ctx` | CanvasRenderingContext2D | 选区蒙版2D上下文 |
| `selectionColor` | String | 选区边框颜色（默认灰色 #808080） |

#### 方法

##### `resize(width, height)`
调整选区画布尺寸。

**参数：**
- `width` (Number) - 新宽度
- `height` (Number) - 新高度

```javascript
selectionManager.resize(128, 128);
```

##### `clear()`
清除选区。

```javascript
selectionManager.clear();
```

##### `selectRect(x, y, width, height, mode)`
创建或修改矩形选区。

**参数：**
- `x` (Number) - 起始X坐标
- `y` (Number) - 起始Y坐标
- `width` (Number) - 宽度
- `height` (Number) - 高度
- `mode` (String, 可选) - 选区模式：
  - `'new'` (默认) - 新选区，清除旧选区
  - `'add'` - 添加到选区
  - `'subtract'` - 从选区减去
  - `'intersect'` - 与选区交叉

```javascript
// 创建新选区
selectionManager.selectRect(10, 10, 20, 20, 'new');

// 添加到现有选区
selectionManager.selectRect(30, 30, 10, 10, 'add');

// 从选区中减去
selectionManager.selectRect(15, 15, 5, 5, 'subtract');

// 与选区交叉
selectionManager.selectRect(5, 5, 20, 20, 'intersect');
```

##### `addRect(x, y, width, height)`
添加矩形到现有选区（已废弃，建议使用 `selectRect` 的 `add` 模式）。

**参数：**
- `x` (Number) - 起始X坐标
- `y` (Number) - 起始Y坐标
- `width` (Number) - 宽度
- `height` (Number) - 高度

```javascript
selectionManager.addRect(30, 30, 10, 10);
```

##### `isSelected(x, y)`
检查指定像素是否在选区内。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标

**返回值：** Boolean

```javascript
if (selectionManager.isSelected(15, 15)) {
    console.log('像素在选区内');
}
```

##### `getBounds()`
获取选区边界矩形。

**返回值：** `{x, y, width, height}` 或 null

```javascript
const bounds = selectionManager.getBounds();
if (bounds) {
    console.log(`选区范围: ${bounds.x}, ${bounds.y}, ${bounds.width}x${bounds.height}`);
}
```

##### `detectEdgeSegments()`
检测选区边缘并返回线段。

**返回值：** Object - 包含 `horizontal` 和 `vertical` 线段数组

```javascript
const segments = selectionManager.detectEdgeSegments();
console.log(`水平线段: ${segments.horizontal.length}, 垂直线段: ${segments.vertical.length}`);
```

##### `selectAll()`
选择整个画布。

```javascript
selectionManager.selectAll();
```

##### `invert()`
反转选区。

```javascript
selectionManager.invert();
```

##### `drawToCanvas(ctx, zoom)`
绘制选区到指定画布。

**参数：**
- `ctx` (CanvasRenderingContext2D) - 绘制上下文
- `zoom` (Number, 可选) - 缩放级别（默认1）

```javascript
selectionManager.drawToCanvas(displayCtx, 8);
```

##### `setSelectionColor(color)`
设置选区边框颜色。

**参数：**
- `color` (String) - CSS颜色值

```javascript
selectionManager.setSelectionColor('#ff0000'); // 红色边框
```

##### `getSelectionColor()`
获取当前选区边框颜色。

**返回值：** String - 颜色值

```javascript
const color = selectionManager.getSelectionColor();
console.log('当前选区颜色:', color);
```

##### `selectFromLayer(layer)`
从图层创建选区（基于透明度）。

**参数：**
- `layer` (Layer) - 要创建选区的图层

```javascript
const layer = layerManager.getActiveLayer();
selectionManager.selectFromLayer(layer);
```

---

### EventManager

事件和历史记录管理器，支持撤销/重做功能。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `history` | Array | 历史状态数组 |
| `historyIndex` | Number | 当前历史索引 |
| `maxHistory` | Number | 最大历史记录数（默认50） |

#### 方法

##### `saveState(state)`
保存状态到历史记录。

**参数：**
- `state` (Object) - 状态对象（包含layers、activeLayerIndex等）

```javascript
eventManager.saveState({
    layers: [...],
    activeLayerIndex: 0,
    width: 64,
    height: 64
});
```

##### `canUndo()`
检查是否可以撤销。

**返回值：** Boolean

```javascript
if (eventManager.canUndo()) {
    console.log('可以撤销');
}
```

##### `canRedo()`
检查是否可以重做。

**返回值：** Boolean

```javascript
if (eventManager.canRedo()) {
    console.log('可以重做');
}
```

##### `undo()`
撤销到上一个状态。

**返回值：** 状态对象或null

```javascript
const prevState = eventManager.undo();
```

##### `redo()`
重做到下一个状态。

**返回值：** 状态对象或null

```javascript
const nextState = eventManager.redo();
```

##### `clear()`
清空历史记录。

```javascript
eventManager.clear();
```

---

### MenuManager

菜单管理器，负责菜单交互和动态菜单管理。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `app` | PhotoShopApp | 应用实例引用 |
| `activeMenu` | HTMLElement | 当前激活的菜单元素 |
| `customActions` | Object | 自定义动作处理器存储 |

#### 方法

##### `addMenuItem(menuName, options)`
动态添加菜单项到现有菜单。

**参数：**
- `menuName` (String) - 菜单名称（以下可选： '文件', '编辑', '图层', '选择', '滤镜', '帮助'）
- `options` (Object) - 菜单项选项：
  - `label` (String) - 显示文本
  - `action` (String) - 唯一动作标识符
  - `handler` (Function) - 点击时执行的函数，接收 `app` 参数
  - `position` (String|Number, 可选) - 位置：'top', 'bottom' 或索引数字（默认：'bottom'）
  - `divider` (Boolean, 可选) - 是否在此项前添加分隔线（默认：false）

**返回值：** Boolean - 成功返回true

```javascript
// 添加自定义菜单项
app.menuManager.addMenuItem('文件', {
    label: '导出为 JSON',
    action: 'export-json',
    handler: (app) => {
        console.log('导出 JSON');
        // 自定义导出逻辑
    },
    position: 'bottom',
    divider: true
});
```

##### `removeMenuItem(action)`
移除自定义菜单项。

**参数：**
- `action` (String) - 要移除的菜单项的动作标识符

**返回值：** Boolean - 成功返回true

```javascript
app.menuManager.removeMenuItem('export-json');
```

##### `addMenu(options)`
添加新菜单到菜单栏。

**参数：**
- `options` (Object) - 菜单选项：
  - `name` (String) - 菜单显示名称
  - `items` (Array) - 菜单项数组，每项包含：
    - `label` (String) - 显示文本
    - `action` (String) - 动作标识符
    - `handler` (Function) - 点击处理函数
    - `divider` (Boolean, 可选) - 是否为分隔线
  - `position` (String|Number, 可选) - 位置：'left', 'right' 或索引（默认：'right'）

**返回值：** Boolean - 成功返回true

```javascript
// 添加新菜单
app.menuManager.addMenu({
    name: '插件',
    position: 'right',
    items: [
        {
            label: '功能1',
            action: 'plugin-feature1',
            handler: (app) => {
                alert('功能1');
            }
        },
        { divider: true },
        {
            label: '功能2',
            action: 'plugin-feature2',
            handler: (app) => {
                alert('功能2');
            }
        }
    ]
});
```

##### `closeAllMenus()`
关闭所有打开的菜单。

```javascript
app.menuManager.closeAllMenus();
```

---

### PanelManager

面板管理器，负责自定义面板的创建、删除和排序。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `app` | PhotoShopApp | 应用实例引用 |
| `panels` | Array<Panel> | 面板数组 |
| `container` | HTMLElement | 面板容器DOM元素 |

#### 方法

##### `addPanel(options)`
添加新面板。

**参数：**
- `options` (Object) - 面板选项：
  - `id` (String) - 唯一标识符
  - `title` (String) - 面板标题
  - `content` (HTMLElement|String) - 面板内容（DOM元素或HTML字符串）
  - `onClose` (Function, 可选) - 关闭回调函数

**返回值：** Panel对象或null

```javascript
const panel = app.panelManager.addPanel({
    id: 'my-panel',
    title: '我的面板',
    content: document.createElement('div'),
    onClose: () => {
        console.log('面板已关闭');
    }
});
```

##### `removePanel(id)`
移除指定面板。

**参数：**
- `id` (String) - 面板ID

**返回值：** Boolean - 成功返回true

```javascript
app.panelManager.removePanel('my-panel');
```

##### `getPanel(id)`
获取指定面板对象。

**参数：**
- `id` (String) - 面板ID

**返回值：** Panel对象或null

```javascript
const panel = app.panelManager.getPanel('my-panel');
```

##### `reorderPanel(fromIndex, toIndex)`
重新排序面板。

**参数：**
- `fromIndex` (Number) - 源索引
- `toIndex` (Number) - 目标索引

**返回值：** Boolean

```javascript
app.panelManager.reorderPanel(0, 2);
```

##### `render()`
重新渲染所有面板。

```javascript
app.panelManager.render();
```

---

### Tools

工具管理器，处理各种绘图工具的逻辑。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `currentTool` | String | 当前工具名称 |
| `color` | String | 当前颜色 |
| `brushSize` | Number | 画笔大小（1-50） |
| `isDrawing` | Boolean | 是否正在绘制 |
| `selectionMode` | String | 选区模式（new/add/subtract/intersect） |
| `autoSelect` | Boolean | 移动工具是否自动选择图层 |
| `eraserShape` | String | 橡皮擦形状（circle/square） |

#### 支持的工具

- `pencil` - 铅笔（单像素）
- `brush` - 画笔（可调大小）
- `eraser` - 橡皮擦
- `picker` - 吸管/取色器
- `bucket` - 油漆桶
- `rectSelect` - 矩形选区
- `move` - 移动工具

#### 方法

##### `setTool(toolName)`
设置当前工具。

**参数：**
- `toolName` (String) - 工具名称

```javascript
tools.setTool('brush');
```

##### `setColor(color)`
设置绘图颜色。

**参数：**
- `color` (String) - CSS颜色值

```javascript
tools.setColor('#ff0000');
```

##### `setBrushSize(size)`
设置画笔大小。

**参数：**
- `size` (Number) - 画笔大小（1-50）

```javascript
tools.setBrushSize(5);
```

##### `setSelectionMode(mode)`
设置选区模式。

**参数：**
- `mode` (String) - 选区模式：'new', 'add', 'subtract', 'intersect'

```javascript
tools.setSelectionMode('add');
```

##### `setAutoSelect(enabled)`
设置移动工具是否自动选择图层。

**参数：**
- `enabled` (Boolean) - 是否启用自动选择

```javascript
tools.setAutoSelect(true);
```

##### `setEraserShape(shape)`
设置橡皮擦形状。

**参数：**
- `shape` (String) - 形状：'circle'（圆形）或 'square'（方形）

```javascript
tools.setEraserShape('square');
```

##### `startDrawing(x, y, shiftKey)`
开始绘制操作。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标
- `shiftKey` (Boolean, 可选) - 是否按住Shift键

```javascript
tools.startDrawing(10, 10);
```

##### `continueDrawing(x, y)`
继续绘制操作。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标

```javascript
tools.continueDrawing(15, 15);
```

##### `stopDrawing()`
停止绘制操作。

```javascript
tools.stopDrawing();
```

##### `pickColor(x, y)`
从指定位置取色。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标

**返回值：** 颜色十六进制值或null

```javascript
const color = tools.pickColor(10, 10);
console.log('选中的颜色:', color);
```

##### `findLayerAtPoint(x, y)`
查找指定坐标处的图层（用于自动选择）。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标

**返回值：** Number - 图层索引，未找到返回-1

```javascript
const layerIndex = tools.findLayerAtPoint(10, 10);
if (layerIndex !== -1) {
    console.log('找到图层:', layerIndex);
}
```

##### `drawLine(x0, y0, x1, y1)`
绘制直线（Bresenham算法）。

**参数：**
- `x0` (Number) - 起点X坐标
- `y0` (Number) - 起点Y坐标
- `x1` (Number) - 终点X坐标
- `y1` (Number) - 终点Y坐标

```javascript
tools.drawLine(0, 0, 50, 50);
```

##### `draw(x, y)`
在指定位置绘制（根据当前工具）。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标

```javascript
tools.draw(10, 10);
```

##### `getSelectionPreview()`
获取选区预览信息。

**返回值：** Object - 选区预览信息或null

```javascript
const preview = tools.getSelectionPreview();
if (preview) {
    console.log(`预览选区: x=${preview.x}, y=${preview.y}, w=${preview.width}, h=${preview.height}`);
}
```

##### `startRectSelection(x, y)`
开始矩形选区操作。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标

```javascript
tools.startRectSelection(10, 10);
```

##### `finishRectSelection(x, y)`
完成矩形选区操作。

**参数：**
- `x` (Number) - X坐标
- `y` (Number) - Y坐标

```javascript
tools.finishRectSelection(30, 30);
```

---

### Toast

Toast通知系统，用于显示临时消息提示。全局静态调用，无需实例化。

#### 静态方法

##### `Toast.show(message, type, duration)`
显示Toast通知。

**参数：**
- `message` (String) - 通知消息内容
- `type` (String, 可选) - 通知类型：'info', 'success', 'warning', 'error'（默认：'info'）
- `duration` (Number, 可选) - 显示时长（毫秒），默认3000ms

```javascript
// 信息通知（蓝色边框）
Toast.show('操作完成');
Toast.show('正在处理...', 'info');

// 成功通知（绿色边框）
Toast.show('文件保存成功', 'success');

// 警告通知（橙色边框）
Toast.show('请先选择图层', 'warning');

// 错误通知（红色边框）
Toast.show('文件加载失败', 'error');

// 自定义显示时长
Toast.show('5秒后消失', 'info', 5000);
```

---

## 图层组管理

### LayerGroup

图层组类，用于组织和管理图层。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `name` | String | 组名称 |
| `visible` | Boolean | 是否可见 |
| `opacity` | Number | 不透明度（0-1） |
| `isGroup` | Boolean | 标识为组（始终为 true） |
| `expanded` | Boolean | 是否在UI中展开显示 |
| `children` | Array<Layer|LayerGroup> | 子项目数组 |
| `parent` | LayerGroup|null | 父组引用 |

#### 方法

##### `addChild(child)`
添加子项到组中。

**参数：**
- `child` (Layer|LayerGroup) - 要添加的子项

```javascript
group.addChild(layer);
```

##### `removeChild(child)`
从组中移除子项。

**参数：**
- `child` (Layer|LayerGroup) - 要移除的子项

```javascript
group.removeChild(layer);
```

##### `getAllLayers()`
获取组内所有图层（递归扁平化）。

**返回值：** Array<Layer>

```javascript
const layersInGroup = group.getAllLayers();
console.log(`组内有 ${layersInGroup.length} 个图层`);
```

##### `isEffectivelyVisible()`
检查组及其所有父组是否可见。

**返回值：** Boolean

```javascript
if (group.isEffectivelyVisible()) {
    console.log('组是可见的');
}
```

---

## 工具类

### Layer

图层类，表示单个图层。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `name` | String | 图层名称 |
| `visible` | Boolean | 是否可见 |
| `opacity` | Number | 不透明度（0-1） |
| `canvas` | HTMLCanvasElement | 图层画布 |
| `ctx` | CanvasRenderingContext2D | 图层2D上下文 |
| `isGroup` | Boolean | 标识为图层（始终为 false） |
| `parent` | LayerGroup|null | 父组引用 |

#### 示例

```javascript
const layer = new Layer(64, 64, 'My Layer');
layer.visible = true;
layer.opacity = 0.8;
layer.ctx.fillStyle = '#ff0000';
layer.ctx.fillRect(0, 0, 64, 64);
```

---

### Panel

面板类，表示单个自定义面板。

#### 属性

| 属性名 | 类型 | 描述 |
|--------|------|------|
| `id` | String | 唯一标识符 |
| `title` | String | 面板标题 |
| `content` | HTMLElement | 面板内容DOM元素 |
| `element` | HTMLElement | 面板容器DOM元素 |
| `onClose` | Function | 关闭回调函数 |

#### 方法

##### `setTitle(title)`
设置面板标题。

**参数：**
- `title` (String) - 新标题

```javascript
panel.setTitle('新标题');
```

##### `setContent(content)`
设置面板内容。

**参数：**
- `content` (HTMLElement|String) - 新内容

```javascript
panel.setContent('<div>新内容</div>');
```

---

## 工具选项栏

工具选项栏位于菜单栏下方，根据当前选择的工具动态显示不同的选项。

### 矩形选区工具选项

当选择矩形选区工具时，显示选区模式下拉菜单：

- **新选区** - 清除旧选区，创建新选区
- **添加到选区** - 在现有选区基础上添加
- **从选区减去** - 从现有选区中移除区域
- **与选区交叉** - 只保留重叠部分

```javascript
// 通过代码设置选区模式
app.tools.setSelectionMode('add');
```

### 移动工具选项

当选择移动工具时，显示自动选择图层复选框：

- **自动选择图层** - 启用后，点击画布会自动切换到点击位置的图层

```javascript
// 通过代码启用自动选择
app.tools.setAutoSelect(true);
```

### 画笔/铅笔工具选项

当选择画笔或铅笔工具时，显示大小滑块：

- **大小** - 调整工具大小（1-50px）

```javascript
// 通过代码设置画笔大小
app.tools.setBrushSize(10);
```

### 橡皮擦工具选项

当选择橡皮擦工具时，显示形状选择：

- **圆形** - 圆形橡皮擦
- **方形** - 方形橡皮擦

```javascript
// 通过代码设置橡皮擦形状
app.tools.setEraserShape('square');
```

---

## 油猴脚本集成

### 推荐的初始化方法

为确保脚本在各种情况下都能正确初始化，推荐使用以下方式：

```javascript
function init() {
    const app = window.photoShopApp;
    if (!app) {
        setTimeout(init, 100);  // 如果 app 未准备好，100ms 后重试
        return;
    }

    // 在这里添加你的功能代码
    console.log('PhotoShop应用已加载');
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();  // 页面已加载完成，直接执行
}
```

**优势：**
- 无论脚本何时执行都能正确初始化
- 避免固定延迟的不确定性
- 如果页面已加载完成，立即执行（更快）
- 如果 app 未准备好，自动重试（更可靠）

### 访问应用实例

XPhotoShop将主应用实例暴露在全局作用域，方便油猴脚本访问：

```javascript
// ==UserScript==
// @name         PhotoShop增强插件
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       风的影子
// @description  为XPhotoShop添加增强功能
// @match        file://*/PhotoShop/index.html
// @match        file://*/PhotoShop/PhotoShop.html
// @match        http://127.0.0.1:5500/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        const app = window.photoShopApp;
        if (!app) {
            setTimeout(init, 100);
            return;
        }

        console.log('PhotoShop应用已加载，版本:', app.config);
        // 在这里添加你的增强功能
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

### 导出应用实例

应用在初始化时自动暴露到全局作用域：

```javascript
// 在 main.js 中
document.addEventListener('DOMContentLoaded', () => {
    const app = new PhotoShopApp();
    app.init();

    // 暴露到全局作用域供插件使用
    window.photoShopApp = app;
});
```

---

## 使用示例

### 示例1：批量导出所有图层为PNG

```javascript
function exportAllLayers() {
    const app = window.photoShopApp;
    
    // 获取所有图层（包括组内的图层）
    const allLayers = [];
    const collectLayers = (items) => {
        for (const item of items) {
            if (item.isGroup) {
                collectLayers(item.children);
            } else {
                allLayers.push(item);
            }
        }
    };
    collectLayers(app.layerManager.layers);

    allLayers.forEach((layer, index) => {
        layer.canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${layer.name || 'layer_' + index}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
    });
}
```

### 示例2：颜色替换工具

```javascript
function replaceColor(targetColor, newColor, tolerance = 0) {
    const app = window.photoShopApp;
    const layer = app.layerManager.getActiveLayer();
    const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const data = imageData.data;

    // 将颜色转换为RGB
    const targetRgb = hexToRgb(targetColor);
    const newRgb = hexToRgb(newColor);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 检查颜色是否匹配（考虑容差）
        if (Math.abs(r - targetRgb.r) <= tolerance &&
            Math.abs(g - targetRgb.g) <= tolerance &&
            Math.abs(b - targetRgb.b) <= tolerance) {
            data[i] = newRgb.r;
            data[i + 1] = newRgb.g;
            data[i + 2] = newRgb.b;
        }
    }

    layer.ctx.putImageData(imageData, 0, 0);
    app.render();
    app.saveHistory();
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}
```

### 示例3：图层分组管理

```javascript
function organizeLayersIntoGroups() {
    const app = window.photoShopApp;
    const layerManager = app.layerManager;

    // 创建背景组
    const bgGroup = layerManager.addGroup('Backgrounds');
    
    // 创建前景组
    const fgGroup = layerManager.addGroup('Foregrounds');
    
    // 获取所有图层
    const allItems = layerManager.getAllItems();
    
    // 简单示例：将前两个图层移动到背景组，后两个到前景组
    const layers = allItems.filter(item => !item.isGroup);
    
    if (layers.length >= 1) {
        layerManager.moveToGroup(layers[0], bgGroup);
    }
    if (layers.length >= 2) {
        layerManager.moveToGroup(layers[1], bgGroup);
    }
    if (layers.length >= 3) {
        layerManager.moveToGroup(layers[2], fgGroup);
    }
    if (layers.length >= 4) {
        layerManager.moveToGroup(layers[3], fgGroup);
    }

    app.renderLayerList();
}
```

### 示例4：选区操作

```javascript
function createComplexSelection() {
    const app = window.photoShopApp;
    const sm = app.selectionManager;

    // 清除现有选区
    sm.clear();

    // 创建主选区
    sm.selectRect(10, 10, 30, 30, 'new');

    // 添加圆形选区（通过多次小矩形近似）
    for (let i = 0; i < 360; i += 10) {
        const angle = i * Math.PI / 180;
        const x = 50 + Math.cos(angle) * 15;
        const y = 50 + Math.sin(angle) * 15;
        sm.selectRect(Math.floor(x), Math.floor(y), 1, 1, 'add');
    }

    // 减去中心区域
    sm.selectRect(45, 45, 10, 10, 'subtract');

    app.render();
}
```

### 示例5：自定义菜单项

```javascript
function addCustomMenuItems() {
    const app = window.photoShopApp;

    // 在文件菜单中添加自定义项
    app.menuManager.addMenuItem('文件', {
        label: '批量导出图层',
        action: 'batch-export',
        handler: (app) => {
            exportAllLayers();
        },
        position: 'bottom',
        divider: true
    });

    // 添加新菜单
    app.menuManager.addMenu({
        name: '工具',
        position: 'right',
        items: [
            {
                label: '颜色替换',
                action: 'color-replace',
                handler: (app) => {
                    const oldColor = prompt('输入要替换的颜色（如：#ff0000）:');
                    const newColor = prompt('输入新颜色（如：#00ff00）:');
                    if (oldColor && newColor) {
                        replaceColor(oldColor, newColor, 10);
                    }
                }
            },
            { divider: true },
            {
                label: '图层分组整理',
                action: 'organize-layers',
                handler: (app) => {
                    organizeLayersIntoGroups();
                }
            }
        ]
    });
}
```

### 示例6：批量操作多选图层

```javascript
function batchOperateSelectedLayers() {
    const app = window.photoShopApp;
    const selectedItems = app.layerManager.selectedItems;

    if (selectedItems.length === 0) {
        alert('请先选择图层（按住Ctrl点击多个图层）');
        return;
    }

    console.log(`已选中 ${selectedItems.length} 个项目`);

    // 批量设置不透明度
    selectedItems.forEach(item => {
        if (!item.isGroup) {
            item.opacity = 0.5;
        }
    });

    // 批量隐藏
    selectedItems.forEach(item => {
        item.visible = false;
    });

    app.renderLayerList();
    app.render();
    app.saveHistory();
}

// 选择多个图层
function selectMultipleLayers() {
    const app = window.photoShopApp;
    const layerManager = app.layerManager;

    // 清除当前选择
    layerManager.selectedItems = [];

    // 选择前3个图层
    const allItems = layerManager.getAllItems();
    for (let i = 0; i < Math.min(3, allItems.length); i++) {
        layerManager.setActiveItem(allItems[i], true);
    }

    app.renderLayerList();
}
```

### 示例7：使用选区分离图层

```javascript
function splitActiveLayerBySelection() {
    const app = window.photoShopApp;
    
    // 检查是否有选区和激活图层
    if (!app.selectionManager.hasSelection) {
        alert('请先创建选区');
        return;
    }
    
    const activeItem = app.layerManager.activeItem;
    if (!activeItem || activeItem.isGroup) {
        alert('请选择一个图层');
        return;
    }

    // 复制当前图层
    const newLayer = app.layerManager.addLayer(
        activeItem.canvas.width,
        activeItem.canvas.height,
        activeItem.name + ' (选区)'
    );

    // 复制属性
    newLayer.visible = activeItem.visible;
    newLayer.opacity = activeItem.opacity;

    // 只复制选区部分
    const bounds = app.selectionManager.getBounds();
    if (bounds) {
        for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
            for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
                if (app.selectionManager.isSelected(x, y)) {
                    const pixel = activeItem.ctx.getImageData(x, y, 1, 1).data;
                    if (pixel[3] > 0) {
                        newLayer.ctx.fillStyle = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3]/255})`;
                        newLayer.ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
    }

    // 从原图层清除选区部分
    activeItem.ctx.save();
    activeItem.ctx.beginPath();
    // 这里可以绘制选区形状来清除，简化示例只清除矩形区域
    if (bounds) {
        activeItem.ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    activeItem.ctx.restore();

    app.render();
    app.saveHistory();
}
```

### 示例8：添加自定义面板

```javascript
function addCustomPanel() {
    const app = window.photoShopApp;

    // 创建面板内容
    const content = document.createElement('div');
    content.style.padding = '10px';
    content.innerHTML = `
        <h3>图层信息</h3>
        <div id="layerInfo"></div>
        <button id="refreshBtn">刷新</button>
    `;

    // 添加面板
    const panel = app.panelManager.addPanel({
        id: 'layer-info',
        title: '图层信息',
        content: content,
        onClose: () => {
            console.log('图层信息面板已关闭');
        }
    });

    // 绑定事件
    const refreshBtn = content.querySelector('#refreshBtn');
    refreshBtn.addEventListener('click', () => {
        const activeLayer = app.layerManager.getActiveLayer();
        const info = content.querySelector('#layerInfo');
        info.innerHTML = `
            <p>名称: ${activeLayer.name}</p>
            <p>可见: ${activeLayer.visible}</p>
            <p>不透明度: ${activeLayer.opacity}</p>
        `;
    });
}
```

### 示例9：油猴脚本添加面板

```javascript
// ==UserScript==
// @name         PhotoShop颜色统计面板
// @match        file://*/PhotoShop/index.html
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            const app = window.photoShopApp;
            if (!app) return;

            // 创建面板内容
            const content = document.createElement('div');
            content.style.padding = '10px';
            content.innerHTML = `
                <h3>颜色统计</h3>
                <button id="analyzeBtn">分析当前图层</button>
                <div id="colorStats" style="margin-top: 10px;"></div>
            `;

            // 添加面板
            app.panelManager.addPanel({
                id: 'color-stats',
                title: '颜色统计',
                content: content
            });

            // 绑定分析按钮
            content.querySelector('#analyzeBtn').addEventListener('click', () => {
                const layer = app.layerManager.getActiveLayer();
                const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
                const colors = new Map();

                for (let i = 0; i < imageData.data.length; i += 4) {
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    const a = imageData.data[i + 3];
                    if (a > 0) {
                        const color = `rgb(${r},${g},${b})`;
                        colors.set(color, (colors.get(color) || 0) + 1);
                    }
                }

                const statsDiv = content.querySelector('#colorStats');
                statsDiv.innerHTML = `<p>总颜色数: ${colors.size}</p>`;
            });

        }, 1000);
    });
})();
```

---

## 注意事项

1. **性能优化**：频繁调用 `saveHistory()` 会消耗大量内存，建议在用户完成操作后（如mouseup事件）再保存历史记录。

2. **图层操作**：直接操作图层的 `ctx` 后需要调用 `app.render()` 来更新显示。

3. **选区蒙版**：SelectionManager使用灰度蒙版，白色（>128）表示选中区域，可以通过直接绘制到 `selectionManager.ctx` 来创建任意形状选区。

4. **选区模式**：使用 `selectRect` 的不同模式可以创建复杂选区，支持添加、减去和交叉操作。

5. **边缘检测**：`detectEdgeSegments()` 方法可以检测选区的实际边缘，用于精确绘制选区边框。

6. **油猴脚本**：确保脚本在应用初始化后执行，可以监听 `DOMContentLoaded` 并添加延迟。

7. **ImageData**：处理大量像素数据时注意性能，可以使用Web Worker进行异步处理。

8. **工具选项栏**：切换工具时会自动更新工具选项栏，也可以通过 `app.updateToolOptionsBar()` 手动更新。

9. **图层组**：图层组支持嵌套，但要注意避免循环引用。

10. **键盘快捷键**：应用支持多种键盘快捷键（Ctrl+Z撤销、Ctrl+Y重做、Delete删除等）。

11. **图层多选**：按住Ctrl（Windows/Linux）或Cmd（Mac）点击图层可以多选，所有选中的图层存储在 `layerManager.selectedItems` 数组中。

---

## 版本历史

- **v1.0.1** - 添加图层多选功能（Ctrl+点击），支持批量操作
- **v1.0.0** - 添加图层组（文件夹）支持，新增油漆桶工具，橡皮擦形状选项，增强移动工具
- **v0.4.0** - 添加工具选项栏，支持选区模式（新建/添加/减去/交叉），移动工具自动选择，改进选区边框绘制
- **v0.3.0** - 添加历史记录功能（撤销/重做），完善API文档
- **v0.2.0** - 添加矩形选区和移动工具
- **v0.1.0** - 基础框架，图层管理，基本绘图工具

---

## 联系方式

项目作者：风的影子
文档更新日期：2026-01-12

---
