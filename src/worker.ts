import handler, { createScheduledHandler } from "@emdash-cms/cloudflare/worker";

export default {
  ...handler,
  scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
