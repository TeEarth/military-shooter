import LoginForm from "@/components/auth/LoginForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/home");

  return (
    <div className="min-h-screen flex items-center justify-center bg-military-darker relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-military-green to-military-darker" />
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-military-tan tracking-widest uppercase">
            Military<br />Shooter 2D
          </h1>
          <p className="text-military-steel mt-2 text-sm">TACTICAL WARFARE AWAITS</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
