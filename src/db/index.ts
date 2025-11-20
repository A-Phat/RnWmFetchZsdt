import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { schema } from './schema'
import Product from './models/Product'

// Create the SQLite adapter
const adapter = new SQLiteAdapter({
  schema,
  // Optional: use JSI for better performance (requires new architecture)
  jsi: false,
  // Optional: database name
  dbName: 'RnWmFetchZsdt',
})

// Create the database
export const database = new Database({
  adapter,
  modelClasses: [Product],
})
