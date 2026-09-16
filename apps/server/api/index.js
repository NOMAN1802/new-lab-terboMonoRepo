/* eslint-disable no-console */
/**
 * Serverless entry for Vercel.
 *
 * src/server.ts cannot be used here: it calls app.listen(), which never returns
 * in a serverless function, and it connects to Mongo once at boot. On Vercel
 * every cold start is a fresh process, so the connection is cached on the
 * global object instead — without that, each invocation opens its own pool and
 * Atlas starts refusing connections under any real traffic.
 */
const mongoose = require('mongoose');

const app = require('../dist/app').default;
const config = require('../dist/app/config').default;
const { seedAdmin } = require('../dist/app/modules/User/user.seeder');

/**
 * Survives between invocations that reuse a warm container, and is a promise
 * rather than a boolean so concurrent requests during a cold start await the
 * same connection instead of racing to open several.
 */
let connection = global.__newlabMongo;

const connect = async () => {
  if (!connection) {
    mongoose.set('strictQuery', true);

    connection = mongoose
      .connect(config.db_url, {
        // A serverless container handles one request at a time, so a large
        // pool is wasted sockets held open against Atlas.
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 8000,
      })
      .then(async (result) => {
        // Idempotent, and cheap once the admin exists: a cold start is the only
        // moment a fresh deployment could have no way in.
        await seedAdmin().catch((error) =>
          console.error('Admin seed skipped:', error.message)
        );
        return result;
      })
      .catch((error) => {
        // Clear the cache so the next request retries rather than reusing a
        // rejected promise for the life of the container.
        connection = undefined;
        global.__newlabMongo = undefined;
        throw error;
      });

    global.__newlabMongo = connection;
  }

  return connection;
};

module.exports = async (req, res) => {
  try {
    await connect();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: 'Database unavailable. Please try again in a moment.',
      })
    );
    return;
  }

  return app(req, res);
};
