CREATE TABLE "card_templates" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" text DEFAULT '' NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"stamps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seq" integer NOT NULL,
	CONSTRAINT "card_templates_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE INDEX "card_templates_user_seq" ON "card_templates" USING btree ("user_id","seq");
