import { redirect } from "next/navigation";

export default async function LegacyEventDetailPage({ params }) {
  const { id } = await params;
  redirect(`/en/events/${id}`);
}
