import path from 'path';

process.env.DATABASE_URL = `file:${path.join(__dirname, '../../prisma/test.db')}`;
