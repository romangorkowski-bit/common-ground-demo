import type { StoredStudent } from "@/lib/session";
import { getPositionsProvider, type Position } from "@/lib/positions";

/** The same lookup the opening page does, so the tailor sees exactly the posting the student clicked. */
export async function findPosition(student: StoredStudent, id: string): Promise<{ position: Position | null; provider: string }> {
  const provider = getPositionsProvider();
  const positions = await provider.getPositions({ companies: student.facts.target_companies, limit: 8000 });
  return { position: positions.find((p) => p.id === id) ?? null, provider: provider.name };
}
