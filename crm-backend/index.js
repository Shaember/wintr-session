/* eslint-disable no-console */
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { createServer } = require('http');

// файл для базы данных
const DB_FILE = process.env.DB_FILE || './db.json';
// номер порта
const PORT = process.env.PORT || 3000;
// префикс URI
const URI_PREFIX = '/api/clients';

/**
 * Класс ошибки
 */
class ApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * считывание тела запроса
 * @param {Object} req - Объект HTTP запроса
 * @throws {ApiError} Некорректные данные в аргументе
 * @returns {Object} Объект, созданный из тела запроса
 */
function drainJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(JSON.parse(data));
    });
  });
}

/**
 * проверка вводных
 * @param {Object} data - Объект с входными данными
 * @throws {ApiError} Некорректные данные в аргументе (statusCode 422)
 * @returns {{ name: string, surname: string, lastName: string, contacts: object[] }} Объект клиента
 */
function makeClientFromData(data) {
  const errors = [];

  function asString(v) {
    return v && String(v).trim() || '';
  }

  // составление обьекта
  const client = {
    name: asString(data.name),
    surname: asString(data.surname),
    lastName: asString(data.lastName),
    contacts: Array.isArray(data.contacts) ? data.contacts.map(contact => ({
      type: asString(contact.type),
      value: asString(contact.value),
    })) : [],
  };

  // проверка данных
  if (!client.name) errors.push({ field: 'name', message: 'Не указано имя' });
  if (!client.surname) errors.push({ field: 'surname', message: 'Не указана фамилия' });
  if (client.contacts.some(contact => !contact.type || !contact.value))
    errors.push({ field: 'contacts', message: 'Не все добавленные контакты полностью заполнены' });

  // ошибка 422
  if (errors.length) throw new ApiError(422, { errors });

  return client;
}

/**
 * Возвращает список клиентов из базы данных
 * @param {{ search: string }} [params] - Поисковая строка
 * @returns {{ id: string, name: string, surname: string, lastName: string, contacts: object[] }[]} Массив клиентов
 */
function getClientList(params = {}) {
  const clients = JSON.parse(readFileSync(DB_FILE) || '[]');
  if (params.search) {
    const search = params.search.trim().toLowerCase();
    return clients.filter(client => [
        client.name,
        client.surname,
        client.lastName,
        ...client.contacts.map(({ value }) => value)
      ]
        .some(str => str.toLowerCase().includes(search))
    );
  }
  return clients;
}

/**
 * Создаёт и сохраняет клиента в базу данных
 * @throws {ApiError} Некорректные данные в аргументе, клиент не создан (statusCode 422)
 * @param {Object} data - Данные из тела запроса
 * @returns {{ id: string, name: string, surname: string, lastName: string, contacts: object[], createdAt: string, updatedAt: string }} Объект клиента
 */
function createClient(data) {
  const newItem = makeClientFromData(data);
  newItem.id = Date.now().toString();
  newItem.createdAt = newItem.updatedAt = new Date().toISOString();
  writeFileSync(DB_FILE, JSON.stringify([...getClientList(), newItem]), { encoding: 'utf8' });
  return newItem;
}

/**
 * Возвращает объект клиента по его ID
 * @param {string} itemId - ID клиента
 * @throws {ApiError} Клиент с таким ID не найден (statusCode 404)
 * @returns {{ id: string, name: string, surname: string, lastName: string, contacts: object[], createdAt: string, updatedAt: string }} Объект клиента
 */
function getClient(itemId) {
  const client = getClientList().find(({ id }) => id === itemId);
  if (!client) throw new ApiError(404, { message: 'Client Not Found' });
  return client;
}

/**
 * Изменяет клиента с указанным ID и сохраняет изменения в базу данных
 * @param {string} itemId - ID изменяемого клиента
 * @param {{ name?: string, surname?: string, lastName?: string, contacts?: object[] }} data - Объект с изменяемыми данными
 * @throws {ApiError} Клиент с таким ID не найден (statusCode 404)
 * @throws {ApiError} Некорректные данные в аргументе (statusCode 422)
 * @returns {{ id: string, name: string, surname: string, lastName: string, contacts: object[], createdAt: string, updatedAt: string }} Объект клиента
 */
function updateClient(itemId, data) {
  const clients = getClientList();
  const itemIndex = clients.findIndex(({ id }) => id === itemId);
  if (itemIndex === -1) throw new ApiError(404, { message: 'Client Not Found' });
  Object.assign(clients[itemIndex], makeClientFromData({ ...clients[itemIndex], ...data }));
  clients[itemIndex].updatedAt = new Date().toISOString();
  writeFileSync(DB_FILE, JSON.stringify(clients), { encoding: 'utf8' });
  return clients[itemIndex];
}

/**
 * Удаляет клиента из базы данных
 * @param {string} itemId - ID клиента
 * @returns {{}}
 */
function deleteClient(itemId) {
  const clients = getClientList();
  const itemIndex = clients.findIndex(({ id }) => id === itemId);
  if (itemIndex === -1) throw new ApiError(404, { message: 'Client Not Found' });
  clients.splice(itemIndex, 1);
  writeFileSync(DB_FILE, JSON.stringify(clients), { encoding: 'utf8' });
  return {};
}

// файл с базой данных
if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, '[]', { encoding: 'utf8' });

// HTTP сервер
module.exports = createServer(async (req, res) => {
  // req

  res.setHeader('Content-Type', 'application/json');

  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // запрос с методом OPTIONS
  if (req.method === 'OPTIONS') {
    // end = закончить формировать ответ и отправить его клиенту
    res.end();
    return;
  }

  // ошибка 404
  if (!req.url || !req.url.startsWith(URI_PREFIX)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not Found' }));
    return;
  }

  // убираем из запроса префикс URI
  const [uri, query] = req.url.substr(URI_PREFIX.length).split('?');
  const queryParams = {};

  // параметры могут отсутствовать вообще или иметь вид
  if (query) {
    for (const piece of query.split('&')) {
      const [key, value] = piece.split('=');
      queryParams[key] = value ? decodeURIComponent(value) : '';
    }
  }

  try {
    // обрабатываем запрос и формируем тело ответа
    const body = await (async () => {
      if (uri === '' || uri === '/') {
        // /api/clients
        if (req.method === 'GET') return getClientList(queryParams);
        if (req.method === 'POST') {
          const createdItem = createClient(await drainJson(req));
          res.statusCode = 201;
          res.setHeader('Access-Control-Expose-Headers', 'Location');
          res.setHeader('Location', `${URI_PREFIX}/${createdItem.id}`);
          return createdItem;
        }
      } else {
        // /api/clients/{id}
        // параметр {id} из URI запроса
        const itemId = uri.substr(1);
        if (req.method === 'GET') return getClient(itemId);
        if (req.method === 'PATCH') return updateClient(itemId, await drainJson(req));
        if (req.method === 'DELETE') return deleteClient(itemId);
      }
      return null;
    })();
    res.end(JSON.stringify(body));
  } catch (err) {
    // обрабатываем сгенерированную ошибку
    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      // ошибка 500
      res.statusCode = 500;
      res.end(JSON.stringify({ message: 'Server Error' }));
      console.error(err);
    }
  }
})
  // выводим инструкцию, как только сервер запустился...
  .on('listening', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Сервер CRM запущен. Вы можете использовать его по адресу http://localhost:${PORT}`);
      console.log('Нажмите CTRL+C, чтобы остановить сервер');
      console.log('Доступные методы:');
      console.log(`GET ${URI_PREFIX} - получить список клиентов, в query параметр search можно передать поисковый запрос`);
      console.log(`POST ${URI_PREFIX} - создать клиента, в теле запроса нужно передать объект { name: string, surname: string, lastName?: string, contacts?: object[] }`);
      console.log(`\tcontacts - массив объектов контактов вида { type: string, value: string }`);
      console.log(`GET ${URI_PREFIX}/{id} - получить клиента по его ID`);
      console.log(`PATCH ${URI_PREFIX}/{id} - изменить клиента с ID, в теле запроса нужно передать объект { name?: string, surname?: string, lastName?: string, contacts?: object[] }`);
      console.log(`\tcontacts - массив объектов контактов вида { type: string, value: string }`);
      console.log(`DELETE ${URI_PREFIX}/{id} - удалить клиента по ID`);
    }
  })
  // вызываем запуск сервера на указанном порту
  .listen(PORT);
