import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return <ForgotForm />;
}
