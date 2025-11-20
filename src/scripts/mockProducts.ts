import { database } from '../db'
import Product from '../db/models/Product'

/**
 * Insert mock products efficiently using batch operations
 */
export async function insertMockProducts() {
  const products = database.get<Product>('products')

  // Check if products already exist to avoid duplicates
  const existingCount = await products.query().fetchCount()
  if (existingCount > 0) {
    console.log(`✅ Mock products already exist (${existingCount} rows), skipping insert`)
    return
  }

  // Batch create all products in a single transaction
  await database.write(async () => {
    const mockData = [
      {
        skuid: 'SKU-001',
        barcode_pos: '8850000000011',
        product_name: 'Coke Zero 325ml',
        merchant_id: 'M001',
        status: 'PENDING',
      },
      {
        skuid: 'SKU-002',
        barcode_pos: '8850000000022',
        product_name: 'Pepsi Max 325ml',
        merchant_id: 'M001',
        status: 'PENDING',
      },
      {
        skuid: 'SKU-003',
        barcode_pos: '8850000000033',
        product_name: 'Sprite 325ml',
        merchant_id: 'M002',
        status: 'PENDING',
      },
    ]

    // Create all products in parallel within the transaction
    await Promise.all(
      mockData.map(data =>
        products.create(p => {
          p.skuid = data.skuid
          p.barcode_pos = data.barcode_pos
          p.product_name = data.product_name
          p.merchant_id = data.merchant_id
          p.status = data.status
        })
      )
    )
  })

  console.log('✅ Mock products inserted (3 rows)')
}
