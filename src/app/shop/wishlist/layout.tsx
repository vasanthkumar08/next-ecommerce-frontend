import { redirect } from "next/navigation";
import { getServerUserSession } from "@/lib/auth/serverSession";

export const dynamic = "force-dynamic";

export default async function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerUserSession();

  if (!session) {
    redirect("/login?next=/shop/wishlist");
  }

  return <>{children}</>;
}
