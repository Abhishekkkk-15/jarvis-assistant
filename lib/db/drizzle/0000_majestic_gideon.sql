CREATE TABLE "command_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"command_type" text NOT NULL,
	"success" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"groq_api_key" text,
	"nvidia_api_key" text,
	"selected_model" text DEFAULT 'llama-3.3-70b-versatile' NOT NULL,
	"selected_provider" text DEFAULT 'groq' NOT NULL,
	"wake_word" text DEFAULT 'hey jarvis' NOT NULL,
	"voice_enabled" boolean DEFAULT true NOT NULL,
	"selected_character_id" text DEFAULT 'jarvis-bot' NOT NULL,
	"mini_mode_enabled" boolean DEFAULT false NOT NULL,
	"system_prompt" text DEFAULT 'You are JARVIS, an advanced AI assistant. You are helpful, precise, and slightly formal — like Tony Stark''s AI. Keep responses concise unless detail is requested.',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;