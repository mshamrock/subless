CREATE TABLE "github_details" (
	"project_id" integer PRIMARY KEY NOT NULL,
	"self_host" jsonb,
	"commit_weeks" jsonb,
	"release" jsonb,
	"contributors" jsonb,
	"top_contributor_share" real,
	"good_first_issues" jsonb,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_details" ADD CONSTRAINT "github_details_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;