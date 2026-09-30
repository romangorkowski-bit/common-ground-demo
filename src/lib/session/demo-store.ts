import { EMPTY_FACTS, type AffinityFacts, type FactsMeta, type StudentProfile } from "@/lib/ai/schemas";
import { student as fixtureStudent } from "@/lib/affinity/__fixtures__/cast";
import { DEFAULT_WEIGHTS, type HomophilyWeights } from "@/lib/homophily/scorer";
import { demoShiftMs, demoYearShift, shiftIso, shiftYear } from "@/lib/demo-clock";
import { readCookieStudent, writeCookieStudent } from "./demo-cookie";
import { isPersistenceConfigured, loadPersisted, savePersisted } from "./demo-persist";

/**
 * The demo-mode store: one student per browser.
 *
 * load()/save() keep it in a Delta table (demo-persist.ts) when Databricks is
 * configured, and otherwise in the browser's own cookies (demo-cookie.ts), so
 * the student is the same whichever server instance answers. The sync
 * get()/set() keep a module-memory map and remain for tests.
 *
 * Deliberately not a real account system. Demo mode exists so the product can be shown
 * and built before Supabase is configured, and anything that survives a server
 * restart would start to look like persistence we have not actually built.
 *
 * There is no sign-in here. proxy.ts hands every browser a random id in a
 * cookie on its first visit, and that id owns a student. Two browsers never
 * see each other's answers — the bug the first shared-student version had —
 * and nobody types a password to look at a demo. An id the store has never
 * seen (after a restart, say) simply gets a fresh student, so there is no
 * "session expired" to run into.
 */
export interface StoredStudent {
  profile: StudentProfile;
  facts: AffinityFacts;
  meta: FactsMeta;
  intakeCompletedAt: string | null;
  email: string | null;
  /** The student's own weights for the homophily scorer. */
  homophilyWeights: HomophilyWeights;
}

/**
 * A resume that has been read, but that leaves the questionnaire real work to
 * do: it names a school, employers and one club, and flags an ambiguity the
 * extractor could not resolve on its own. Every browser starts here, because
 * the resume reader needs warehouse credentials that a demo room rarely has —
 * the student can still replace it by uploading their own.
 */
/**
 * The fixture student is class of 2027, written in September 2026. Moved
 * forward a year at a time (see demo-clock.ts), so whenever the demo is
 * opened they are a student recruiting for next summer, not an alum.
 */
function keepCurrent(profile: StudentProfile): StudentProfile {
  const years = demoYearShift();
  if (years === 0) return profile;
  return {
    ...profile,
    grad_date: shiftYear(profile.grad_date, years),
    coursework: profile.coursework.map((c) => ({ ...c, term: c.term?.replace(/\d{4}/, (y) => String(Number(y) + years)) ?? null })),
    experience: profile.experience.map((e) => ({ ...e, start: shiftYear(e.start, years), end: shiftYear(e.end, years) })),
  };
}

function seed(): StoredStudent {
  return {
    profile: keepCurrent({
      ...fixtureStudent.profile,
      affinity: {
        ...fixtureStudent.profile.affinity,
        student_orgs: ["Investment Club"],
        greek: [],
        case_competitions: [],
        programs: [],
        clients_and_programs: [],
      },
      uncertainties: [
        "The activities section lists “DSP”. That is probably Delta Sigma Pi, but the document never says so.",
        `Two end dates overlap in summer ${2026 + demoYearShift()} — the Blue Ridge internship and the campus job may have run at the same time.`,
      ],
    }),
    facts: { ...EMPTY_FACTS },
    meta: {},
    intakeCompletedAt: null,
    email: null,
    homophilyWeights: { ...DEFAULT_WEIGHTS },
  };
}

/**
 * DEMO_PREFILL=1 seeds each new browser with the fully answered questionnaire
 * from the fixture instead of an empty one, so the dashboard is interesting
 * without walking the questions live. Off by default: the questionnaire is
 * the demo, and this exists for rehearsal-free showings only.
 */
function prefilled(): StoredStudent {
  const meta: FactsMeta = {};
  const now = new Date().toISOString();
  for (const key of Object.keys(fixtureStudent.facts)) {
    meta[key] = { source: "answer", confidence: 1, raw: null, updatedAt: now };
  }
  const years = demoYearShift();
  const shift = demoShiftMs();
  return {
    profile: keepCurrent(fixtureStudent.profile),
    facts: {
      ...fixtureStudent.facts,
      school_grad_year: shiftYear(fixtureStudent.facts.school_grad_year, years),
      events: fixtureStudent.facts.events.map((e) => ({ ...e, date: shiftIso(e.date, shift) })),
    },
    meta,
    intakeCompletedAt: now,
    email: null,
    homophilyWeights: { ...DEFAULT_WEIGHTS },
  };
}

/** The sample student's profile: what a cookie session leaves out unless the student replaced it. */
export const sampleProfile = (): StudentProfile => initial().profile;

const initial = () => (process.env.DEMO_PREFILL === "1" ? prefilled() : seed());

/**
 * Pinned to globalThis, not module scope. Next's dev server re-evaluates a
 * module whenever it or an import changes, and can hold more than one
 * instance of it across route bundles; a plain `const students = new Map()`
 * is emptied by either. globalThis is process-wide and outlives every
 * re-evaluation — the same trick used for database clients in dev.
 */
// The key names the shape: the value that outlives a module reload may have
// been written by an older version of this file, and must be checked, not
// trusted.
const globalStore = globalThis as typeof globalThis & { __commonGroundDemoStudents?: unknown };
if (!(globalStore.__commonGroundDemoStudents instanceof Map)) globalStore.__commonGroundDemoStudents = new Map();
const students = globalStore.__commonGroundDemoStudents as Map<string, StoredStudent>;

export const demoStore = {
  /** This browser's student, made on first sight. Null only with no id at all. */
  get(id: string | null | undefined): StoredStudent | null {
    if (!id) return null;
    let student = students.get(id);
    if (!student) {
      student = initial();
      students.set(id, student);
    }
    return student;
  },

  set(id: string, next: Partial<StoredStudent>): StoredStudent {
    const student = { ...demoStore.get(id)!, ...next };
    students.set(id, student);
    return student;
  },

  /** Back to the seeded student. */
  reset(id: string): StoredStudent {
    const student = initial();
    students.set(id, student);
    return student;
  },

  /**
   * The same as get(), but through the shared table when Databricks is
   * configured — the version pages must use, because on Vercel the map in
   * this process is not the map the last request wrote to.
   */
  async load(id: string | null | undefined): Promise<StoredStudent | null> {
    if (!id) return null;
    if (!isPersistenceConfigured()) return (await readCookieStudent(sampleProfile())) ?? initial();
    try {
      const found = await loadPersisted(id);
      if (found) {
        students.set(id, found);
        return found;
      }
      const fresh = initial();
      students.set(id, fresh);
      await savePersisted(id, fresh);
      return fresh;
    } catch (err) {
      console.warn("[demo] session table unavailable, using this instance's memory", err instanceof Error ? err.message : err);
      return demoStore.get(id);
    }
  },

  /** set(), then written through to the table before returning, so the redirect that follows sees it anywhere. */
  async save(id: string, next: Partial<StoredStudent>): Promise<StoredStudent> {
    if (!isPersistenceConfigured()) {
      const student = { ...((await readCookieStudent(sampleProfile())) ?? initial()), ...next };
      await writeCookieStudent(student, sampleProfile());
      return student;
    }
    // The request that is saving has almost always just loaded this student
    // (getSession), so the in-process copy is current; re-reading would cost
    // a round trip for nothing. Only a save with no prior load reads first.
    const base = students.get(id) ?? (await demoStore.load(id)) ?? initial();
    const student = { ...base, ...next };
    students.set(id, student);
    try {
      await savePersisted(id, student);
    } catch (err) {
      console.error("[demo] could not persist the session; it will not survive this instance", err instanceof Error ? err.message : err);
    }
    return student;
  },

  /** Back to the sample student, through whichever store load()/save() use. */
  async restart(id: string): Promise<StoredStudent> {
    return demoStore.save(id, initial());
  },

  /** How many browsers this server currently knows. For the status strip. */
  size(): number {
    return students.size;
  },

  /** Tests only. */
  clear(): void {
    students.clear();
  },
};
