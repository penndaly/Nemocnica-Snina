module.exports = ({ env }) => {
  const usePostgres = env('NODE_ENV') === 'production' || env('DB_CLIENT') === 'postgres';
  if (usePostgres) {
    return {
      connection: {
        client: 'postgres',
        connection: {
          host:     env('DB_HOST',     '127.0.0.1'),
          port:     env.int('DB_PORT', 5432),
          database: env('DB_NAME',     'nemocnica_cms'),
          user:     env('DB_USER',     'strapi'),
          password: env('DB_PASSWORD', ''),
          ssl: env.bool('DB_SSL', false) ? { rejectUnauthorized: false } : false,
        },
        pool: { min: 2, max: 10 },
        acquireConnectionTimeout: 60_000,
      },
    };
  }
  // Local dev: SQLite
  return {
    connection: {
      client: 'sqlite', // Strapi 4 dialect name; the driver it loads is better-sqlite3. 'better-sqlite3' here throws "Unknown dialect" (CMS-1).
      connection: { filename: env('SQLITE_PATH', '.tmp/data.db') },
      useNullAsDefault: true,
    },
  };
};
