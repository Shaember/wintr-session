/*Input field event handlers*/

export const handleSpaceKey = (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
  }
};

export const handleConsecutiveSpaces = (event) => {
  if (event.code !== 'Space') return;
  
  const input = event.target;
  const isEmptyOrEndsWithSpace = !input.value || input.value.endsWith(' ');
  
  if (isEmptyOrEndsWithSpace) {
    event.preventDefault();
  }
};

/*Error handling*/

const DEFAULT_ERROR_MESSAGE = 'Произошла ошибка. Пожалуйста, перезагрузите страницу.';

export const showError = (message = DEFAULT_ERROR_MESSAGE) => {
  let errorElement = document.getElementById('error-message');
  
  if (!errorElement) {
    errorElement = document.createElement('aside');
    errorElement.id = 'error-message';
    errorElement.className = 'error';
    document.body.appendChild(errorElement);
  }
  
  errorElement.textContent = message;
};

/*Date formatting*/

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  
  const formatNumber = (number) => number.toString().padStart(2, '0');
  
  const day = formatNumber(date.getDate());
  const month = formatNumber(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = formatNumber(date.getHours());
  const minutes = formatNumber(date.getMinutes());
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

/*UI overlay management*/

const OVERLAY_STYLES = {
  zIndex: '2000',
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%'
};

export const toggleClickOverlay = (show) => {
  const existingOverlay = document.getElementById('click-overlay');
  
  if (show && !existingOverlay) {
    const overlay = document.createElement('div');
    overlay.id = 'click-overlay';
    Object.assign(overlay.style, OVERLAY_STYLES);
    document.body.appendChild(overlay);
  } else if (!show && existingOverlay) {
    existingOverlay.remove();
  }
};

// Export convenience methods for backward compatibility

export const disableClicks = () => toggleClickOverlay(true);
export const enableClicks = () => toggleClickOverlay(false);
