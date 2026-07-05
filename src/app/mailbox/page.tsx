import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMailForPlayer } from "@/lib/google/reward";
import MailboxClient from "@/components/mailbox/MailboxClient";

export default async function MailboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const items = await getMailForPlayer(session.user.id);

  return <MailboxClient items={items} />;
}
