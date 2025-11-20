import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'products',
      columns: [
        { name: 'skuid', type: 'string', isIndexed: true },
        { name: 'barcode_pos', type: 'string', isIndexed: true },
        { name: 'product_name', type: 'string' },
        { name: 'merchant_id', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
})
