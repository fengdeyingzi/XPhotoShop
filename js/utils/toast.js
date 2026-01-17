// Toast notification system
class Toast {
    static isMobile() {
        return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    }

    static init() {
        if (!Toast._container) {
            Toast._container = document.createElement('div');
            Toast._container.className = 'toast-container' + (Toast.isMobile() ? ' toast-mobile' : '');
            document.body.appendChild(Toast._container);
        }
    }

    static show(message, type = 'info', duration = 3000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        Toast._container.appendChild(toast);

        setTimeout(() => toast.classList.add('toast-show'), 10);

        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

Toast._container = null;

// 暴露到全局作用域
window.Toast = Toast;
