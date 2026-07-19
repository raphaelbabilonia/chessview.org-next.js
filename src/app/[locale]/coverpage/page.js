import { permanentRedirect } from "next/navigation";

export default async function LegacyLocalizedCoverPage({ params }) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/maps`);
}
