import { permanentRedirect } from "next/navigation";

export default function LegacyCoverPage() {
  permanentRedirect("/en/maps");
}
