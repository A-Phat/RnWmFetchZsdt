import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class Product extends Model {
  static table = 'products'

  @field('skuid') skuid!: string
  @field('barcode_pos') barcode_pos!: string
  @field('product_name') product_name!: string
  @field('merchant_id') merchant_id!: string
  @field('status') status!: string
  @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date
}
