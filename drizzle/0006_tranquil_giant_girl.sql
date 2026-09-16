CREATE TABLE "test_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"items" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "test_reports" ADD CONSTRAINT "test_reports_entry_id_contest_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_reports" ADD CONSTRAINT "test_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "test_reports_unique" ON "test_reports" USING btree ("entry_id","user_id");--> statement-breakpoint
CREATE INDEX "test_reports_entry_idx" ON "test_reports" USING btree ("entry_id");