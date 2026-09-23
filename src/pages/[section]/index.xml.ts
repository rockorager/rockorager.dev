import type { APIRoute } from "astro";
import { feed } from "../../lib/feed";
export const GET: APIRoute = ({ params, locals }) => {
  if (params.section === "blog" || params.section === "posts") return feed(["blog"], locals);
  if (params.section === "misc") return feed(["misc"], locals);
  return new Response("Not found", { status: 404 });
};
