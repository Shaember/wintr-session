import * as basic from './basic.js';
import * as modal from './modal.js';
import state from './state.js';

export async function updateTable() {
  const table = document.getElementById('table');
  const thead = document.getElementById('table-header');
  const searchInput = document.getElementById('search-input');
  const addClientButton = document.getElementById('add-client-button');
  const tableLoadScreen = document.getElementById('table-load-screen');

  thead.classList.add('loading');
  removeExistingTbody();

  toggleLoading(true);

  const search = searchInput.value.trim();
  try {
    const clients = await fetchClients(search);
    state().clients = clients;
  } catch (error) {
    basic.showError();
    console.error(error);
    return;
  }

  state().sortClients();
  const newTbody = createTableBody(state().clients);

  tableLoadScreen.hidden = true;
  table.append(newTbody);
  addClientButton.hidden = false;
  thead.classList.remove('loading');
}

function removeExistingTbody() {
  const tbody = document.getElementById('table-body');
  if (tbody) {
    tbody.remove();
  }
}

function toggleLoading(isLoading) {
  const tableLoadScreen = document.getElementById('table-load-screen');
  const addClientButton = document.getElementById('add-client-button');
  tableLoadScreen.hidden = !isLoading;
  addClientButton.hidden = isLoading;
}

async function fetchClients(search) {
  const response = await fetch(`http://localhost:3000/api/clients${search.length > 0 ? `?search=${encodeURIComponent(search)}` : '' }`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Ошибка ${response.status}: ${response.statusText}.`);
  }

  return response.json();
}

function createTableBody(data = []) {
  const tbody = document.createElement('tbody');
  tbody.id = 'table-body';
  tbody.classList.add('table__body');

  data.forEach(clientData => {
    const tr = createTableRow(clientData);
    tbody.append(tr);
  });

  return tbody;
}

function createTableRow(clientData) {
  const tr = document.createElement('tr');
  tr.classList.add('table__row', 'table__row_body');

  tr.append(
    createTableCell('table__cell_body_id', clientData.id),
    createTableCell('table__cell_body_name', `${clientData.surname} ${clientData.name} ${clientData.lastName}`),
    createDateCell('table__cell_body_created-at', clientData.createdAt),
    createDateCell('table__cell_body_updated-at', clientData.updatedAt),
    createContactsCell(clientData.contacts, clientData.id),
    createActionsCell(clientData.id)
  );

  return tr;
}

function createTableCell(className, textContent) {
  const td = document.createElement('td');
  td.classList.add('table__cell', 'table__cell_body', className);
  td.textContent = textContent;
  return td;
}

function createDateCell(className, date) {
  const td = createTableCell(className, basic.formatDate(date).split(' ')[0] + ' ');
  const span = document.createElement('span');
  span.classList.add('text-grey-color');
  span.textContent = basic.formatDate(date).split(' ')[1];
  td.append(span);
  return td;
}

function createContactsCell(contacts, clientId) {
  const tdContacts = createTableCell('table__cell_body_contacts', '');
  const divContacts = document.createElement('div');
  divContacts.classList.add('table__contacts');
  divContacts.setAttribute('data-element-tableContacts', '');
  divContacts.setAttribute('data-clientId', clientId);
  tdContacts.append(divContacts);

  renderContacts(divContacts, contacts);

  return tdContacts;
}

function renderContacts(container, contacts) {
  const contactsToDraw = contacts.length > 5 ? contacts.slice(0, 4) : contacts;

  contactsToDraw.forEach(({ type, value }) => {
    const contact = document.createElement('div');
    contact.classList.add('table__contact');
    contact.setAttribute('data-element-contact', '');
    contact.setAttribute('data-contactType', type);
    contact.setAttribute('data-contactValue', value);
    contact.addEventListener('mouseover', showContactTooltip);
    contact.addEventListener('mouseout', hideContactTooltip);
    container.append(contact);
  });

  if (contacts.length > 5) {
    const contactsButton = document.createElement('button');
    contactsButton.classList.add('table__contacts__button');
    contactsButton.setAttribute('data-element-contactsButton', '');
    contactsButton.textContent = `+${contacts.length - 4}`;
    contactsButton.addEventListener('click', showAllContacts);
    container.append(contactsButton);
  }
}

function createActionsCell(clientId) {
  const tdActions = createTableCell('table__cell_body_actions', '');
  const divActions = document.createElement('div');
  divActions.classList.add('table__actions');
  tdActions.append(divActions);

  divActions.append(
    createActionButton('Изменить', 'table__action-button_edit', modal.handleOpenEditClientModal, clientId),
    createActionButton('Удалить', 'table__action-button_delete', modal.handleOpenDeleteClientModalFromTable, clientId)
  );

  return tdActions;
}

function createActionButton(text, className, eventHandler, clientId) {
  const button = document.createElement('button');
  button.classList.add('table__action-button', className, 'button_with-icon');
  button.setAttribute('data-element-clientAction', '');
  button.setAttribute('data-clientId', clientId);
  button.textContent = text;
  button.addEventListener('click', eventHandler);
  return button;
}

function showAllContacts(event) {
  const button = event.target.closest('[data-element-contactsButton]');
  button.hidden = true;
  const contactsContainer = button.closest('[data-element-tableContacts]');
  const contacts = state().clients.find(({ id }) => id === contactsContainer.dataset.clientId).contacts.slice(4);

  contacts.forEach(({ type, value }) => {
    const contact = document.createElement('div');
    contact.classList.add('table__contact');
    contact.setAttribute('data-element-contact', '');
    contact.setAttribute('data-contactType', type);
    contact.setAttribute('data-contactValue', value);
    contact.addEventListener('mouseover', showContactTooltip);
    contact.addEventListener('mouseout', hideContactTooltip);
    contactsContainer.append(contact);
  });

  setTimeout(() => button.remove(), 0);
}

function showContactTooltip(event) {
  const contact = event.target.closest('[data-element-contact]');
  const contactType = state().contactTypes[contact.dataset.contactType];
  const contactValue = contact.dataset.contactValue;

  const tooltip = document.createElement('div');
  tooltip.classList.add('contact-tooltip');
  tooltip.setAttribute('data-element-contactTooltip', '');

  const tooltipText = document.createElement('div');
  tooltipText.classList.add('contact-tooltip__text');
  tooltipText.textContent = `${contactType}: ${contactValue}`;

  const triangle = document.createElement('div');
  triangle.classList.add('contact-tooltip__triangle');

  tooltip.append(tooltipText, triangle);
  contact.append(tooltip);
}

function hideContactTooltip(event) {
  const contact = event.target.closest('[data-element-contact]');
  const tooltip = contact.querySelector('[data-element-contactTooltip]');
  tooltip.remove();
}

export function handleSortButton(event) {
  const button = event.target.closest('[data-element-sortButton]');
  const sortField = button.dataset.sortField;

  if (sortField === state().sortState.active) {
    state().sortState.directions[sortField] = state().sortState.directions[sortField] === '0' ? '1' : '0';
  } else {
    state().sortState.active = sortField;
  }

  updateSortButtons(state().sortState);
  state().sortClients();

  const tbody = document.getElementById('table-body');
  if (tbody) {
    const newTbody = createTableBody(state().clients);
    tbody.parentNode.replaceChild(newTbody, tbody);
  }
}

function updateSortButtons(sortState) {
  const { active, directions } = sortState;
  const header = document.getElementById('table-header');
  const buttons = header.querySelectorAll('[data-element-sortButton]');

  buttons.forEach(button => {
    button.classList.toggle('active', button.dataset.sortField === active);
    button.dataset.sortDirection = directions[button.dataset.sortField];
  });
}
