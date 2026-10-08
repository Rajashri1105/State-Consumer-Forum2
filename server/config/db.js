const { PrismaClient } = require('@prisma/client');
const config = require('./env');

// Prevent multiple PrismaClient instances in dev (hot-reload) by caching
// on the global object.
const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: config.env === 'development' ? ['warn', 'error'] : ['error'],
  });

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
