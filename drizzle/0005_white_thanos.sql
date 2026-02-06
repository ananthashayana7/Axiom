CREATE TYPE "public"."agent_execution_status" AS ENUM('queued', 'running', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."agent_recommendation_status" AS ENUM('pending', 'approved', 'dismissed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."recommendation_impact" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "agent_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"status" "agent_execution_status" DEFAULT 'queued',
	"input_context" text,
	"output_data" text,
	"confidence_score" integer,
	"token_usage" integer,
	"execution_time_ms" integer,
	"error_message" text,
	"triggered_by" text DEFAULT 'manual',
	"user_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"recommendation_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"impact" "recommendation_impact" DEFAULT 'medium',
	"estimated_savings" numeric(12, 2),
	"action_payload" text,
	"status" "agent_recommendation_status" DEFAULT 'pending',
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demand_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"forecast_date" timestamp NOT NULL,
	"predicted_quantity" integer NOT NULL,
	"confidence_lower" integer,
	"confidence_upper" integer,
	"trend" text DEFAULT 'stable',
	"seasonality_factor" numeric(5, 2),
	"factors" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fraud_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'medium',
	"description" text NOT NULL,
	"indicators" text,
	"suggested_action" text,
	"false_positive_probability" numeric(5, 2),
	"status" text DEFAULT 'open',
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_price_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_category" text NOT NULL,
	"commodity" text,
	"benchmark_price" numeric(12, 4),
	"source" text,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_optimizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"invoice_id" uuid,
	"supplier_name" text NOT NULL,
	"invoice_amount" numeric(12, 2) NOT NULL,
	"discount_terms" text,
	"current_due_date" timestamp,
	"suggested_payment_date" timestamp,
	"potential_savings" numeric(12, 2),
	"savings_type" text,
	"reason" text,
	"annualized_return" numeric(5, 2),
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "is_two_factor_enabled" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_recommendations" ADD CONSTRAINT "agent_recommendations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_optimizations" ADD CONSTRAINT "payment_optimizations_order_id_procurement_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."procurement_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_optimizations" ADD CONSTRAINT "payment_optimizations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_exec_name_idx" ON "agent_executions" USING btree ("agent_name");--> statement-breakpoint
CREATE INDEX "agent_exec_status_idx" ON "agent_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_exec_created_idx" ON "agent_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_rec_name_idx" ON "agent_recommendations" USING btree ("agent_name");--> statement-breakpoint
CREATE INDEX "agent_rec_status_idx" ON "agent_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_rec_impact_idx" ON "agent_recommendations" USING btree ("impact");--> statement-breakpoint
CREATE INDEX "forecast_part_idx" ON "demand_forecasts" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "forecast_date_idx" ON "demand_forecasts" USING btree ("forecast_date");--> statement-breakpoint
CREATE INDEX "fraud_entity_idx" ON "fraud_alerts" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "fraud_severity_idx" ON "fraud_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "fraud_status_idx" ON "fraud_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "price_idx_category" ON "market_price_index" USING btree ("part_category");--> statement-breakpoint
CREATE INDEX "pay_opt_order_idx" ON "payment_optimizations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pay_opt_status_idx" ON "payment_optimizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "receipt_order_idx" ON "goods_receipts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "received_by_idx" ON "goods_receipts" USING btree ("received_by_id");--> statement-breakpoint
CREATE INDEX "invoice_order_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "invoice_supplier_idx" ON "invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "item_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "item_part_idx" ON "order_items" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "order_supplier_idx" ON "procurement_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "procurement_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_req_idx" ON "procurement_orders" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "order_created_at_idx" ON "procurement_orders" USING btree ("created_at");