import { redirect } from "next/navigation";
import { getServerUserSession } from "@/lib/auth/serverSession";

export const dynamic = "force-dynamic";

export default async function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerUserSession();

  if (!session) {
    redirect("/login?next=/shop/cart");
  }

  return <>{children}</>;
}
