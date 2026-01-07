import { pgTable, uuid, text, integer, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const supplierStatusEnum = pgEnum('supplier_status', ['active', 'inactive', 'blacklisted']);
export const orderStatusEnum = pgEnum('order_status', ['draft', 'sent', 'fulfilled', 'cancelled']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    role: userRoleEnum('role').default('user'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const suppliers = pgTable('suppliers', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    contactEmail: text('contact_email').notNull(),
    status: supplierStatusEnum('status').default('active'),
    riskScore: integer('risk_score').default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

export const parts = pgTable('parts', {
    id: uuid('id').defaultRandom().primaryKey(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    stockLevel: integer('stock_level').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
});

export const procurementOrders = pgTable('procurement_orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    status: orderStatusEnum('status').default('draft'),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).default('0'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => procurementOrders.id).notNull(),
    partId: uuid('part_id').references(() => parts.id).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    action: text('action').notNull(), // e.g., 'CREATE', 'UPDATE', 'DELETE'
    entityType: text('entity_type').notNull(), // e.g., 'supplier', 'order'
    entityId: uuid('entity_id').notNull(),
    details: text('details').notNull(), // JSON string or text summary
    createdAt: timestamp('created_at').defaultNow(),
});

export const comments = pgTable('comments', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    entityType: text('entity_type').notNull(), // e.g., 'supplier', 'order'
    entityId: uuid('entity_id').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    read: text('read').default('no'), // 'yes' or 'no'
    createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const suppliersRelations = relations(suppliers, ({ many }: any) => ({
    orders: many(procurementOrders),
}));

export const ordersRelations = relations(procurementOrders, ({ one, many }: any) => ({
    supplier: one(suppliers, {
        fields: [procurementOrders.supplierId],
        references: [suppliers.id],
    }),
    items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }: any) => ({
    order: one(procurementOrders, {
        fields: [orderItems.orderId],
        references: [procurementOrders.id],
    }),
    part: one(parts, {
        fields: [orderItems.partId],
        references: [parts.id],
    }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }: any) => ({
    user: one(users, {
        fields: [auditLogs.userId],
        references: [users.id],
    }),
}));

export const commentsRelations = relations(comments, ({ one }: any) => ({
    user: one(users, {
        fields: [comments.userId],
        references: [users.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }: any) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));
