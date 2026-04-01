/* eslint-disable @typescript-eslint/no-explicit-any */
import { pgTable, uuid, text, integer, decimal, timestamp, pgEnum, index, uniqueIndex, serial, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const supplierStatusEnum = pgEnum('supplier_status', ['active', 'inactive', 'blacklisted']);
export const supplierLifecycleEnum = pgEnum('supplier_lifecycle', ['prospect', 'onboarding', 'active', 'suspended', 'terminated']);
export const orderStatusEnum = pgEnum('order_status', ['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'fulfilled', 'cancelled']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'supplier']);
export const abcClassificationEnum = pgEnum('abc_classification', ['A', 'B', 'C', 'X', 'Y', 'Z', 'None']);
export const conflictMineralsEnum = pgEnum('conflict_minerals_status', ['compliant', 'non_compliant', 'unknown']);
export const tierLevelEnum = pgEnum('tier_level', ['tier_1', 'tier_2', 'tier_3', 'critical']);
export const incotermsEnum = pgEnum('incoterms', ['EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']);
export const requisitionStatusEnum = pgEnum('requisition_status', ['draft', 'pending_approval', 'approved', 'rejected', 'converted_to_po']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['pending', 'matched', 'disputed', 'paid']);
export const telemetryTypeEnum = pgEnum('telemetry_type', ['event', 'metric', 'error', 'security']);
export const inspectionStatusEnum = pgEnum('inspection_status', ['pending', 'passed', 'failed', 'conditional']);

// ============================================================================
// WORKFLOW, COMPLIANCE, SUPPLIER INTELLIGENCE, SOURCING & COST ENUMS
// ============================================================================

export const taskStatusEnum = pgEnum('task_status', ['open', 'in_progress', 'blocked', 'completed', 'cancelled', 'escalated']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'critical']);
export const taskEntityTypeEnum = pgEnum('task_entity_type', [
    'requisition', 'rfq', 'order', 'invoice', 'contract', 'supplier', 'compliance_obligation', 'agent_recommendation'
]);
export const complianceStatusEnum = pgEnum('compliance_status', ['active', 'expiring_soon', 'expired', 'waived', 'not_applicable']);
export const supplierRequestTypeEnum = pgEnum('supplier_request_type', [
    'document_request', 'corrective_action', 'compliance_attestation', 'commercial_clarification', 'onboarding', 'periodic_review'
]);
export const supplierRequestStatusEnum = pgEnum('supplier_request_status', ['draft', 'sent', 'acknowledged', 'in_progress', 'submitted', 'verified', 'rejected', 'overdue']);
export const actionPlanSeverityEnum = pgEnum('action_plan_severity', ['low', 'medium', 'high', 'critical']);
export const actionPlanStatusEnum = pgEnum('action_plan_status', ['draft', 'active', 'in_progress', 'completed', 'cancelled']);
export const supplierSegmentEnum = pgEnum('supplier_segment', ['strategic', 'bottleneck', 'leverage', 'routine', 'high_risk']);
export const sourcingEventStatusEnum = pgEnum('sourcing_event_status', [
    'draft', 'launched', 'supplier_qa', 'bid_submitted', 'bid_locked', 'evaluation', 'negotiation', 'awarded', 'closed', 'cancelled'
]);
export const sourcingMessageTypeEnum = pgEnum('sourcing_message_type', ['question', 'answer', 'clarification', 'general', 'system']);
export const savingsCategoryEnum = pgEnum('savings_category', [
    'negotiated', 'avoided', 'process', 'logistics', 'payment_term', 'should_cost', 'consolidation', 'volume_discount'
]);
export const savingsTrackingStatusEnum = pgEnum('savings_tracking_status', ['forecast', 'realized', 'validated', 'disputed']);
export const approvalPolicyTypeEnum = pgEnum('approval_policy_type', ['amount', 'category', 'supplier_risk', 'contract_coverage', 'combined']);
export const importJobStatusEnum = pgEnum('import_job_status', ['pending', 'validating', 'validated', 'importing', 'completed', 'failed', 'rolled_back']);

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    employeeId: text('employee_id').unique(),
    phoneNumber: text('phone_number').unique(),
    twoFactorSecret: text('two_factor_secret'),
    isTwoFactorEnabled: boolean('is_two_factor_enabled').default(false),
    password: text('password').notNull(),
    role: userRoleEnum('role').default('user'),
    department: text('department'), // Added for department mapping
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    // emailIdx: uniqueIndex('email_idx').on(table.email),
    // roleIdx: index('role_idx').on(table.role),
    employeeIdIdx: uniqueIndex('employee_id_idx').on(table.employeeId),
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
    // Geographic Data for Risk Control Tower
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    countryCode: text('country_code'), // ISO 2-char code
    city: text('city'),
    segment: supplierSegmentEnum('segment'), // Kraljic matrix: strategic, bottleneck, leverage, routine, high_risk
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
    reorderPoint: integer('reorder_point').default(50),
    minStockLevel: integer('min_stock_level').default(20),
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
    // Logistics Tracking
    carrier: text('carrier'), // e.g., 'FedEx', 'DHL', 'BlueDart'
    trackingNumber: text('tracking_number'),
    estimatedArrival: timestamp('estimated_arrival'),
    // Cost Avoidance & Savings
    initialQuoteAmount: decimal('initial_quote_amount', { precision: 12, scale: 2 }), // Price before negotiation
    savingsAmount: decimal('savings_amount', { precision: 12, scale: 2 }).default('0'), // (Initial - Total)
    savingsType: text('savings_type'), // e.g. 'negotiation', 'volume_discount', 'strategic'
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    orderSupplierIdx: index('order_supplier_idx').on(table.supplierId),
    orderStatusIdx: index('order_status_idx').on(table.status),
    orderReqIdx: index('order_req_idx').on(table.requisitionId),
    orderCreatedAtIdx: index('order_created_at_idx').on(table.createdAt),
}));

export const orderItems = pgTable('order_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => procurementOrders.id).notNull(),
    partId: uuid('part_id').references(() => parts.id).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
}, (table: any) => ({
    itemOrderIdx: index('item_order_idx').on(table.orderId),
    itemPartIdx: index('item_part_idx').on(table.partId),
}));

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

export const systemTelemetry = pgTable('system_telemetry', {
    id: uuid('id').defaultRandom().primaryKey(),
    type: telemetryTypeEnum('type').default('event'),
    scope: text('scope').notNull(), // e.g., 'AxiomCopilot', 'SpendAnalysis'
    key: text('key').notNull(), // e.g., 'latency', 'token_usage', 'error_rate'
    value: decimal('value', { precision: 12, scale: 4 }),
    metadata: text('metadata'), // JSONified context
    userId: uuid('user_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    telemetryTypeIdx: index('telemetry_type_idx').on(table.type),
    telemetryScopeIdx: index('telemetry_scope_idx').on(table.scope),
    telemetryCreatedIdx: index('telemetry_created_idx').on(table.createdAt),
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
    // AI Intelligence Fields
    aiExtractedData: text('ai_extracted_data'), // JSON storage for raw AI parsing
    liabilityCap: decimal('liability_cap', { precision: 12, scale: 2 }),
    priceLockExpiry: timestamp('price_lock_expiry'),
    autoRenewalAlert: text('auto_renewal_alert').default('true'), // Boolean stored as text for simplicity or change to boolean if supported
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
    deadline: timestamp('deadline'),
    category: text('category'),
    createdById: uuid('created_by_id').references(() => users.id),
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
    geminiApiKey: text('gemini_api_key'),
    geminiApiKeyFallback1: text('gemini_api_key_fallback_1'),
    geminiApiKeyFallback2: text('gemini_api_key_fallback_2'),
    exchangeRates: text('exchange_rates'), // JSON: {base, date, rates: {USD: 1.2, ...}}
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
    budgetId: uuid('budget_id'), // References budgets table for budget tracking
    purchaseOrderId: uuid('purchase_order_id').references(() => procurementOrders.id),
    createdAt: timestamp('created_at').defaultNow(),
});

export const goodsReceipts = pgTable('goods_receipts', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => procurementOrders.id).notNull(),
    receivedById: uuid('received_by_id').references(() => users.id).notNull(),
    receivedAt: timestamp('received_at').defaultNow(),
    notes: text('notes'),
    inspectionStatus: inspectionStatusEnum('inspection_status').default('pending'),
    inspectionNotes: text('inspection_notes'),
}, (table: any) => ({
    receiptOrderIdx: index('receipt_order_idx').on(table.orderId),
    receivedByIdx: index('received_by_idx').on(table.receivedById),
}));

export const qcInspections = pgTable('qc_inspections', {
    id: uuid('id').defaultRandom().primaryKey(),
    receiptId: uuid('receipt_id').references(() => goodsReceipts.id).notNull(),
    inspectorId: uuid('inspector_id').references(() => users.id).notNull(),
    status: inspectionStatusEnum('status').default('pending'),
    checklistResults: text('checklist_results'), // JSON storage for actual check items
    visualInspectionPassed: text('visual_inspection_passed').default('no'),
    quantityVerified: text('quantity_verified').default('no'),
    documentMatch: text('document_match').default('no'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const invoices = pgTable('invoices', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => procurementOrders.id).notNull(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').default('INR'),
    region: text('region'),
    country: text('country'),
    continent: text('continent'),
    status: invoiceStatusEnum('status').default('pending'),
    matchedAt: timestamp('matched_at'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    invoiceOrderIdx: index('invoice_order_idx').on(table.orderId),
    invoiceSupplierIdx: index('invoice_supplier_idx').on(table.supplierId),
    invoiceStatusIdx: index('invoice_status_idx').on(table.status),
}));

// ============================================================================
// AI AGENT INFRASTRUCTURE TABLES
// ============================================================================

export const agentExecutionStatusEnum = pgEnum('agent_execution_status', ['queued', 'running', 'success', 'failed', 'cancelled']);
export const agentRecommendationStatusEnum = pgEnum('agent_recommendation_status', ['pending', 'approved', 'dismissed', 'expired']);
export const recommendationImpactEnum = pgEnum('recommendation_impact', ['low', 'medium', 'high', 'critical']);

export const agentExecutions = pgTable('agent_executions', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentName: text('agent_name').notNull(),
    status: agentExecutionStatusEnum('status').default('queued'),
    inputContext: text('input_context'),
    outputData: text('output_data'),
    confidenceScore: integer('confidence_score'),
    tokenUsage: integer('token_usage'),
    executionTimeMs: integer('execution_time_ms'),
    errorMessage: text('error_message'),
    triggeredBy: text('triggered_by').default('manual'),
    userId: uuid('user_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
}, (table: any) => ({
    agentNameIdx: index('agent_exec_name_idx').on(table.agentName),
    agentStatusIdx: index('agent_exec_status_idx').on(table.status),
    agentCreatedIdx: index('agent_exec_created_idx').on(table.createdAt),
}));

export const agentRecommendations = pgTable('agent_recommendations', {
    id: uuid('id').defaultRandom().primaryKey(),
    agentName: text('agent_name').notNull(),
    recommendationType: text('recommendation_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    impact: recommendationImpactEnum('impact').default('medium'),
    estimatedSavings: decimal('estimated_savings', { precision: 12, scale: 2 }),
    actionPayload: text('action_payload'),
    status: agentRecommendationStatusEnum('status').default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    expiresAt: timestamp('expires_at'),
    // AI Productization fields
    confidence: integer('confidence'), // 0-100 confidence score
    ownerId: uuid('owner_id').references(() => users.id),
    businessImpact: text('business_impact'), // Human-readable impact explanation
    explanation: text('explanation'), // Why the AI recommended this
    executionPayload: text('execution_payload'), // JSON: structured action to execute
    executedAt: timestamp('executed_at'),
    dismissalReason: text('dismissal_reason'),
    outcomeTracking: text('outcome_tracking'), // JSON: { expectedOutcome, actualOutcome, delta }
    entityType: text('entity_type'), // 'supplier', 'rfq', 'order', 'contract', 'invoice'
    entityId: uuid('entity_id'), // Link to specific procurement object
    dueDate: timestamp('due_date'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    agentRecNameIdx: index('agent_rec_name_idx').on(table.agentName),
    agentRecStatusIdx: index('agent_rec_status_idx').on(table.status),
    agentRecImpactIdx: index('agent_rec_impact_idx').on(table.impact),
    agentRecEntityIdx: index('agent_rec_entity_idx').on(table.entityType, table.entityId),
    agentRecOwnerIdx: index('agent_rec_owner_idx').on(table.ownerId),
}));

export const demandForecasts = pgTable('demand_forecasts', {
    id: uuid('id').defaultRandom().primaryKey(),
    partId: uuid('part_id').references(() => parts.id).notNull(),
    forecastDate: timestamp('forecast_date').notNull(),
    predictedQuantity: integer('predicted_quantity').notNull(),
    confidenceLower: integer('confidence_lower'),
    confidenceUpper: integer('confidence_upper'),
    trend: text('trend').default('stable'),
    seasonalityFactor: decimal('seasonality_factor', { precision: 5, scale: 2 }),
    factors: text('factors'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    forecastPartIdx: index('forecast_part_idx').on(table.partId),
    forecastDateIdx: index('forecast_date_idx').on(table.forecastDate),
}));

export const marketPriceIndex = pgTable('market_price_index', {
    id: uuid('id').defaultRandom().primaryKey(),
    partCategory: text('part_category').notNull(),
    commodity: text('commodity'),
    benchmarkPrice: decimal('benchmark_price', { precision: 12, scale: 4 }),
    source: text('source'),
    validFrom: timestamp('valid_from'),
    validTo: timestamp('valid_to'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    priceIdxCategory: index('price_idx_category').on(table.partCategory),
}));

export const fraudAlerts = pgTable('fraud_alerts', {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    alertType: text('alert_type').notNull(),
    severity: text('severity').default('medium'),
    description: text('description').notNull(),
    indicators: text('indicators'),
    suggestedAction: text('suggested_action'),
    falsePositiveProbability: decimal('false_positive_probability', { precision: 5, scale: 2 }),
    status: text('status').default('open'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    fraudEntityIdx: index('fraud_entity_idx').on(table.entityType, table.entityId),
    fraudSeverityIdx: index('fraud_severity_idx').on(table.severity),
    fraudStatusIdx: index('fraud_status_idx').on(table.status),
}));

export const paymentOptimizations = pgTable('payment_optimizations', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => procurementOrders.id).notNull(),
    invoiceId: uuid('invoice_id').references(() => invoices.id),
    supplierName: text('supplier_name').notNull(),
    invoiceAmount: decimal('invoice_amount', { precision: 12, scale: 2 }).notNull(),
    discountTerms: text('discount_terms'),
    currentDueDate: timestamp('current_due_date'),
    suggestedPaymentDate: timestamp('suggested_payment_date'),
    potentialSavings: decimal('potential_savings', { precision: 12, scale: 2 }),
    savingsType: text('savings_type'),
    reason: text('reason'),
    annualizedReturn: decimal('annualized_return', { precision: 5, scale: 2 }),
    status: text('status').default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    payOptOrderIdx: index('pay_opt_order_idx').on(table.orderId),
    payOptStatusIdx: index('pay_opt_status_idx').on(table.status),
}));


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

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }: any) => ({
    order: one(procurementOrders, {
        fields: [goodsReceipts.orderId],
        references: [procurementOrders.id],
    }),
    receivedBy: one(users, {
        fields: [goodsReceipts.receivedById],
        references: [users.id],
    }),
    inspections: many(qcInspections),
}));

export const qcInspectionsRelations = relations(qcInspections, ({ one }: any) => ({
    receipt: one(goodsReceipts, {
        fields: [qcInspections.receiptId],
        references: [goodsReceipts.id],
    }),
    inspector: one(users, {
        fields: [qcInspections.inspectorId],
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
// CONTACTS & SUPPORT TABLES
// ============================================================================

export const contactStatusEnum = pgEnum('contact_status', ['active', 'inactive', 'on_hold']);

export const contacts = pgTable('contacts', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    company: text('company'),
    jobTitle: text('job_title'),
    region: text('region'),
    country: text('country'),
    continent: text('continent'),
    currency: text('currency').default('INR'),
    status: contactStatusEnum('status').default('active'),
    notes: text('notes'),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    contactEmailIdx: index('contact_email_idx').on(table.email),
    contactSupplierIdx: index('contact_supplier_idx').on(table.supplierId),
}));

export const supportTicketStatusEnum = pgEnum('support_ticket_status', ['open', 'in_progress', 'resolved', 'closed']);
export const supportTicketPriorityEnum = pgEnum('support_ticket_priority', ['low', 'medium', 'high', 'critical']);

export const supportTickets = pgTable('support_tickets', {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketNumber: text('ticket_number').notNull(),
    submittedById: uuid('submitted_by_id').references(() => users.id).notNull(),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    category: text('category').default('general'),
    priority: supportTicketPriorityEnum('priority').default('medium'),
    status: supportTicketStatusEnum('status').default('open'),
    resolution: text('resolution'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    ticketStatusIdx: index('ticket_status_idx').on(table.status),
    ticketPriorityIdx: index('ticket_priority_idx').on(table.priority),
    ticketUserIdx: index('ticket_user_idx').on(table.submittedById),
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
export type SystemTelemetry = typeof systemTelemetry.$inferSelect;
export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type QCInspection = typeof qcInspections.$inferSelect;
export type AgentExecution = typeof agentExecutions.$inferSelect;
export type AgentRecommendation = typeof agentRecommendations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type DemandForecast = typeof demandForecasts.$inferSelect;
export type MarketPriceIndex = typeof marketPriceIndex.$inferSelect;
export type FraudAlert = typeof fraudAlerts.$inferSelect;
export type PaymentOptimization = typeof paymentOptimizations.$inferSelect;

// ============================================================================
// BUDGET & COST CENTER TABLES
// ============================================================================

export const budgets = pgTable('budgets', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    costCenter: text('cost_center'),
    totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    usedAmount: decimal('used_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    fiscalYear: text('fiscal_year').notNull(),
    department: text('department'),
    status: text('status').default('active'), // active, frozen, closed
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    budgetDeptIdx: index('budget_dept_idx').on(table.department),
    budgetYearIdx: index('budget_year_idx').on(table.fiscalYear),
}));

export const costCenters = pgTable('cost_centers', {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    department: text('department'),
    isActive: text('is_active').default('yes'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    costCenterCodeIdx: uniqueIndex('cost_center_code_idx').on(table.code),
}));

export type Budget = typeof budgets.$inferSelect;
export type CostCenter = typeof costCenters.$inferSelect;

// ============================================================================
// WEBHOOK TABLES
// ============================================================================

export const webhookEventEnum = pgEnum('webhook_event', [
    'order.created', 'order.updated', 'order.fulfilled',
    'invoice.created', 'invoice.matched', 'invoice.disputed',
    'rfq.created', 'rfq.closed',
    'requisition.approved', 'requisition.rejected',
    'contract.expiring', 'contract.expired',
    'supplier.created', 'supplier.updated',
]);

export const webhooks = pgTable('webhooks', {
    id: uuid('id').defaultRandom().primaryKey(),
    url: text('url').notNull(),
    events: text('events').array().notNull(), // Array of event types to subscribe to
    secret: text('secret').notNull(), // HMAC signing secret
    isActive: text('is_active').default('yes'),
    description: text('description'),
    createdById: uuid('created_by_id').references(() => users.id),
    lastTriggeredAt: timestamp('last_triggered_at'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    webhookActiveIdx: index('webhook_active_idx').on(table.isActive),
}));

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', ['pending', 'success', 'failed', 'retrying']);

export const webhookDeliveries = pgTable('webhook_deliveries', {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id').references(() => webhooks.id).notNull(),
    event: text('event').notNull(),
    payload: text('payload').notNull(), // JSON
    statusCode: integer('status_code'),
    response: text('response'),
    status: webhookDeliveryStatusEnum('status').default('pending'),
    attempts: integer('attempts').default(0),
    nextRetryAt: timestamp('next_retry_at'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    deliveryWebhookIdx: index('delivery_webhook_idx').on(table.webhookId),
    deliveryStatusIdx: index('delivery_status_idx').on(table.status),
}));

export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// ============================================================================
// WORKFLOW TASKS - First-class task engine for all procurement objects
// ============================================================================

export const workflowTasks = pgTable('workflow_tasks', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    entityType: taskEntityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    status: taskStatusEnum('status').default('open'),
    priority: taskPriorityEnum('priority').default('medium'),
    assigneeId: uuid('assignee_id').references(() => users.id),
    createdById: uuid('created_by_id').references(() => users.id).notNull(),
    dueDate: timestamp('due_date'),
    slaDeadline: timestamp('sla_deadline'),
    escalatedAt: timestamp('escalated_at'),
    escalatedToId: uuid('escalated_to_id').references(() => users.id),
    escalationReason: text('escalation_reason'),
    completedAt: timestamp('completed_at'),
    completionEvidence: text('completion_evidence'), // JSON: notes, document refs
    nextAction: text('next_action'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table: any) => ({
    taskEntityIdx: index('task_entity_idx').on(table.entityType, table.entityId),
    taskAssigneeIdx: index('task_assignee_idx').on(table.assigneeId),
    taskStatusIdx: index('task_status_idx').on(table.status),
    taskDueIdx: index('task_due_idx').on(table.dueDate),
    taskPriorityIdx: index('task_priority_idx').on(table.priority),
}));

export const workflowTasksRelations = relations(workflowTasks, ({ one }: any) => ({
    assignee: one(users, { fields: [workflowTasks.assigneeId], references: [users.id], relationName: 'taskAssignee' }),
    createdBy: one(users, { fields: [workflowTasks.createdById], references: [users.id], relationName: 'taskCreator' }),
    escalatedTo: one(users, { fields: [workflowTasks.escalatedToId], references: [users.id], relationName: 'taskEscalation' }),
}));

export type WorkflowTask = typeof workflowTasks.$inferSelect;

// ============================================================================
// COMPLIANCE OBLIGATIONS - Deadline-driven compliance management
// ============================================================================

export const complianceObligations = pgTable('compliance_obligations', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    contractId: uuid('contract_id').references(() => contracts.id),
    category: text('category').notNull(), // e.g. 'iso_certification', 'insurance', 'esg_attestation', 'regulatory'
    status: complianceStatusEnum('status').default('active'),
    ownerId: uuid('owner_id').references(() => users.id),
    documentRequired: text('document_required').default('yes'),
    documentUrl: text('document_url'),
    evidenceSubmittedAt: timestamp('evidence_submitted_at'),
    expiresAt: timestamp('expires_at'),
    reminderDaysBefore: integer('reminder_days_before').default(30),
    lastReminderSentAt: timestamp('last_reminder_sent_at'),
    escalationPolicy: text('escalation_policy'), // JSON: { afterDays: 7, escalateTo: userId }
    policyPack: text('policy_pack'), // e.g. 'EU_REGULATORY', 'ISO_COMPLIANCE', 'ESG_STANDARD'
    region: text('region'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table: any) => ({
    complianceSupplierIdx: index('compliance_supplier_idx').on(table.supplierId),
    complianceStatusIdx: index('compliance_status_idx').on(table.status),
    complianceExpiryIdx: index('compliance_expiry_idx').on(table.expiresAt),
    complianceCategoryIdx: index('compliance_category_idx').on(table.category),
}));

export const complianceObligationsRelations = relations(complianceObligations, ({ one }: any) => ({
    supplier: one(suppliers, { fields: [complianceObligations.supplierId], references: [suppliers.id] }),
    contract: one(contracts, { fields: [complianceObligations.contractId], references: [contracts.id] }),
    owner: one(users, { fields: [complianceObligations.ownerId], references: [users.id] }),
}));

export type ComplianceObligation = typeof complianceObligations.$inferSelect;

// ============================================================================
// SUPPLIER REQUESTS - Structured request management for suppliers
// ============================================================================

export const supplierRequests = pgTable('supplier_requests', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    requestType: supplierRequestTypeEnum('request_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: supplierRequestStatusEnum('status').default('draft'),
    assigneeId: uuid('assignee_id').references(() => users.id),
    dueDate: timestamp('due_date'),
    responseText: text('response_text'),
    responseDocumentUrl: text('response_document_url'),
    respondedAt: timestamp('responded_at'),
    verifiedById: uuid('verified_by_id').references(() => users.id),
    verifiedAt: timestamp('verified_at'),
    linkedObligationId: uuid('linked_obligation_id').references(() => complianceObligations.id),
    createdById: uuid('created_by_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table: any) => ({
    srSupplierIdx: index('sr_supplier_idx').on(table.supplierId),
    srStatusIdx: index('sr_status_idx').on(table.status),
    srTypeIdx: index('sr_type_idx').on(table.requestType),
    srDueIdx: index('sr_due_idx').on(table.dueDate),
}));

export const supplierRequestsRelations = relations(supplierRequests, ({ one }: any) => ({
    supplier: one(suppliers, { fields: [supplierRequests.supplierId], references: [suppliers.id] }),
    assignee: one(users, { fields: [supplierRequests.assigneeId], references: [users.id], relationName: 'srAssignee' }),
    createdBy: one(users, { fields: [supplierRequests.createdById], references: [users.id], relationName: 'srCreator' }),
    verifiedBy: one(users, { fields: [supplierRequests.verifiedById], references: [users.id], relationName: 'srVerifier' }),
    linkedObligation: one(complianceObligations, { fields: [supplierRequests.linkedObligationId], references: [complianceObligations.id] }),
}));

export type SupplierRequest = typeof supplierRequests.$inferSelect;

// ============================================================================
// SUPPLIER ACTION PLANS - Remediation, development, and lifecycle governance
// ============================================================================

export const supplierActionPlans = pgTable('supplier_action_plans', {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    severity: actionPlanSeverityEnum('severity').default('medium'),
    status: actionPlanStatusEnum('status').default('draft'),
    planType: text('plan_type').notNull(), // 'remediation', 'development', 'onboarding', 'requalification', 'periodic_review'
    ownerId: uuid('owner_id').references(() => users.id),
    dueDate: timestamp('due_date'),
    steps: text('steps'), // JSON: [{ title, description, status, dueDate, evidence }]
    linkedEvidence: text('linked_evidence'), // JSON: [{ type, url, uploadedAt }]
    completedAt: timestamp('completed_at'),
    createdById: uuid('created_by_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table: any) => ({
    apSupplierIdx: index('ap_supplier_idx').on(table.supplierId),
    apStatusIdx: index('ap_status_idx').on(table.status),
    apSeverityIdx: index('ap_severity_idx').on(table.severity),
    apDueIdx: index('ap_due_idx').on(table.dueDate),
}));

export const supplierActionPlansRelations = relations(supplierActionPlans, ({ one }: any) => ({
    supplier: one(suppliers, { fields: [supplierActionPlans.supplierId], references: [suppliers.id] }),
    owner: one(users, { fields: [supplierActionPlans.ownerId], references: [users.id], relationName: 'apOwner' }),
    createdBy: one(users, { fields: [supplierActionPlans.createdById], references: [users.id], relationName: 'apCreator' }),
}));

export type SupplierActionPlan = typeof supplierActionPlans.$inferSelect;

// ============================================================================
// SOURCING EVENTS - Full event orchestration for RFQs
// ============================================================================

export const sourcingEvents = pgTable('sourcing_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    rfqId: uuid('rfq_id').references(() => rfqs.id).notNull(),
    status: sourcingEventStatusEnum('status').default('draft'),
    launchedAt: timestamp('launched_at'),
    bidDeadline: timestamp('bid_deadline'),
    qaDeadline: timestamp('qa_deadline'),
    evaluationDeadline: timestamp('evaluation_deadline'),
    scoringModel: text('scoring_model'), // JSON: { price: 40, quality: 30, delivery: 20, risk: 10 }
    awardMemo: text('award_memo'),
    awardedSupplierId: uuid('awarded_supplier_id').references(() => suppliers.id),
    awardedAt: timestamp('awarded_at'),
    awardJustification: text('award_justification'),
    scenarioComparison: text('scenario_comparison'), // JSON: [{ name, supplierId, score, breakdown }]
    noBidHandling: text('no_bid_handling').default('extend_deadline'), // 'extend_deadline', 'close', 'reinvite'
    ownerId: uuid('owner_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table: any) => ({
    seRfqIdx: index('se_rfq_idx').on(table.rfqId),
    seStatusIdx: index('se_status_idx').on(table.status),
    seDeadlineIdx: index('se_deadline_idx').on(table.bidDeadline),
}));

export const sourcingEventsRelations = relations(sourcingEvents, ({ one }: any) => ({
    rfq: one(rfqs, { fields: [sourcingEvents.rfqId], references: [rfqs.id] }),
    awardedSupplier: one(suppliers, { fields: [sourcingEvents.awardedSupplierId], references: [suppliers.id] }),
    owner: one(users, { fields: [sourcingEvents.ownerId], references: [users.id] }),
}));

export type SourcingEvent = typeof sourcingEvents.$inferSelect;

// ============================================================================
// SOURCING MESSAGES - Supplier communication per RFQ/sourcing event
// ============================================================================

export const sourcingMessages = pgTable('sourcing_messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    rfqId: uuid('rfq_id').references(() => rfqs.id).notNull(),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    senderId: uuid('sender_id').references(() => users.id).notNull(),
    messageType: sourcingMessageTypeEnum('message_type').default('general'),
    subject: text('subject'),
    content: text('content').notNull(),
    parentMessageId: uuid('parent_message_id'),
    isRead: text('is_read').default('no'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    smRfqIdx: index('sm_rfq_idx').on(table.rfqId),
    smSupplierIdx: index('sm_supplier_idx').on(table.supplierId),
    smSenderIdx: index('sm_sender_idx').on(table.senderId),
    smParentIdx: index('sm_parent_idx').on(table.parentMessageId),
}));

export const sourcingMessagesRelations = relations(sourcingMessages, ({ one }: any) => ({
    rfq: one(rfqs, { fields: [sourcingMessages.rfqId], references: [rfqs.id] }),
    supplier: one(suppliers, { fields: [sourcingMessages.supplierId], references: [suppliers.id] }),
    sender: one(users, { fields: [sourcingMessages.senderId], references: [users.id] }),
}));

export type SourcingMessage = typeof sourcingMessages.$inferSelect;

// ============================================================================
// SAVINGS RECORDS - Taxonomy-governed savings tracking
// ============================================================================

export const savingsRecords = pgTable('savings_records', {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(), // 'order', 'rfq', 'contract', 'negotiation'
    entityId: uuid('entity_id').notNull(),
    category: savingsCategoryEnum('category').notNull(),
    trackingStatus: savingsTrackingStatusEnum('tracking_status').default('forecast'),
    forecastAmount: decimal('forecast_amount', { precision: 12, scale: 2 }).notNull(),
    realizedAmount: decimal('realized_amount', { precision: 12, scale: 2 }),
    baselineAmount: decimal('baseline_amount', { precision: 12, scale: 2 }), // Original/benchmark price
    currency: text('currency').default('INR'),
    validatedById: uuid('validated_by_id').references(() => users.id),
    validatedAt: timestamp('validated_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    savEntityIdx: index('sav_entity_idx').on(table.entityType, table.entityId),
    savCategoryIdx: index('sav_category_idx').on(table.category),
    savStatusIdx: index('sav_status_idx').on(table.trackingStatus),
}));

export type SavingsRecord = typeof savingsRecords.$inferSelect;

// ============================================================================
// APPROVAL POLICIES - Configurable approval routing rules
// ============================================================================

export const approvalPolicies = pgTable('approval_policies', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    entityType: text('entity_type').notNull(), // 'requisition', 'order', 'invoice', 'contract'
    policyType: approvalPolicyTypeEnum('policy_type').default('amount'),
    conditions: text('conditions').notNull(), // JSON: { minAmount, maxAmount, categories, riskThreshold, ... }
    approverIds: text('approver_ids').array(), // User IDs who can approve
    approverRole: text('approver_role'), // Role-based fallback
    escalationTimeoutHours: integer('escalation_timeout_hours').default(48),
    isActive: text('is_active').default('yes'),
    priority: integer('priority').default(0), // Higher = evaluated first
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table: any) => ({
    apEntityTypeIdx: index('ap_entity_type_idx').on(table.entityType),
    apActiveIdx: index('ap_active_idx').on(table.isActive),
}));

export type ApprovalPolicy = typeof approvalPolicies.$inferSelect;

// ============================================================================
// MATCHING TOLERANCES - Configurable three-way match rules
// ============================================================================

export const matchingTolerances = pgTable('matching_tolerances', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'), // Part category or null for global
    supplierId: uuid('supplier_id').references(() => suppliers.id), // Supplier-specific or null for global
    priceTolerancePercent: decimal('price_tolerance_percent', { precision: 5, scale: 2 }).default('2.00'),
    quantityTolerancePercent: decimal('quantity_tolerance_percent', { precision: 5, scale: 2 }).default('5.00'),
    allowPartialDelivery: text('allow_partial_delivery').default('yes'),
    exceptionReasons: text('exception_reasons'), // JSON: ['price_adjustment', 'freight_included', ...]
    isActive: text('is_active').default('yes'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    mtCategoryIdx: index('mt_category_idx').on(table.category),
    mtSupplierIdx: index('mt_supplier_idx').on(table.supplierId),
}));

export type MatchingTolerance = typeof matchingTolerances.$inferSelect;

// ============================================================================
// IMPORT JOBS - Import history, validation, and rollback support
// ============================================================================

export const importJobs = pgTable('import_jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(), // 'suppliers', 'parts', 'invoices', 'orders', 'contracts', etc.
    status: importJobStatusEnum('status').default('pending'),
    fileName: text('file_name').notNull(),
    totalRows: integer('total_rows').default(0),
    successRows: integer('success_rows').default(0),
    errorRows: integer('error_rows').default(0),
    validationReport: text('validation_report'), // JSON: [{ row, field, issue }]
    fieldMapping: text('field_mapping'), // JSON: { csvColumn: dbField, ... }
    sourceSystemId: text('source_system_id'), // For ERP connector identification
    rollbackData: text('rollback_data'), // JSON: inserted/updated IDs for undo
    importedById: uuid('imported_by_id').references(() => users.id).notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table: any) => ({
    ijStatusIdx: index('ij_status_idx').on(table.status),
    ijEntityIdx: index('ij_entity_idx').on(table.entityType),
    ijCreatedIdx: index('ij_created_idx').on(table.createdAt),
}));

export const importJobsRelations = relations(importJobs, ({ one }: any) => ({
    importedBy: one(users, { fields: [importJobs.importedById], references: [users.id] }),
}));

export type ImportJob = typeof importJobs.$inferSelect;
