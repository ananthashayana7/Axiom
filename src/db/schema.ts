import { pgTable, uuid, text, integer, decimal, timestamp, pgEnum, index, uniqueIndex, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const supplierStatusEnum = pgEnum('supplier_status', ['active', 'inactive', 'blacklisted']);
export const supplierLifecycleEnum = pgEnum('supplier_lifecycle', ['prospect', 'onboarding', 'active', 'suspended', 'terminated']);
export const orderStatusEnum = pgEnum('order_status', ['draft', 'sent', 'fulfilled', 'cancelled']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'supplier']);

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    employeeId: text('employee_id').unique(),
    password: text('password').notNull(),
    role: userRoleEnum('role').default('user'),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    emailIdx: uniqueIndex('email_idx').on(table.email),
    employeeIdIdx: uniqueIndex('employee_id_idx').on(table.employeeId),
    roleIdx: index('role_idx').on(table.role),
}));

export const suppliers = pgTable('suppliers', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    contactEmail: text('contact_email').notNull(),
    status: supplierStatusEnum('status').default('active'),
    lifecycleStatus: supplierLifecycleEnum('lifecycle_status').default('prospect'),
    riskScore: integer('risk_score').default(0),
    performanceScore: integer('performance_score').default(0),
    esgScore: integer('esg_score').default(0),
    financialScore: integer('financial_score').default(0),
    onTimeDeliveryRate: decimal('on_time_delivery_rate', { precision: 5, scale: 2 }).default('0'),
    defectRate: decimal('defect_rate', { precision: 5, scale: 2 }).default('0'),
    collaborationScore: integer('collaboration_score').default(0),
    responsivenessScore: integer('responsiveness_score').default(0),
    categories: text('categories').array(),
    lastAuditDate: timestamp('last_audit_date'),
    lastRiskAudit: timestamp('last_risk_audit'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    statusIdx: index('supplier_status_idx').on(table.status),
    lifecycleIdx: index('supplier_lifecycle_idx').on(table.lifecycleStatus),
}));

export const supplierPerformanceLogs = pgTable('supplier_performance_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    recordedAt: timestamp('recorded_at').defaultNow(),
    deliveryRate: decimal('delivery_rate', { precision: 5, scale: 2 }).notNull(),
    qualityScore: decimal('quality_score', { precision: 5, scale: 2 }).notNull(),
    collaborationScore: integer('collaboration_score').notNull(),
    notes: text('notes'),
}, (table: any) => ({
    perfSupplierIdx: index('perf_supplier_idx').on(table.supplierId),
    recordedAtIdx: index('recorded_at_idx').on(table.recordedAt),
}));

export const parts = pgTable('parts', {
    id: uuid('id').defaultRandom().primaryKey(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    price: decimal('price', { precision: 12, scale: 2 }).default('0').notNull(),
    marketTrend: text('market_trend').default('stable'),
    stockLevel: integer('stock_level').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    skuIdx: uniqueIndex('sku_idx').on(table.sku),
    categoryIdx: index('category_idx').on(table.category),
}));

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
}, (table: any) => ({
    auditUserIdx: index('audit_user_idx').on(table.userId),
    auditEntityIdx: index('audit_entity_idx').on(table.entityType, table.entityId),
    auditCreatedIdx: index('audit_created_idx').on(table.createdAt),
}));

export const comments = pgTable('comments', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    entityType: text('entity_type').notNull(), // e.g., 'supplier', 'order'
    entityId: uuid('entity_id').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const notificationTypeEnum = pgEnum('notification_type', ['info', 'warning', 'success', 'error']);

export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: notificationTypeEnum('type').default('info'),
    isRead: text('is_read').default('no'),
    link: text('link'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    userIdIdx: index('notif_user_idx').on(table.userId),
    readIdx: index('notif_read_idx').on(table.isRead),
}));

export const docTypeEnum = pgEnum('doc_type', ['contract', 'invoice', 'quote', 'license', 'other']);
export const rfqStatusEnum = pgEnum('rfq_status', ['draft', 'open', 'closed', 'cancelled']);
export const rfqSupplierStatusEnum = pgEnum('rfq_supplier_status', ['invited', 'quoted', 'declined']);

export const documents = pgTable('documents', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    orderId: uuid('order_id').references(() => procurementOrders.id),
    rfqId: uuid('rfq_id').references(() => rfqs.id),
    name: text('name').notNull(),
    type: docTypeEnum('type').default('other'),
    url: text('url'), // In a real app, this would be an S3/GCS link
    createdAt: timestamp('created_at').defaultNow(),
});

export const rfqs = pgTable('rfqs', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: rfqStatusEnum('status').default('draft'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const rfqItems = pgTable('rfq_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    rfqId: uuid('rfq_id').references(() => rfqs.id).notNull(),
    partId: uuid('part_id').references(() => parts.id).notNull(),
    quantity: integer('quantity').notNull(),
});

export const rfqSuppliers = pgTable('rfq_suppliers', {
    id: uuid('id').defaultRandom().primaryKey(),
    rfqId: uuid('rfq_id').references(() => rfqs.id).notNull(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    status: rfqSupplierStatusEnum('status').default('invited'),
    quoteAmount: decimal('quote_amount', { precision: 10, scale: 2 }),
    aiAnalysis: text('ai_analysis'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    rfqSupplierRfqIdx: index('rfq_supplier_rfq_idx').on(table.rfqId),
    rfqSupplierSupplierIdx: index('rfq_supplier_supplier_idx').on(table.supplierId),
    rfqSupplierStatusIdx: index('rfq_supplier_status_idx').on(table.status),
}));

export const platformSettings = pgTable('platform_settings', {
    id: serial('id').primaryKey(),
    platformName: text('platform_name').notNull().default('Axiom'),
    defaultCurrency: text('default_currency').notNull().default('INR'),
    isSettingsLocked: text('is_settings_locked').notNull().default('no'),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// notifications table moved up

export const chatHistory = pgTable('chat_history', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    role: text('role').notNull(), // 'user' or 'assistant'
    content: text('content').notNull(),
    timestamp: timestamp('timestamp').defaultNow(),
});


export const ordersRelations = relations(procurementOrders, ({ one, many }: any) => ({
    supplier: one(suppliers, {
        fields: [procurementOrders.supplierId],
        references: [suppliers.id],
    }),
    items: many(orderItems),
    documents: many(documents),
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

export const documentsRelations = relations(documents, ({ one }: any) => ({
    supplier: one(suppliers, {
        fields: [documents.supplierId],
        references: [suppliers.id],
    }),
    order: one(procurementOrders, {
        fields: [documents.orderId],
        references: [procurementOrders.id],
    }),
    rfq: one(rfqs, {
        fields: [documents.rfqId],
        references: [rfqs.id],
    }),
}));

export const rfqsRelations = relations(rfqs, ({ many }: any) => ({
    items: many(rfqItems),
    suppliers: many(rfqSuppliers),
    documents: many(documents),
}));

export const rfqItemsRelations = relations(rfqItems, ({ one }: any) => ({
    rfq: one(rfqs, {
        fields: [rfqItems.rfqId],
        references: [rfqs.id],
    }),
    part: one(parts, {
        fields: [rfqItems.partId],
        references: [parts.id],
    }),
}));

export const rfqSuppliersRelations = relations(rfqSuppliers, ({ one }: any) => ({
    rfq: one(rfqs, {
        fields: [rfqSuppliers.rfqId],
        references: [rfqs.id],
    }),
    supplier: one(suppliers, {
        fields: [rfqSuppliers.supplierId],
        references: [suppliers.id],
    }),
}));

export const suppliersRelations = relations(suppliers, ({ many }: any) => ({
    orders: many(procurementOrders),
    documents: many(documents),
    rfqs: many(rfqSuppliers),
    performanceLogs: many(supplierPerformanceLogs),
}));

export const supplierPerformanceLogsRelations = relations(supplierPerformanceLogs, ({ one }: any) => ({
    supplier: one(suppliers, {
        fields: [supplierPerformanceLogs.supplierId],
        references: [suppliers.id],
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

// ============================================================================
// TYPE EXPORTS - Add these at the end of the file
// ============================================================================

export type User = typeof users.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Part = typeof parts.$inferSelect;
export type ProcurementOrder = typeof procurementOrders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type RFQ = typeof rfqs.$inferSelect;
export type RFQItem = typeof rfqItems.$inferSelect;
export type RFQSupplier = typeof rfqSuppliers.$inferSelect;
export type SupplierPerformanceLog = typeof supplierPerformanceLogs.$inferSelect;
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type Notification = typeof notifications.$inferSelect;