CREATE TYPE "public"."doc_type" AS ENUM('contract', 'invoice', 'quote', 'license', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'warning', 'success', 'error');--> statement-breakpoint
CREATE TYPE "public"."rfq_status" AS ENUM('draft', 'open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rfq_supplier_status" AS ENUM('invited', 'quoted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."supplier_lifecycle" AS ENUM('prospect', 'onboarding', 'active', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user', 'supplier');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"details" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"order_id" uuid,
	"rfq_id" uuid,
	"name" text NOT NULL,
	"type" "doc_type" DEFAULT 'other',
	"url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type" DEFAULT 'info',
	"is_read" text DEFAULT 'no',
	"link" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_name" text DEFAULT 'Axiom' NOT NULL,
	"default_currency" text DEFAULT 'INR' NOT NULL,
	"is_settings_locked" text DEFAULT 'no' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rfq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "rfq_supplier_status" DEFAULT 'invited',
	"quote_amount" numeric(10, 2),
	"ai_analysis" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "rfq_status" DEFAULT 'draft',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_performance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"recorded_at" timestamp DEFAULT now(),
	"delivery_rate" numeric(5, 2) NOT NULL,
	"quality_score" numeric(5, 2) NOT NULL,
	"collaboration_score" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"employee_id" text,
	"password" text NOT NULL,
	"role" "user_role" DEFAULT 'user',
	"supplier_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "price" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "market_trend" text DEFAULT 'stable';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "lifecycle_status" "supplier_lifecycle" DEFAULT 'prospect';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "performance_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "esg_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "financial_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "on_time_delivery_rate" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "defect_rate" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "collaboration_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "responsiveness_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "categories" text[];--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_audit_date" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_risk_audit" timestamp;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_order_id_procurement_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."procurement_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_suppliers" ADD CONSTRAINT "rfq_suppliers_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_suppliers" ADD CONSTRAINT "rfq_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_performance_logs" ADD CONSTRAINT "supplier_performance_logs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "rfq_supplier_rfq_idx" ON "rfq_suppliers" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "rfq_supplier_supplier_idx" ON "rfq_suppliers" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "rfq_supplier_status_idx" ON "rfq_suppliers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "perf_supplier_idx" ON "supplier_performance_logs" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "recorded_at_idx" ON "supplier_performance_logs" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_id_idx" ON "users" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "sku_idx" ON "parts" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "category_idx" ON "parts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "supplier_status_idx" ON "suppliers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_lifecycle_idx" ON "suppliers" USING btree ("lifecycle_status");