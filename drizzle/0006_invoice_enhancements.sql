ALTER TABLE "invoices" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_date" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_amount" decimal(12, 2);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "subtotal" decimal(12, 2);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "line_items" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_terms" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "purchase_order_ref" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "document_url" text;
