const { existsSync, readFileSync, writeFileSync } = require('fs');
const { createServer } = require('http');

const DB_FILE = process.env.DB_FILE || './db.json';
const PORT = process.env.PORT || 3000;
const URI_PREFIX = '/api/clients';

class ApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}

const parseRequestBody = (req) => {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(JSON.parse(data)));
  });
};

const validateClient = (data) => {
  const errors = [];
  const client = {
    name: String(data.name || '').trim(),
    surname: String(data.surname || '').trim(),
    lastName: String(data.lastName || '').trim(),
    contacts: Array.isArray(data.contacts) ? data.contacts.map(contact => ({
      type: String(contact.type || '').trim(),
      value: String(contact.value || '').trim(),
    })) : [],
  };

  if (!client.name) errors.push({ field: 'name', message: 'Name is required' });
  if (!client.surname) errors.push({ field: 'surname', message: 'Surname is required' });
  if (client.contacts.some(contact => !contact.type || !contact.value)) {
    errors.push({ field: 'contacts', message: 'All contact fields must be filled' });
  }

  if (errors.length) throw new ApiError(422, { errors });
  return client;
};

const readDatabase = () => {
  return JSON.parse(readFileSync(DB_FILE) || '[]');
};

const writeDatabase = (data) => {
  writeFileSync(DB_FILE, JSON.stringify(data), { encoding: 'utf8' });
};

const searchClients = (clients, searchTerm) => {
  if (!searchTerm) return clients;
  
  const search = searchTerm.trim().toLowerCase();
  return clients.filter(client => {
    const searchableFields = [
      client.name,
      client.surname,
      client.lastName,
      ...client.contacts.map(contact => contact.value)
    ];
    return searchableFields.some(field => field.toLowerCase().includes(search));
  });
};

const clientOperations = {
  getList: (params = {}) => {
    const clients = readDatabase();
    return searchClients(clients, params.search);
  },

  create: async (req) => {
    const data = await parseRequestBody(req);
    const client = validateClient(data);
    
    const newClient = {
      ...client,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    writeDatabase([...readDatabase(), newClient]);
    return newClient;
  },

  get: (id) => {
    const client = readDatabase().find(client => client.id === id);
    if (!client) throw new ApiError(404, { message: 'Client Not Found' });
    return client;
  },

  update: async (id, req) => {
    const data = await parseRequestBody(req);
    const clients = readDatabase();
    const index = clients.findIndex(client => client.id === id);
    
    if (index === -1) throw new ApiError(404, { message: 'Client Not Found' });
    
    const updatedClient = validateClient({ ...clients[index], ...data });
    clients[index] = {
      ...clients[index],
      ...updatedClient,
      updatedAt: new Date().toISOString()
    };
    
    writeDatabase(clients);
    return clients[index];
  },

  delete: (id) => {
    const clients = readDatabase();
    const index = clients.findIndex(client => client.id === id);
    if (index === -1) throw new ApiError(404, { message: 'Client Not Found' });
    
    clients.splice(index, 1);
    writeDatabase(clients);
    return {};
  }
};

if (!existsSync(DB_FILE)) {
  writeDatabase([]);
}

const setCorsHeaders = (res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const handleRequest = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }

  if (!req.url?.startsWith(URI_PREFIX)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not Found' }));
    return;
  }

  const [uri, query] = req.url.slice(URI_PREFIX.length).split('?');
  const queryParams = Object.fromEntries(
    query?.split('&')
      .map(param => param.split('='))
      .map(([key, value]) => [key, value ? decodeURIComponent(value) : '']) ?? []
  );

  try {
    const response = await (async () => {
      if (!uri || uri === '/') {
        if (req.method === 'GET') return clientOperations.getList(queryParams);
        if (req.method === 'POST') {
          const client = await clientOperations.create(req);
          res.statusCode = 201;
          res.setHeader('Access-Control-Expose-Headers', 'Location');
          res.setHeader('Location', `${URI_PREFIX}/${client.id}`);
          return client;
        }
      } else {
        const id = uri.slice(1);
        if (req.method === 'GET') return clientOperations.get(id);
        if (req.method === 'PATCH') return clientOperations.update(id, req);
        if (req.method === 'DELETE') return clientOperations.delete(id);
      }
      return null;
    })();

    res.end(JSON.stringify(response));
  } catch (err) {
    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: 'Server Error' }));
      console.error(err);
    }
  }
};

module.exports = createServer(handleRequest)
  .listen(PORT, () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`CRM Server running at http://localhost:${PORT}`);
    }
  });