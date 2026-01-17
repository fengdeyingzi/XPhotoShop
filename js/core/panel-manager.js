// 面板类
export class Panel {
    constructor(id, title, content, onClose) {
        this.id = id;
        this.title = title;
        this.content = typeof content === 'string' ? this.createContentElement(content) : content;
        this.onClose = onClose;
        this.element = null;
    }

    createContentElement(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div;
    }

    setTitle(title) {
        this.title = title;
        if (this.element) {
            const titleEl = this.element.querySelector('.custom-panel-title');
            if (titleEl) titleEl.textContent = title;
        }
    }

    setContent(content) {
        this.content = typeof content === 'string' ? this.createContentElement(content) : content;
        if (this.element) {
            const contentEl = this.element.querySelector('.custom-panel-content');
            if (contentEl) {
                contentEl.innerHTML = '';
                contentEl.appendChild(this.content);
            }
        }
    }
}

// 面板管理器
export class PanelManager {
    constructor(app) {
        this.app = app;
        this.panels = [];
        this.container = null;
        this.draggedPanel = null;
    }

    init() {
        this.container = document.getElementById('customPanelsContainer');
        if (!this.container) {
            console.error('面板容器未找到');
            return;
        }
        this.updateContainerVisibility();
        this.setupDragAndDrop();
    }

    updateContainerVisibility() {
        if (!this.container) return;
        this.container.style.display = this.panels.length > 0 ? 'flex' : 'none';
    }

    addPanel(options) {
        const { id, title, content, onClose } = options;

        // 检查ID是否已存在
        if (this.getPanel(id)) {
            console.warn(`面板 ${id} 已存在`);
            return null;
        }

        const panel = new Panel(id, title, content, onClose);
        this.panels.push(panel);
        this.renderPanel(panel);
        this.updateContainerVisibility();
        return panel;
    }

    removePanel(id) {
        const index = this.panels.findIndex(p => p.id === id);
        if (index === -1) return false;

        const panel = this.panels[index];
        if (panel.element && panel.element.parentNode) {
            panel.element.parentNode.removeChild(panel.element);
        }
        this.panels.splice(index, 1);
        this.updateContainerVisibility();
        return true;
    }

    getPanel(id) {
        return this.panels.find(p => p.id === id) || null;
    }

    reorderPanel(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.panels.length ||
            toIndex < 0 || toIndex >= this.panels.length) {
            return false;
        }

        const [panel] = this.panels.splice(fromIndex, 1);
        this.panels.splice(toIndex, 0, panel);
        this.render();
        return true;
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.panels.forEach(panel => this.renderPanel(panel));
    }

    renderPanel(panel) {
        if (!this.container) return;

        const panelEl = document.createElement('div');
        panelEl.className = 'custom-panel';
        panelEl.setAttribute('data-panel-id', panel.id);

        const header = document.createElement('div');
        header.className = 'custom-panel-header';
        header.draggable = true;

        const titleEl = document.createElement('span');
        titleEl.className = 'custom-panel-title';
        titleEl.textContent = panel.title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'custom-panel-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => {
            if (panel.onClose) panel.onClose();
            this.removePanel(panel.id);
        });

        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        const contentEl = document.createElement('div');
        contentEl.className = 'custom-panel-content';
        contentEl.appendChild(panel.content);

        panelEl.appendChild(header);
        panelEl.appendChild(contentEl);

        panel.element = panelEl;
        this.container.appendChild(panelEl);
    }

    setupDragAndDrop() {
        if (!this.container) return;

        this.container.addEventListener('dragstart', (e) => {
            // 只允许从标题开始拖拽
            const header = e.target.closest('.custom-panel-header');
            if (!header) return;

            const panelEl = header.closest('.custom-panel');
            if (!panelEl) return;

            this.draggedPanel = panelEl;
            panelEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        this.container.addEventListener('dragend', (e) => {
            // 从标题结束拖拽
            const header = e.target.closest('.custom-panel-header');
            if (header) {
                const panelEl = header.closest('.custom-panel');
                if (panelEl) {
                    panelEl.classList.remove('dragging');
                }
            }
            this.draggedPanel = null;
        });

        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const afterElement = this.getDragAfterElement(e.clientY);
            if (afterElement == null) {
                this.container.appendChild(this.draggedPanel);
            } else {
                this.container.insertBefore(this.draggedPanel, afterElement);
            }
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.updatePanelsOrder();
        });
    }

    getDragAfterElement(y) {
        const draggableElements = [...this.container.querySelectorAll('.custom-panel:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updatePanelsOrder() {
        const panelElements = this.container.querySelectorAll('.custom-panel');
        const newOrder = [];

        panelElements.forEach(el => {
            const id = el.getAttribute('data-panel-id');
            const panel = this.getPanel(id);
            if (panel) newOrder.push(panel);
        });

        this.panels = newOrder;
    }
}
