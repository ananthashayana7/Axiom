CREATE TYPE "public"."abc_classification" AS ENUM('A', 'B', 'C', 'X', 'Y', 'Z', 'None');--> statement-breakpoint
CREATE TYPE "public"."conflict_minerals_status" AS ENUM('compliant', 'non_compliant', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'active', 'expired', 'terminated', 'pending_renewal');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('framework_agreement', 'nda', 'service_agreement', 'one_off');--> statement-breakpoint
CREATE TYPE "public"."incoterms" AS ENUM('EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('pending', 'passed', 'failed', 'conditional');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'matched', 'disputed', 'paid');--> statement-breakpoint
CREATE TYPE "public"."renewal_status" AS ENUM('auto_renew', 'manual', 'none');--> statement-breakpoint
CREATE TYPE "public"."requisition_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'converted_to_po');--> statement-breakpoint
CREATE TYPE "public"."telemetry_type" AS ENUM('event', 'metric', 'error', 'security');--> statement-breakpoint
CREATE TYPE "public"."tier_level" AS ENUM('tier_1', 'tier_2', 'tier_3', 'critical');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'pending_approval' BEFORE 'sent';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'approved' BEFORE 'sent';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'rejected' BEFORE 'sent';--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "contract_type" DEFAULT 'one_off',
	"status" "contract_status" DEFAULT 'draft',
	"value" numeric(12, 2) DEFAULT '0',
	"valid_from" timestamp,
	"valid_to" timestamp,
	"notice_period" integer DEFAULT 30,
	"renewal_status" "renewal_status" DEFAULT 'manual',
	"incoterms" "incoterms",
	"sla_kpis" text,
	"document_url" text,
	"ai_extracted_data" text,
	"liability_cap" numeric(12, 2),
	"price_lock_expiry" timestamp,
	"auto_renewal_alert" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"received_by_id" uuid NOT NULL,
	"received_at" timestamp DEFAULT now(),
	"notes" text,
	"inspection_status" "inspection_status" DEFAULT 'pending',
	"inspection_notes" text
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'pending',
	"matched_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qc_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"inspector_id" uuid NOT NULL,
	"status" "inspection_status" DEFAULT 'pending',
	"checklist_results" text,
	"visual_inspection_passed" text DEFAULT 'no',
	"quantity_verified" text DEFAULT 'no',
	"document_match" text DEFAULT 'no',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "requisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"requested_by_id" uuid NOT NULL,
	"status" "requisition_status" DEFAULT 'draft',
	"estimated_amount" numeric(12, 2) DEFAULT '0',
	"department" text,
	"purchase_order_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "telemetry_type" DEFAULT 'event',
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"value" numeric(12, 4),
	"metadata" text,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "email_idx";--> statement-breakpoint
DROP INDEX "role_idx";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "abc_classification" "abc_classification" DEFAULT 'None';--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "reorder_point" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "min_stock_level" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "requisition_id" uuid;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "incoterms" text;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "asn_number" text;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "estimated_arrival" timestamp;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "initial_quote_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "savings_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD COLUMN "savings_type" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "abc_classification" "abc_classification" DEFAULT 'None';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "carbon_footprint_scope_1" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "carbon_footprint_scope_2" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "carbon_footprint_scope_3" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "conflict_minerals_status" "conflict_minerals_status" DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "iso_certifications" text[];--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "esg_environment_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "esg_social_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "esg_governance_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "financial_health_rating" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "tier_level" "tier_level" DEFAULT 'tier_3';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "is_conflict_mineral_compliant" text DEFAULT 'no';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "modern_slavery_statement" text DEFAULT 'no';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_order_id_procurement_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."procurement_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_procurement_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."procurement_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_purchase_order_id_procurement_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."procurement_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_telemetry" ADD CONSTRAINT "system_telemetry_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_supplier_idx" ON "contracts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "contract_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "telemetry_type_idx" ON "system_telemetry" USING btree ("type");--> statement-breakpoint
CREATE INDEX "telemetry_scope_idx" ON "system_telemetry" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "telemetry_created_idx" ON "system_telemetry" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD CONSTRAINT "procurement_orders_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_orders" ADD CONSTRAINT "procurement_orders_requisition_id_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE no action ON UPDATE no action;