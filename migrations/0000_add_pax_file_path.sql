CREATE TABLE "consolidated_pax_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"contributing_ships" json NOT NULL,
	"total_record_count" integer DEFAULT 0 NOT NULL,
	"last_updated_by_ship" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"tour_name" text NOT NULL,
	"num_adult" integer DEFAULT 0 NOT NULL,
	"num_child" integer DEFAULT 0 NOT NULL,
	"departure" text,
	"return_time" text,
	"comp" integer DEFAULT 0,
	"total_guests" integer DEFAULT 0,
	"notes" text,
	"tour_date" text,
	"ship_name" text,
	"tour_operator" text,
	"shorex_manager" text,
	"shorex_asst_manager" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"ship_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"dispatch_version_id" integer,
	"spreadsheet_snapshot" json,
	"eod_filename" text,
	"pax_filename" text,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_path" text NOT NULL,
	"ship_id" text DEFAULT 'ship-a' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_path" text NOT NULL,
	"ship_id" text DEFAULT 'ship-a' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eod_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_path" text NOT NULL,
	"ship_id" text DEFAULT 'ship-a' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "excel_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"sheet_name" text NOT NULL,
	"row_index" integer NOT NULL,
	"data" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_dispatch_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispatch_file_id" integer NOT NULL,
	"ship_id" text DEFAULT 'ship-a' NOT NULL,
	"cell_a8_value" text,
	"cell_b8_value" text,
	"cell_h8_value" text,
	"extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispatch_file_path" text NOT NULL,
	"eod_file_path" text,
	"pax_file_path" text,
	"ship_id" text DEFAULT 'ship-a' NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pax_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_path" text NOT NULL,
	"is_consolidated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"template_type" text NOT NULL,
	"ship_id" text DEFAULT 'ship-a' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"result_file_path" text,
	"dropbox_exported" boolean DEFAULT false,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "share_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ship_id" text NOT NULL,
	"report_types" json NOT NULL,
	"share_method" text NOT NULL,
	"recipients" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sharing_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ship_id" text NOT NULL,
	"report_types" json NOT NULL,
	"share_method" text NOT NULL,
	"recipients" json,
	"dropbox_links" json,
	"email_status" text DEFAULT 'pending',
	"dropbox_status" text DEFAULT 'pending',
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mimetype" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'general' NOT NULL,
	"position" text,
	"employee_number" text,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_employee_number_unique" UNIQUE("employee_number"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "dispatch_sessions" ADD CONSTRAINT "dispatch_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_sessions" ADD CONSTRAINT "dispatch_sessions_dispatch_version_id_dispatch_versions_id_fk" FOREIGN KEY ("dispatch_version_id") REFERENCES "public"."dispatch_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excel_data" ADD CONSTRAINT "excel_data_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_templates" ADD CONSTRAINT "share_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_activities" ADD CONSTRAINT "sharing_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;