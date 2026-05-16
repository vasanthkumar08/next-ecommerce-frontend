"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { logout } from "@/features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { markPerf, measurePerf } from "@/lib/perf";

export function SignOutButton() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const logoutLoading = useAppSelector((state) => state.auth.logoutLoading);

  return (
    <Button
      variant="ghost"
      className="w-full justify-start text-slate-600 hover:bg-[#F8FAFC] hover:text-[#2563EB]"
      loading={logoutLoading}
      disabled={logoutLoading}
      onClick={() => {
        markPerf("logout:click", { source: "admin-signout" });
        void dispatch(logout("admin-signout"));
        router.replace("/");
        markPerf("logout:redirect-fired", { source: "admin-signout" });
        measurePerf(
          "logout:click-to-redirect",
          "logout:click",
          "logout:redirect-fired",
          { source: "admin-signout" }
        );
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
