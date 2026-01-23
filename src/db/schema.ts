import { pgTable, uuid, text, integer, decimal, timestamp, pgEnum, index, uniqueIndex, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const supplierStatusEnum = pgEnum('supplier_status', ['active', 'inactive', 'blacklisted']);
export const supplierLifecycleEnum = pgEnum('supplier_lifecycle', ['prospect', 'onboarding', 'active', 'suspended', 'terminated']);
export const orderStatusEnum = pgEnum('order_status', ['draft', 'sent', 'fulfilled', 'cancelled']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'supplier']);
export const abcClassificationEnum = pgEnum('abc_classification', ['A', 'B', 'C', 'X', 'Y', 'Z', 'None']);
export const conflictMineralsEnum = pgEnum('conflict_minerals_status', ['compliant', 'non_compliant', 'unknown']);
export const tierLevelEnum = pgEnum('tier_level', ['tier_1', 'tier_2', 'tier_3', 'critical']);
export const incotermsEnum = pgEnum('incoterms', ['EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']);
export const requisitionStatusEnum = pgEnum('requisition_status', ['draft', 'pending_approval', 'approved', 'rejected', 'converted_to_po']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['pending', 'matched', 'disputed', 'paid']);

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
    abcClassification: abcClassificationEnum('abc_classification').default('None'),
    carbonFootprintScope1: decimal('carbon_footprint_scope_1', { precision: 12, scale: 2 }).default('0'),
    carbonFootprintScope2: decimal('carbon_footprint_scope_2', { precision: 12, scale: 2 }).default('0'),
    carbonFootprintScope3: decimal('carbon_footprint_scope_3', { precision: 12, scale: 2 }).default('0'),
    conflictMineralsStatus: conflictMineralsEnum('conflict_minerals_status').default('unknown'),
    lastAuditDate: timestamp('last_audit_date'),
    lastRiskAudit: timestamp('last_risk_audit'),
    // Global Standards & Compliance
    isoCertifications: text('iso_certifications').array(), // e.g. ["ISO 9001", "ISO 14001"]
    esgEnvironmentScore: integer('esg_environment_score').default(0),
    esgSocialScore: integer('esg_social_score').default(0),
    esgGovernanceScore: integer('esg_governance_score').default(0),
    financialHealthRating: text('financial_health_rating'), // e.g. "AAA", "B+"
    tierLevel: tierLevelEnum('tier_level').default('tier_3'),
    isConflictMineralCompliant: text('is_conflict_mineral_compliant').default('no'),
    modernSlaveryStatement: text('modern_slavery_statement').default('no'),
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
    abcClassification: abcClassificationEnum('abc_classification').default('None'),
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
    contractId: uuid('contract_id').references(() => contracts.id),
    requisitionId: uuid('requisition_id').references(() => requisitions.id),
    incoterms: text('incoterms'),
    asnNumber: text('asn_number'),
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
export const contractTypeEnum = pgEnum('contract_type', ['framework_agreement', 'nda', 'service_agreement', 'one_off']);
export const contractStatusEnum = pgEnum('contract_status', ['draft', 'active', 'expired', 'terminated', 'pending_renewal']);
export const renewalStatusEnum = pgEnum('renewal_status', ['auto_renew', 'manual', 'none']);

export const contracts = pgTable('contracts', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    title: text('title').notNull(),
    type: contractTypeEnum('type').default('one_off'),
    status: contractStatusEnum('status').default('draft'),
    value: decimal('value', { precision: 12, scale: 2 }).default('0'),
    validFrom: timestamp('valid_from'),
    validTo: timestamp('valid_to'),
    noticePeriod: integer('notice_period').default(30), // days
    renewalStatus: renewalStatusEnum('renewal_status').default('manual'),
    incoterms: incotermsEnum('incoterms'),
    slaKpis: text('sla_kpis'), // JSON string of metrics
    documentUrl: text('document_url'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    contractSupplierIdx: index('contract_supplier_idx').on(table.supplierId),
    contractStatusIdx: index('contract_status_idx').on(table.status),
}));

export const documents = pgTable('documents', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    orderId: uuid('order_id').references(() => procurementOrders.id),
    contractId: uuid('contract_id').references(() => contracts.id),
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

export const requisitions = pgTable('requisitions', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    requestedById: uuid('requested_by_id').references(() => users.id).notNull(),
    status: requisitionStatusEnum('status').default('draft'),
    estimatedAmount: decimal('estimated_amount', { precision: 12, scale: 2 }).default('0'),
    department: text('department'),
    purchaseOrderId: uuid('purchase_order_id').references(() => procurementOrders.id),
    createdAt: timestamp('created_at').defaultNow(),
});

export const goodsReceipts = pgTable('goods_receipts', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => procurementOrders.id).notNull(),
    receivedById: uuid('received_by_id').references(() => users.id).notNull(),
    receivedAt: timestamp('received_at').defaultNow(),
    notes: text('notes'),
});

export const invoices = pgTable('invoices', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => procurementOrders.id).notNull(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    status: invoiceStatusEnum('status').default('pending'),
    matchedAt: timestamp('matched_at'),
    createdAt: timestamp('created_at').defaultNow(),
});


export const ordersRelations = relations(procurementOrders, ({ one, many }: any) => ({
    supplier: one(suppliers, {
        fields: [procurementOrders.supplierId],
        references: [suppliers.id],
    }),
    items: many(orderItems),
    documents: many(documents),
    contract: one(contracts, {
        fields: [procurementOrders.contractId],
        references: [contracts.id],
    }),
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
    contract: one(contracts, {
        fields: [documents.contractId],
        references: [contracts.id],
    }),
}));

export const contractsRelations = relations(contracts, ({ one, many }: any) => ({
    supplier: one(suppliers, {
        fields: [contracts.supplierId],
        references: [suppliers.id],
    }),
    orders: many(procurementOrders),
    documents: many(documents),
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
    docs: many(documents),
    rfqs: many(rfqSuppliers),
    performanceLogs: many(supplierPerformanceLogs),
    contracts: many(contracts),
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

export const requisitionsRelations = relations(requisitions, ({ one }: any) => ({
    requestedBy: one(users, {
        fields: [requisitions.requestedById],
        references: [users.id],
    }),
    purchaseOrder: one(procurementOrders, {
        fields: [requisitions.purchaseOrderId],
        references: [procurementOrders.id],
    }),
}));

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one }: any) => ({
    order: one(procurementOrders, {
        fields: [goodsReceipts.orderId],
        references: [procurementOrders.id],
    }),
    receivedBy: one(users, {
        fields: [goodsReceipts.receivedById],
        references: [users.id],
    }),
}));

export const invoicesRelations = relations(invoices, ({ one }: any) => ({
    order: one(procurementOrders, {
        fields: [invoices.orderId],
        references: [procurementOrders.id],
    }),
    supplier: one(suppliers, {
        fields: [invoices.supplierId],
        references: [suppliers.id],
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
export type Contract = typeof contracts.$inferSelect;