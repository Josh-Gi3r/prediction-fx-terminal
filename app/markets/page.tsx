import { redirect } from "next/navigation";

/** FX Markets merged into the Swap page. Old links redirect there. */
export default function MarketsPage() {
  redirect("/swap");
}
