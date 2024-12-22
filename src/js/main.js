import * as basic from './basic.js';
import * as modal from './modal.js';
import state from './state.js';
import * as table from './table.js';

const SEARCH_DEBOUNCE_DELAY = 300;

const initSortButtons = () => {
  document.getElementById('table-header')
    .querySelectorAll('[data-element-sortButton]')
    .forEach(button => button.addEventListener('click', table.handleSortButton));
};

const initSearchField = () => {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('keypress', basic.keypressNoDubbleSpaces);
  searchInput.addEventListener('input', debounceSearch);
};

const debounceSearch = () => {
  state().lastInput = Date.now();
  setTimeout(() => {
    if (Date.now() - state().lastInput >= SEARCH_DEBOUNCE_DELAY) {
      table.updateTable();
    }
  }, SEARCH_DEBOUNCE_DELAY);
};

const initAddClientButton = () => {
  document.getElementById('add-client-button')
    .addEventListener('click', modal.handleOpenAddClientModal);
};

const init = () => {
  table.updateTable();
  initSortButtons();
  initSearchField();
  initAddClientButton();
};

document.addEventListener('DOMContentLoaded', init);
