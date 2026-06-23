// Basic templates for new projects
export const DEFAULT_YAML = `openapi: 3.0.3
info:
  title: DocTheatre API
  description: 
    $ref: "../markdown/description.md"
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /users:
    $ref: "./paths/users.yaml"
`;

export const USER_PATH_YAML = `get:
  summary: Retrieve a list of users
  description: Returns a list of users in the system.
  responses:
    '200':
      description: A successful response
      content:
        application/json:
          schema:
            type: array
            items:
              $ref: "../components/schemas/user.yaml"
`;

export const USER_SCHEMA_YAML = `type: object
properties:
  id:
    type: string
    format: uuid
    description: Unique user identifier
  username:
    type: string
    description: User's registration name
  email:
    type: string
    format: email
`;

export const DEFAULT_MD = `# DocTheatre Project Documentation

Welcome to your **DocTheatre** project. This Markdown file serves as supporting documentation.

## Diagram Example (Mermaid)

Here is a sequence diagram imported from a standalone Mermaid file:

@import "../mermaid/template.mmd"

\`\`\`mermaid
sequenceDiagram
  participant User
  participant Editor
  participant Previewer
  User->>Editor: Type YAML/Markdown
  Editor->>Previewer: Update State
  Previewer->>User: Display live docs & diagrams
\`\`\`

## Diagram Example (PlantUML)

Here is a component diagram imported from a standalone PlantUML file:

@import "../plantuml/template.puml"

\`\`\`plantuml
@startuml
actor User
boundary "DocTheatre" as Studio
control "Project State" as State

User -> Studio : Edit Files
Studio -> State : Debounce Autosave
State -> Studio : Update Live Preview
@enduml
\`\`\`
`;

export const DEFAULT_MERMAID = `sequenceDiagram
  participant User
  participant Editor
  participant Previewer
  User->>Editor: Type YAML/Markdown
  Editor->>Previewer: Update State
  Previewer->>User: Display live docs & diagrams
`;

export const DEFAULT_PLANTUML = `@startuml
actor User
boundary "DocTheatre" as Studio
control "Project State" as State

User -> Studio : Edit Files
Studio -> State : Debounce Autosave
State -> Studio : Update Live Preview
@enduml
`;

export const DEFAULT_DBML_ECOMMERCE = `// ===========================================================================
// PROJECT DEFINITION & DOCUMENTATION
// ===========================================================================

Project "Ecommerce" {
  database_type: 'PostgreSQL'
  Note: '''
    # E-commerce Database Schema
    This project defines the database schema for an e-commerce platform. It includes tables for managing users, products, orders, and more. The schema is designed to ensure data integrity and support the platform's operations efficiently.

    ## Key Features
    * **User Management**: Handles user accounts and authentication.
    * **Product Catalog**: Manages product listings and categories.
    * **Order Processing**: Supports order creation, tracking, and fulfillment.
    * **Promotions**: Allows for discount promotions and special offers.
  '''
}

// ===== ENUMS =====
Enum core.products_status {
  out_of_stock
  in_stock
  running_low [note: "less than 20"]
}

Enum core.orders_status {
  pending
  processing
  shipped
  canceled
}

// ===== TABLES =====

// --- CORE ---
Table core.users {
  id int [pk, increment, note: 'Id of the user']
  full_name varchar [note: 'Fullname of the user']
  email varchar [note: 'Email address of the user']
  username varchar [note: 'Username chosen by the user']
  password varchar [note: 'Hashed password of the user']
  phone_number varchar [note: 'Phone number of the user']
  last_login timestamp [note: 'Timestamp of the user\\'s last login']
  avatar_url varchar [note: 'URL of the user\\'s profile picture']
  created_at timestamp [note: 'When user created']
  country_code int [note: 'Country of the user']

  // NOTE: The "records" syntax is an official DBML feature.
  // However, the upstream @dbml/core parser currently throws a SyntaxError 
  // when parsing it. Once supported by @dbml/core, you can define sample data:
  /*
  records {
    1, 'Alice', 'alice@example.com', 'alice_1', 'hash123', '555-0101', '2026-06-22', 'http://example.com/a.png', '2026-01-01', 1
    2, 'Bob', 'bob@example.com', 'bob_2', 'hash456', '555-0102', '2026-06-20', 'http://example.com/b.png', '2026-01-02', 1
  }
  */

  Note: '''
  ## User Table
  The users table stores information about each user registered on the platform. It includes personal details, authentication credentials, and metadata about account creation and activity.

  ## Insert Code Example
  \`\`\`
  INSERT INTO core.users (full_name, email, username, password) VALUES ('Alice Brown', 'alice@example.com', 'alicebrown', 'hashedpassword');
  \`\`\`
  '''
}

Table core.order_items {
  id int [pk, increment, note: 'Id of the order item']
  order_id int [not null, note: 'Id of the order']
  product_id int [not null, note: 'Id of the product in the order item']
  product_name varchar [note: 'Name of the product in the order item']
  quantity int [default: 1, note: 'Quantity of the item']
  status orders_status
  price decimal [note: 'Price of the order item']
  image_url varchar [note: 'URL of the product image in the order item']

  Note: '''
  Quantity of the item
  '''
}

Table core.orders {
  id int [pk, note: 'Id of the order']
  user_id int [not null, unique]
  status orders_status [default: 'pending', 
  note: '''Status of the order:  
  - pending 
  - processing 
  - shipped 
  - canceled
  ''']
  created_at varchar [note: 'When order created']
  total_price decimal [note: 'Total price of the order']
  shipping_address varchar [note: 'Shipping address of the order']
  billing_address varchar [note: 'Billing address of the order']
  payment_method varchar [note: 'Payment method used for the order']
  payment_status varchar [note: 'Payment status of the order']
  shipping_carrier_id int [note: 'Id of the shipping carrier']

  Note: '''
  Status of the order:
  '''
}

Table core.order_item_variants {
  id int [pk, increment, note: 'Id of the order item variant']
  order_item_id int [not null, note: 'Id of the order item']
  product_variant_id int [not null, note: 'Id of the product variant']
}

Table core.merchants {
  id int [note: 'Id of the merchant']
  country_code int [note: 'Country of the merchant']
  status orders_status
  merchant_name varchar
  address varchar [note: 'Address of the merchant']
  website_url varchar [note: 'URL of the merchant\\'s website']
  phone_number varchar [note: 'Phone number of the merchant']
  email varchar [note: 'Email address of the merchant']
  logo_url varchar [note: 'URL of the merchant\\'slogo']
  created_at datetime [note: 'Default: now()  When merchant created']

  Note: '''
  When merchant created
  '''
}

Table core.shipping_carriers {
  id int [pk, increment, note: 'Id of the shipping carrier']
  name varchar [note: 'Name of the shipping carrier']
  tracking_url varchar [note: 'URL for tracking the shipment']
}

Table core.payment_transactions {
  id int [pk, increment, note: 'Id of the payment transaction']
  order_id int [not null, note: 'Id of the order']
  amount int [note: 'Amount of the payment transaction']
  status varchar [note: 'Status of the payment transaction']
  created_at datetime [note: 'Default: now()  When payment transaction created']
  payment_method varchar [note: 'Payment method used for the transaction']
  transaction_id varchar [note: 'Transaction id of the payment']

  Note: '''
  When payment transaction created
  '''
}

Table core.promotions {
  id int [pk, increment, note: 'Id of the promotion']
  name varchar [note: 'Name of the promotion']
  description varchar [note: 'Description of the promotion']
  discount_percentage decimal [note: 'Discount percentage of the promotion']
  start_date datetime [not null, note: 'Start date of the promotion']
  end_date datetime [not null, note: 'End date of the promotion']
  product_id int [not null, note: 'Id of the product associated with the promotion, if any']
}

Table info.countries {
  code int [pk, note: 'Referred from here']
  name varchar [note: 'Name of the country']
  continent_name varchar [note: 'Continent name of the country']
}

Table product.products {
  id int [pk, note: 'The product id']
  name varchar [note: 'The product name']
  description varchar [note: 'Description of the product']
  brand varchar [note: 'Brand of the product']
  color varchar [note: 'Color of the product']
  weight float [note: 'Weight of the product']
  dimensions varchar [note: 'Dimensions of the product']
  rating float [note: 'Rating of the product']
  merchant_id int [not null, note: 'The merchant id of the product']
  price decimal [note: 'Price of the product']
  created_at datetime [note: 'Default: now()  When product created']
  category_id int [note: 'Id of the category the product belongs to']
  expiry_date datetime [note: 'Expiration date of the product from the maker']

  Note: '''
  When product created
  '''
}

Table product.categories {
  id int [pk, increment, note: 'Id of the category']
  name varchar [note: 'Name of the category']
  parent_category_id int [note: 'Id of the parent category, if any']
}

Table product.product_variants {
  id int [pk, increment, note: 'Id of the product variant']
  name varchar [note: 'Name of the product variant']
  product_id int [not null, note: 'Id of the product']
}

Table product.product_tags {
  id int [pk, note: 'Id of the product tag']
  name varchar [note: 'Name of the product tag']

  Note: '''
  A label to identification or to give other information for the product.
Example a product of T-shirt may has some tags as clothes, unisex, children.
  '''
}

Table product.product_tags_map {
  product_id int [not null, note: 'The product id']
  tag_id int [not null, note: 'The tag id']
}

Table cart.cart_items {
  id int [pk, increment, note: 'Id of the cart item']
  user_id int [not null, unique]
  product_id int [not null, note: 'The product id']
  quantity int [note: 'Default: 1  Quantity of the item']
  created_at datetime [note: 'Default: now()  When item added to cart']

  Note: '''
  Quantity of the item
  When item added to cart
  '''
}

Table review.reviews {
  id int [pk, increment, note: 'Id of the review']
  user_id int [not null, note: 'The user id who wrote the review']
  product_id int [not null, note: 'The reviewed product id']
  rating int [note: 'Rating of the review']
  comment varchar [note: 'Comment of the review']
  created_at datetime [note: 'Default: now()  When review created']

  Note: '''
  When review created
  '''
}

Table wishlist.wishlists {
  id int [pk, increment, note: 'Id of the wishlist']
  user_id int [not null, note: 'Id of the user who created the wishlist']
  name varchar [note: 'Name of the wishlist']
}

Table wishlist.wishlist_items {
  id int [pk, increment, note: 'Id of the wishlist item']
  wishlist_id int [not null, note: 'Id of the wishlist']
  product_id int [not null, note: 'Id of the product in the wishlist item']
  created_at datetime [note: 'Default: now()  When wishlist item created']

  Note: '''
  When wishlist item created
  '''
}

TableGroup "User Management" {
  core.users
}

// ===== TABLEGROUPS =====
TableGroup "Order Management" [note: 'Contains tables relating to product ordering system'] {
  core.orders
  core.order_items
  core.order_item_variants
  core.payment_transactions
  core.shipping_carriers
}

TableGroup "Product Management" {
  product.products
  product.categories
  product.product_variants
  product.product_tags
  product.product_tags_map
}

TableGroup "Wishlist Management" [note: 'Contains tables relating to the user wishlist system'] {
  wishlist.wishlists
  wishlist.wishlist_items
}

TableGroup "Cart Management" {
  cart.cart_items
}

TableGroup "Review Management" {
  review.reviews
}

TableGroup "Merchant & Promotions" {
  core.merchants
  core.promotions
}

TableGroup "Reference Data" {
  info.countries
}

// ===== RELATIONSHIPS (Refs) =====
Ref: core.users.country_code > info.countries.code
Ref: core.merchants.country_code > info.countries.code

// Category self-referencing hierarchy
Ref: product.categories.parent_category_id > product.categories.id

// Product dependencies
Ref: product.products.category_id > product.categories.id
Ref: product.products.merchant_id > core.merchants.id

// Product Variants & Tags
Ref: product.product_variants.product_id > product.products.id
Ref: product.product_tags_map.product_id > product.products.id
Ref: product.product_tags_map.tag_id > product.product_tags.id

// Order & Order Item links
Ref: core.orders.user_id > core.users.id
Ref: core.orders.shipping_carrier_id > core.shipping_carriers.id
Ref: core.order_items.order_id > core.orders.id
Ref: core.order_items.product_id > product.products.id
Ref: core.order_item_variants.order_item_id > core.order_items.id
Ref: core.order_item_variants.product_variant_id > product.product_variants.id

// Payments & Transactions
Ref: core.payment_transactions.order_id > core.orders.id

// Cart & Reviews
Ref: cart.cart_items.user_id > core.users.id
Ref: cart.cart_items.product_id > product.products.id
Ref: review.reviews.user_id > core.users.id
Ref: review.reviews.product_id > product.products.id

// Wishlists
Ref: wishlist.wishlists.user_id > core.users.id
Ref: wishlist.wishlist_items.wishlist_id > wishlist.wishlists.id
Ref: wishlist.wishlist_items.product_id > product.products.id

// Promotions
Ref: core.promotions.product_id > product.products.id
`;

// Default Project folder structure helper function
export function getInitialProjectFiles(key) {
  return [
    { projectKey: key, path: 'openapi/openapi.yaml', content: DEFAULT_YAML, type: 'file' },
    { projectKey: key, path: 'openapi/paths/users.yaml', content: USER_PATH_YAML, type: 'file' },
    { projectKey: key, path: 'openapi/components/schemas/user.yaml', content: USER_SCHEMA_YAML, type: 'file' },
    { projectKey: key, path: 'mermaid/template.mmd', content: DEFAULT_MERMAID, type: 'file' },
    { projectKey: key, path: 'plantuml/template.puml', content: DEFAULT_PLANTUML, type: 'file' },
    { projectKey: key, path: 'markdown/description.md', content: DEFAULT_MD, type: 'file' },
    { projectKey: key, path: 'dbml/ecommerce.dbml', content: DEFAULT_DBML_ECOMMERCE, type: 'file' }
  ];
}
