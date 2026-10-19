import { UnitsView } from "@/components/finance/units";
import { listUnits } from "@/lib/actions/building";
export default async function UnitsPage() {
  return <UnitsView units={await listUnits()} />;
}
