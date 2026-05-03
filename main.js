const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { program } = require('commander');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');

program
    .requiredOption('-h, --host <type>')
    .requiredOption('-p, --port <number>')
    .requiredOption('-c, --cache <path>')
    .parse(process.argv);

const options = program.opts();
const app = express();
const upload = multer({ dest: options.cache });

if (!fs.existsSync(options.cache))
{
    fs.mkdirSync(options.cache, { recursive: true });
}

let inventoryStorage = {};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Inventory',
        version: '1.0.0',
        description: 'documentation'
    },
    servers: [{ url: `http://${options.host}:${options.port}` }],
    paths: {
        '/inventory': {
            get: {
                summary: 'get list of all items',
                responses: { 200: { description: 'list of objects' } }
            }
        },
        '/inventory/{id}': {
            get: {
                summary: 'get info about a specific item',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'data of an item' }, 404: { description: 'not found' } }
            },
            put: {
                summary: 'update name or description',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    inventory_name: { type: 'string' },
                                    description: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'updated' } }
            },
            delete: {
                summary: 'delete item',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'deleted' } }
            }
        },
        '/inventory/{id}/photo': {
            get: {
                summary: 'get photo',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'image file' } }
            },
            put: {
                summary: 'update photo (multipart/form-data)',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    photo: { type: 'string', format: 'binary' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'photo updated' } }
            }
        },
        '/register': {
            post: {
                summary: 'register new item (multipart/form-data)',
                requestBody: {
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    inventory_name: { type: 'string', description: 'Name of the item' },
                                    description: { type: 'string', description: 'Item description' },
                                    photo: { type: 'string', format: 'binary', description: 'Image file' }
                                },
                                required: ['inventory_name']
                            }
                        }
                    }
                },
                responses: { 201: { description: 'created' }, 400: { description: 'bad request' } }
            }
        },
        '/search': {
            post: {
                summary: 'search item by ID',
                requestBody: {
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    has_photo: { type: 'string', enum: ['on'] }
                                },
                                required: ['id']
                            }
                        }
                    }
                },
                responses: { 200: { description: 'item found' }, 404: { description: 'not found' } }
            }
        }
    }
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/RegisterForm.html', (req, res) => res.sendFile(path.join(__dirname, 'RegisterForm.html')));
app.get('/SearchForm.html', (req, res) => res.sendFile(path.join(__dirname, 'SearchForm.html')));

app.post('/register', upload.single('photo'), (req, res) => {
    if (!req.body || !req.body.inventory_name)
    {
        return res.status(400).send('bad request');
    }

    const id = Date.now().toString();

    inventoryStorage[id] = {
        id,
        inventory_name: req.body.inventory_name,
        description: req.body.description || "",
        photoUrl: req.file ? `/inventory/${id}/photo` : null,
        photoPath: req.file ? req.file.path : null
    };

    res.status(201).send(`created, ID: ${id}`);
});

app.post('/search', (req, res) => {
    const { id, has_photo } = req.body;
    const item = inventoryStorage[id];

    if (!item)
    {
        return res.status(404).send('not found');
    }

    const result = { ...item };

    if (has_photo !== 'on')
    {
        delete result.photoUrl;
    }

    delete result.photoPath;
    res.json(result);
});

app.get('/inventory', (req, res) => res.json(Object.values(inventoryStorage)));
app.get('/inventory/:id', (req, res) => {
    const item = inventoryStorage[req.params.id];
    item ? res.json(item) : res.status(404).send('not found');
});

app.put('/inventory/:id', (req, res) => {
    const id = req.params.id;
    const item = inventoryStorage[id];

    if (!item) {
        return res.status(404).send('not found');
    }

    const { inventory_name, description } = req.body;

    if (inventory_name)
    {
        item.inventory_name = inventory_name;
    }

    if (description)
    {
        item.description = description;
    }

    console.log(`item ${id} updated`);
    res.json(item);
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventoryStorage[req.params.id];
    if (!item) return res.status(404).send('not found');
    if (!req.file) return res.status(400).send('photo missing');

    if (item.photoPath && fs.existsSync(item.photoPath)) {
        fs.unlinkSync(item.photoPath);
    }

    item.photoPath = req.file.path;
    item.photoUrl = `/inventory/${req.params.id}/photo`;
    res.send('photo updated');
});

app.delete('/inventory/:id', (req, res) => {
    const item = inventoryStorage[req.params.id];
    if (!item) return res.status(404).send('not found');
    if (item.photoPath && fs.existsSync(item.photoPath)) fs.unlinkSync(item.photoPath);
    delete inventoryStorage[req.params.id];
    res.send('deleted');
});

app.get('/inventory/:id/photo', (req, res) => {
    const item = inventoryStorage[req.params.id];
    if (!item || !item.photoPath || !fs.existsSync(item.photoPath)) return res.status(404).send('not found');
    res.set('Content-Type', 'image/jpeg');
    res.sendFile(path.resolve(item.photoPath));
});

app.listen(options.port, options.host, () => {
    console.log(`server: http://${options.host}:${options.port}`);
    console.log(`swagger: http://${options.host}:${options.port}/docs`);
});