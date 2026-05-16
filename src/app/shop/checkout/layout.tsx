import { redirect } from "next/navigation";
import { getServerUserSession } from "@/lib/auth/serverSession";

export const dynamic = "force-dynamic";

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerUserSession();

  if (!session) {
    redirect("/login?next=/shop/checkout");
  }

  return <>{children}</>;
}
