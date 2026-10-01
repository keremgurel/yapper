import { permanentRedirect } from "next/navigation";

export default function LegacyTrainingProduct() {
  permanentRedirect("/products/train");
}
