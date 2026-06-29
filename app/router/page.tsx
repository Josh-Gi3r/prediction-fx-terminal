import { redirect } from "next/navigation";

/** The old Router surface is superseded by /swap (4-desk comparison). */
export default function RouterRedirect() {
  redirect("/swap");
}
